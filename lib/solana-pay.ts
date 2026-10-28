/**
 * Solana Pay transfer requests (https://docs.solanapay.com/spec), devnet.
 *
 *   solana:<recipient>?amount=<decimal>&spl-token=<mint>&reference=<pubkey>&label=&message=&memo=
 *
 * The payer adds `reference` as a read-only, non-signer account to the transfer
 * instruction; the merchant finds the payment with getSignaturesForAddress(reference)
 * and checks the recipient's balance change in that transaction.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  type ParsedTransactionWithMeta,
  type TransactionInstruction,
} from '@solana/web3.js';

export interface TransferRequest {
  recipient: string;
  /** UI amount (SOL or token units). */
  amount?: number;
  splToken?: string;
  reference?: string[];
  label?: string;
  message?: string;
  memo?: string;
}

const isPubkey = (s: string) => {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

/** Amounts are plain decimals: no exponent, no sign. */
const formatAmount = (n: number) => {
  const s = n.toFixed(9).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
};

export function encodeTransferRequest(req: TransferRequest): string {
  const params = new URLSearchParams();
  if (req.amount !== undefined && req.amount > 0) params.set('amount', formatAmount(req.amount));
  if (req.splToken) params.set('spl-token', req.splToken);
  for (const r of req.reference ?? []) params.append('reference', r);
  if (req.label) params.set('label', req.label);
  if (req.message) params.set('message', req.message);
  if (req.memo) params.set('memo', req.memo);
  const qs = params.toString();
  return `solana:${req.recipient}${qs ? `?${qs}` : ''}`;
}

/**
 * Parses `solana:` transfer requests, RampFi `/pay?...` links and bare addresses.
 * Returns null for anything else (e.g. transaction-request URLs).
 */
export function parsePaymentInput(input: string): TransferRequest | null {
  const text = input.trim();
  if (!text) return null;
  if (isPubkey(text)) return { recipient: text };

  let recipient: string | null = null;
  let params: URLSearchParams;
  if (/^solana:/i.test(text)) {
    const body = text.slice('solana:'.length);
    const [path, query = ''] = body.split('?');
    recipient = decodeURIComponent(path);
    params = new URLSearchParams(query);
  } else {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!/\/pay\/?$/.test(url.pathname)) return null;
    params = url.searchParams;
    recipient = params.get('recipient');
  }
  if (!recipient || !isPubkey(recipient)) return null;

  const amountStr = params.get('amount');
  const amount = amountStr && /^\d+(\.\d+)?$/.test(amountStr) ? Number(amountStr) : undefined;
  const splToken = params.get('spl-token') ?? undefined;
  if (splToken && !isPubkey(splToken)) return null;
  const reference = params.getAll('reference').filter(isPubkey);

  return {
    recipient,
    amount,
    splToken,
    reference: reference.length ? reference : undefined,
    label: params.get('label') ?? undefined,
    message: params.get('message') ?? undefined,
    memo: params.get('memo') ?? undefined,
  };
}

/** RampFi web link for a request: opens /pay, which also shows the QR. */
export function paymentLink(origin: string, req: TransferRequest): string {
  const params = new URLSearchParams({ recipient: req.recipient });
  if (req.amount) params.set('amount', formatAmount(req.amount));
  if (req.splToken) params.set('spl-token', req.splToken);
  for (const r of req.reference ?? []) params.append('reference', r);
  if (req.label) params.set('label', req.label);
  if (req.message) params.set('message', req.message);
  return `${origin}/pay?${params.toString()}`;
}

export const newReference = () => Keypair.generate().publicKey.toBase58();

/** Adds the request's reference keys to an instruction (read-only, non-signer). */
export function withReferences(ix: TransactionInstruction, references: string[] = []) {
  for (const r of references) ix.keys.push({ pubkey: new PublicKey(r), isSigner: false, isWritable: false });
  return ix;
}

/** Oldest confirmed signature that mentions the reference, or null. */
export async function findReference(connection: Connection, reference: string): Promise<string | null> {
  const sigs = await connection.getSignaturesForAddress(new PublicKey(reference), { limit: 1000 }, 'confirmed');
  const ok = sigs.filter((s) => !s.err);
  return ok.length ? ok[ok.length - 1].signature : null;
}

/** How much the recipient received in `tx` (SOL, or the given mint), in UI units. */
export function receivedAmount(tx: ParsedTransactionWithMeta, recipient: string, splToken?: string): number {
  const meta = tx.meta;
  if (!meta) return 0;
  if (!splToken) {
    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    const i = keys.indexOf(recipient);
    if (i < 0) return 0;
    return (meta.postBalances[i] - meta.preBalances[i]) / 1e9;
  }
  const sum = (list: typeof meta.postTokenBalances) =>
    (list ?? [])
      .filter((b) => b.mint === splToken && b.owner === recipient)
      .reduce((acc, b) => acc + Number(b.uiTokenAmount.uiAmountString ?? b.uiTokenAmount.uiAmount ?? 0), 0);
  return sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
}

export interface PaymentFound {
  signature: string;
  received: number;
  /** received >= requested amount (or no amount requested). */
  valid: boolean;
}

/** Looks for a payment for `req` (by its first reference) and checks the amount. */
export async function checkPayment(connection: Connection, req: TransferRequest): Promise<PaymentFound | null> {
  const ref = req.reference?.[0];
  if (!ref) return null;
  const signature = await findReference(connection, ref);
  if (!signature) return null;
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) return null;
  const received = receivedAmount(tx, req.recipient, req.splToken);
  const valid = req.amount ? received + 1e-9 >= req.amount : received > 0;
  return { signature, received, valid };
}
