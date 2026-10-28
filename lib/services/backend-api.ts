/**
 * Typed client for the RampFi backend (devnet services: faucet, swap, auth…).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('rampfi-auth-token') : null;
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

// ── Faucet ──────────────────────────────────────────────────────────────
export interface FaucetStatus {
  enabled: boolean;
  canClaim: boolean;
  nextClaimAt: string | null;
  amounts: { SOL: number; USDC: number };
}
export interface FaucetClaimResult {
  ok: boolean;
  sol: { amount: number; signature?: string };
  usdc: { amount: number; signature?: string };
  nextClaimAt: string;
}

export const getFaucetStatus = (wallet: string) =>
  apiFetch<FaucetStatus>(`/api/faucet/status/${wallet}`);

export const claimFaucet = (walletAddress: string) =>
  apiFetch<FaucetClaimResult>('/api/faucet', { method: 'POST', body: JSON.stringify({ walletAddress }) });

// ── Swap (Raydium CPMM devnet pool) ────────────────────────────────────
export interface DevnetSwapQuote {
  dex: 'raydium-cpmm';
  poolId: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  inDecimals: number;
  outDecimals: number;
  feeAmount: string;
  feeRatePct: number;
  priceImpactPct: number;
  swapMode: 'ExactIn';
}

export interface SerializedInstruction {
  programId: string;
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string; // base64
}

export interface DevnetPoolInfo {
  dex: string;
  cluster: string;
  poolId: string;
  programId: string;
  reserves: { SOL: number; USDC: number };
  priceUsdPerSol: number | null;
  feeRatePct: number;
}

export const getSwapPool = () => apiFetch<DevnetPoolInfo>('/api/swap/pool');

export const getDevnetSwapQuote = (inputMint: string, amountRaw: string | number, slippageBps: number) =>
  apiFetch<DevnetSwapQuote>(
    `/api/swap/quote?inputMint=${inputMint}&amount=${amountRaw}&slippageBps=${Math.round(slippageBps)}`,
  );

export const buildDevnetSwap = (owner: string, inputMint: string, amountRaw: string | number, slippageBps: number) =>
  apiFetch<{ quote: DevnetSwapQuote; instructions: SerializedInstruction[]; lookupTables: string[] }>('/api/swap/build', {
    method: 'POST',
    body: JSON.stringify({ owner, inputMint, amount: String(amountRaw), slippageBps: Math.round(slippageBps) }),
  });

// ── LazorKit on-chain access (authorities + sessions) ──────────────────
export interface OnchainAuthority {
  pda: string;
  role: number;
  roleName: 'owner' | 'admin' | 'spender' | string;
  kind: 'passkey' | 'device-key';
  /** Ed25519 key of a device-key authority, null for passkeys. */
  publicKey: string | null;
  counter: number;
}
export interface OnchainSession {
  pda: string;
  sessionKey: string;
  expiresAtSlot: number;
  expired: boolean;
  slotsLeft: number;
  hasLimits: boolean;
}
export interface WalletAccess {
  walletPda: string;
  programId: string;
  slot: number;
  authorities: OnchainAuthority[];
  sessions: OnchainSession[];
}

export const getWalletAccess = (walletPda: string, fresh = false) =>
  apiFetch<WalletAccess>(`/api/lazorkit/access?walletPda=${walletPda}${fresh ? '&fresh=1' : ''}`);
