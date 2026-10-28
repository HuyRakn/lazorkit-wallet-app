/**
 * On-chain delegated signing for LazorKit v2 wallets — no passkey prompt.
 *
 * - Quick Pay: a session key (`createSession`) with spending limits and an
 *   expiry. Gone on disconnect (the SDK deletes the session key).
 * - Trusted browser: a ROLE_SPENDER authority (`addAuthority`) with a spending
 *   policy, kept until `removeAuthority`.
 *
 * The SDK keeps both private keys in IndexedDB (non-extractable). This module
 * only remembers, per wallet, which on-chain session/authority belongs to this
 * browser (public data), and the limits the app registered, so the UI can tell
 * whether a payment fits before trying a passkey-less send.
 */
import type { TransactionInstruction } from '@solana/web3.js';
import { isKeyWalletMismatchError, serializeActions, spendingLimitsToActions } from '@lazorkit/wallet';
import { APP_USDC_MINT } from '@/lib/services/jupiter';

/** Devnet slots are ~400 ms. */
export const SLOT_MS = 400;
export const slotsToMs = (slots: number) => slots * SLOT_MS;

/** Human limits (UI units). Kept small: the key lives in the browser. */
export interface QuickLimits {
  solPerTx: number;
  solLifetime?: number;
  usdcPerTx: number;
  usdcLifetime?: number;
}

export const QUICK_PAY_LIMITS: QuickLimits = { solPerTx: 0.1, solLifetime: 1, usdcPerTx: 20, usdcLifetime: 200 };
/** ~24 h of devnet slots. */
export const QUICK_PAY_EXPIRY_SLOTS = 216_000;

export const TRUSTED_BROWSER_LIMITS: QuickLimits = { solPerTx: 0.5, usdcPerTx: 50 };

const LAMPORTS = BigInt(1_000_000_000);
const USDC_UNITS = BigInt(1_000_000);
const MICRO = BigInt(1_000_000);
const toBase = (ui: number, unit: bigint) => (BigInt(Math.round(ui * 1e6)) * unit) / MICRO;

/**
 * SDK spending limits. SOL limits also cover rent the vault pays (e.g. opening
 * the recipient's token account), so a SOL limit is always set.
 */
export function toSpendingLimits(l: QuickLimits) {
  return {
    solPerTxMax: toBase(l.solPerTx, LAMPORTS),
    ...(l.solLifetime ? { solLifetimeCap: toBase(l.solLifetime, LAMPORTS) } : {}),
    tokens: [
      {
        mint: APP_USDC_MINT,
        perTxMax: toBase(l.usdcPerTx, USDC_UNITS),
        ...(l.usdcLifetime ? { lifetimeCap: toBase(l.usdcLifetime, USDC_UNITS) } : {}),
      },
    ],
  };
}

/** ROLE_SPENDER policy bytes for `addAuthority`. */
export const trustedBrowserPolicy = () =>
  serializeActions(spendingLimitsToActions(toSpendingLimits(TRUSTED_BROWSER_LIMITS)));

// ── Per-wallet markers (public data only) ───────────────────────────────
export interface SessionMarker {
  sessionPda: string;
  sessionKey: string;
  /** Wall-clock estimate of expiry (ms epoch). */
  expiresAt: number;
  limits: QuickLimits;
}
export interface AuthorityMarker {
  authorityPda: string;
  publicKey: string;
  limits: QuickLimits;
}

const key = (kind: 'session' | 'authority', walletPda: string) => `rampfi-${kind}:${walletPda}`;

