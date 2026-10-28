/**
 * Parse a wallet's devnet transaction history into typed app activities
 * (send / receive / swap / mint / deposit) from on-chain balance changes.
 */
import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import type { Activity, ActivityKind, TokenSym } from '@/lib/types';
import { TOKEN_ADDRESSES } from '@/lib/services/jupiter';

const PROGRAMS = {
  RAYDIUM_CPMM: 'DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb',
  BUBBLEGUM: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
  TOKEN_METADATA: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  MPL_CORE: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  STAKE: 'Stake11111111111111111111111111111111111111',
} as const;
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Treasury that pays faucet + onramp payouts; incoming funds from it are "deposits". */
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '';

const MINT_TO_SYMBOL = new Map<string, TokenSym>(
  Object.entries(TOKEN_ADDRESSES).map(([sym, mint]) => [mint, sym as TokenSym]),
);
const WSOL = TOKEN_ADDRESSES.SOL;
const LAMPORTS = 1e9;
const DUST_SOL = 0.00001; // ignore rent/fee noise below this

// Parsed results never change once finalized: cache them per signature.
const parsedCache = new Map<string, Activity>();

interface Delta {
  symbol: string;
  mint: string;
  amount: number; // + received, - sent
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const fmt = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 1 ? abs.toLocaleString('en-US', { maximumFractionDigits: 4 }) : abs.toPrecision(4).replace(/0+$/, '');
};

function balanceDeltas(tx: ParsedTransactionWithMeta, owner: string): Delta[] {
  const meta = tx.meta!;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const deltas = new Map<string, Delta>();

  // Native SOL (the paymaster pays the fee, so this is the user's real movement)
  const idx = keys.indexOf(owner);
  if (idx >= 0) {
    const sol = (meta.postBalances[idx] - meta.preBalances[idx]) / LAMPORTS;
    if (Math.abs(sol) > DUST_SOL) deltas.set(WSOL, { symbol: 'SOL', mint: WSOL, amount: sol });
  }

  // SPL tokens owned by the wallet
  const sum = (list: typeof meta.preTokenBalances, sign: 1 | -1) => {
    for (const b of list ?? []) {
      if (b.owner !== owner) continue;
      const amount = (b.uiTokenAmount.uiAmount ?? 0) * sign;
      const symbol = MINT_TO_SYMBOL.get(b.mint) || (b.uiTokenAmount.decimals === 0 ? 'NFT' : short(b.mint));
      const prev = deltas.get(b.mint);
      // wSOL temp accounts net out into native SOL: fold them together
      const key = b.mint === WSOL ? WSOL : b.mint;
      deltas.set(key, { symbol, mint: b.mint, amount: (prev?.amount ?? 0) + amount });
    }
  };
  sum(meta.postTokenBalances, 1);
  sum(meta.preTokenBalances, -1);

  return [...deltas.values()].filter((d) => Math.abs(d.amount) > (d.symbol === 'SOL' ? DUST_SOL : 1e-9));
}

/** Account (other than the owner) whose SOL/token balance moved opposite to ours. */
function findCounterparty(tx: ParsedTransactionWithMeta, owner: string, incoming: boolean): string | undefined {
  const meta = tx.meta!;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  for (const b of meta.postTokenBalances ?? []) {
    if (!b.owner || b.owner === owner) continue;
    const pre = meta.preTokenBalances?.find((p) => p.accountIndex === b.accountIndex);
    const d = (b.uiTokenAmount.uiAmount ?? 0) - (pre?.uiTokenAmount.uiAmount ?? 0);
    if (incoming ? d < 0 : d > 0) return b.owner;
  }
  let best: { key: string; d: number } | undefined;
  keys.forEach((key, i) => {
    if (key === owner) return;
    const d = meta.postBalances[i] - meta.preBalances[i];
    if (incoming ? d < 0 : d > 0) {
      if (!best || Math.abs(d) > Math.abs(best.d)) best = { key, d };
    }
  });
  return best?.key;
}