function read<T>(k: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const getSessionMarker = (walletPda?: string | null) => {
  if (!walletPda) return null;
  const m = read<SessionMarker>(key('session', walletPda));
  if (m && m.expiresAt <= Date.now()) {
    clearSessionMarker(walletPda);
    return null;
  }
  return m;
};
export const setSessionMarker = (walletPda: string, m: SessionMarker) =>
  window.localStorage.setItem(key('session', walletPda), JSON.stringify(m));
export const clearSessionMarker = (walletPda: string) => window.localStorage.removeItem(key('session', walletPda));

export const getAuthorityMarker = (walletPda?: string | null) =>
  walletPda ? read<AuthorityMarker>(key('authority', walletPda)) : null;
export const setAuthorityMarker = (walletPda: string, m: AuthorityMarker) =>
  window.localStorage.setItem(key('authority', walletPda), JSON.stringify(m));
export const clearAuthorityMarker = (walletPda: string) => window.localStorage.removeItem(key('authority', walletPda));

// ── Passkey-less send ──────────────────────────────────────────────────
export interface Spend {
  token: 'SOL' | 'USDC' | string;
  amount: number;
  /** Extra SOL the vault pays (e.g. ~0.00204 rent for a new token account). */
  rentSol?: number;
}

export function fitsLimits(limits: QuickLimits, spend: Spend): boolean {
  const solOut = (spend.token === 'SOL' ? spend.amount : 0) + (spend.rentSol ?? 0);
  if (solOut > limits.solPerTx) return false;
  if (spend.token === 'SOL') return true;
  if (spend.token === 'USDC') return spend.amount <= limits.usdcPerTx;
  return false; // any other asset is not in the policy: it cannot leave the wallet
}

export type QuickSigner = 'session' | 'authority';

/** Which passkey-less signer (if any) can cover this spend. Session first. */
export function pickQuickSigner(walletPda: string | null | undefined, spend: Spend): QuickSigner | null {
  const session = getSessionMarker(walletPda);
  if (session && fitsLimits(session.limits, spend)) return 'session';
  const authority = getAuthorityMarker(walletPda);
  if (authority && fitsLimits(authority.limits, spend)) return 'authority';
  return null;
}

interface QuickWallet {
  signAndSendWithSession: (p: { instructions: TransactionInstruction[] }) => Promise<string>;
  signAndSendWithAuthority: (p: { instructions: TransactionInstruction[] }) => Promise<string>;
}

/**
 * Errors where nothing reached the chain and the stored key is unusable:
 * forget the marker and let the caller fall back to the passkey.
 */
export function isStaleKeyError(err: unknown): boolean {
  if (isOutcomeUnknown(err)) return false;
  if (isKeyWalletMismatchError(err)) return true;
  const msg = String((err as Error)?.message ?? err);
  // SDK: "No session key found…", "No authority key found…"; program 3009 SessionExpired (0xbc1)
  return /no (stored )?session|no (stored )?authority|SessionExpired|\b3009\b|0xbc1\b/i.test(msg);
}

/**
 * Program errors for a spend outside the session/policy limits:
 * 3023–3027, 3029 Action*Exceeded, 3037/3038 ActionUnlisted*Outflow.
 */
export function isLimitError(err: unknown): boolean {
  if (isOutcomeUnknown(err)) return false;
  const msg = String((err as Error)?.message ?? err);
  return /Action\w*(Exceeded|Outflow)|\b30(2[3-79]|3[78])\b|0xbc[f]\b|0xbd[0-35de]\b|spending limit/i.test(msg);
}

/** The transaction may have landed: never retry it with another signer. */
export function isOutcomeUnknown(err: unknown): boolean {
  const name = (err as Error)?.name ?? '';
  return /OutcomeUnknown|ConfirmationTimeout/.test(name);
}

export async function sendWithQuickSigner(
  lz: QuickWallet,
  signer: QuickSigner,
  walletPda: string,
  instructions: TransactionInstruction[],
): Promise<string> {
  try {
    return signer === 'session'
      ? await lz.signAndSendWithSession({ instructions })
      : await lz.signAndSendWithAuthority({ instructions });
  } catch (err) {
    if (isStaleKeyError(err)) {
      if (signer === 'session') clearSessionMarker(walletPda);
      else clearAuthorityMarker(walletPda);
    }
    throw err;
  }
}