export function parseActivity(
  tx: ParsedTransactionWithMeta | null,
  signature: string,
  owner: string,
  blockTime?: number | null,
): Activity {
  const ts = new Date(((tx?.blockTime ?? blockTime) || Date.now() / 1000) * 1000).toISOString();
  const base = { id: signature, ts, txSignature: signature };

  if (!tx?.meta) {
    return { ...base, kind: 'other', summary: 'On-chain transaction', status: 'Pending' };
  }
  if (tx.meta.err) {
    return { ...base, kind: 'other', summary: 'Failed transaction', status: 'Failed' };
  }

  const programs = new Set<string>();
  tx.transaction.message.instructions.forEach((ix) => programs.add(ix.programId.toBase58()));
  tx.meta.innerInstructions?.forEach((inner) => inner.instructions.forEach((ix) => programs.add(ix.programId.toBase58())));

  const deltas = balanceDeltas(tx, owner);
  const outs = deltas.filter((d) => d.amount < 0).sort((a, b) => a.amount - b.amount);
  const ins = deltas.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  const tokenOf = (d?: Delta) => (d && MINT_TO_SYMBOL.has(d.mint) ? MINT_TO_SYMBOL.get(d.mint) : undefined);

  let kind: ActivityKind = 'send';
  let summary = 'On-chain transaction';
  let amount: number | undefined;
  let token: TokenSym | undefined;
  let counterparty: string | undefined;

  if (programs.has(PROGRAMS.RAYDIUM_CPMM) || (outs.length && ins.length && outs[0].mint !== ins[0].mint)) {
    kind = 'swap';
    const o = outs[0];
    const i = ins[0];
    summary = o && i ? `Swapped ${fmt(o.amount)} ${o.symbol} → ${fmt(i.amount)} ${i.symbol}` : 'Swap';
    amount = o ? Math.abs(o.amount) : undefined;
    token = tokenOf(o);
  } else if (programs.has(PROGRAMS.BUBBLEGUM)) {
    kind = 'mint';
    summary = 'Minted compressed NFT';
  } else if (programs.has(PROGRAMS.TOKEN_METADATA) || programs.has(PROGRAMS.MPL_CORE) || ins.some((d) => d.symbol === 'NFT')) {
    kind = 'mint';
    summary = 'Minted NFT';
  } else if (programs.has(PROGRAMS.STAKE)) {
    kind = 'deposit';
    const o = outs[0];
    summary = o ? `Staked ${fmt(o.amount)} SOL` : 'Stake account update';
    amount = o ? Math.abs(o.amount) : undefined;
    token = 'SOL' as TokenSym;
  } else if (ins.length && !outs.length) {
    const i = ins[0];
    counterparty = findCounterparty(tx, owner, true);
    const fromTreasury = !!TREASURY && counterparty === TREASURY;
    kind = fromTreasury ? 'deposit' : 'receive';
    summary = ins.map((d) => `${fmt(d.amount)} ${d.symbol}`).join(' + ');
    summary = fromTreasury ? `Received ${summary} from RampFi` : `Received ${summary}${counterparty ? ` from ${short(counterparty)}` : ''}`;
    amount = i.amount;
    token = tokenOf(i);
  } else if (outs.length) {
    const o = outs[0];
    counterparty = findCounterparty(tx, owner, false);
    kind = 'send';
    summary = `Sent ${fmt(o.amount)} ${o.symbol}${counterparty ? ` to ${short(counterparty)}` : ''}`;
    amount = Math.abs(o.amount);
    token = tokenOf(o);
  } else {
    kind = 'other';
    summary = programs.has(ATA_PROGRAM) ? 'Opened token account' : 'Wallet transaction';
  }

  return { ...base, kind, summary, amount, token, counterparty, status: 'Success' };
}

/** Latest `limit` transactions for `owner` (and its token accounts), parsed. Uses a per-signature cache. */
export async function fetchParsedHistory(connection: Connection, owner: string, limit = 25): Promise<Activity[]> {
  const ownerKey = new PublicKey(owner);
  // A transfer into an existing token account doesn't mention the owner: scan the accounts too
  const tokenAccounts = await connection
    .getTokenAccountsByOwner(ownerKey, { programId: TOKEN_PROGRAM })
    .then((r) => r.value.map((v) => v.pubkey).slice(0, 4))
    .catch(() => [] as PublicKey[]);

  const lists = await Promise.all(
    [ownerKey, ...tokenAccounts].map((k) => connection.getSignaturesForAddress(k, { limit }).catch(() => [])),
  );
  const seen = new Set<string>();
  const sigs = lists
    .flat()
    .filter((s) => (seen.has(s.signature) ? false : (seen.add(s.signature), true)))
    .sort((a, b) => b.slot - a.slot)
    .slice(0, limit);
  const missing = sigs.filter((s) => !parsedCache.has(s.signature));

  // Small batches keep public devnet RPCs from rate limiting us
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const txs = await Promise.all(
      batch.map((s) =>
        connection
          .getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
          .catch(() => null),
      ),
    );
    batch.forEach((s, j) => {
      const activity = parseActivity(txs[j], s.signature, owner, s.blockTime);
      if (activity.status !== 'Pending') parsedCache.set(s.signature, activity);
    });
  }

  return sigs.map((s) => parsedCache.get(s.signature) || parseActivity(null, s.signature, owner, s.blockTime));
}
