'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, RotateCcw, Share } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TokenLogo } from './ui/token-logo';
import { QRCode } from '@/lib/utils/qr';
import { toast } from '@/hooks/use-toast';
import { APP_USDC_MINT, defaultConnection } from '@/lib/services/jupiter';
import { explorerTxUrl } from '@/lib/utils/explorer';
import {
  checkPayment,
  encodeTransferRequest,
  newReference,
  paymentLink,
  type PaymentFound,
  type TransferRequest,
} from '@/lib/solana-pay';

type Token = 'SOL' | 'USDC';
const POLL_MS = 3000;

/**
 * Solana Pay request: a `solana:` QR any Solana Pay wallet can scan, plus a
 * RampFi /pay link. Watches the chain for the request's reference key and
 * confirms once the recipient got the amount.
 */
export function PaymentRequest({ recipient }: { recipient: string }) {
  const [token, setToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [request, setRequest] = useState<TransferRequest | null>(null);
  const [paid, setPaid] = useState<PaymentFound | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const url = useMemo(() => (request ? encodeTransferRequest(request) : ''), [request]);
  const link = useMemo(
    () => (request && typeof window !== 'undefined' ? paymentLink(window.location.origin, request) : ''),
    [request],
  );

  useEffect(() => {
    if (!request || paid) return;
    let stopped = false;
    const tick = async () => {
      try {
        const found = await checkPayment(defaultConnection, request);
        if (!stopped && found) {
          setPaid(found);
          toast({
            title: found.valid ? '✅ Payment received' : 'Partial payment received',
            description: `${found.received} ${token} arrived on Solana devnet.`,
            variant: found.valid ? undefined : 'destructive',
          });
        }
      } catch (e) {
        console.warn('[solana-pay] poll failed', e);
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [request, paid, token]);

  const create = () => {
    const n = Number(amount);
    if (!(n > 0)) {
      toast({ title: 'Enter an amount', variant: 'destructive' });
      return;
    }
    setPaid(null);
    setRequest({
      recipient,
      amount: n,
      splToken: token === 'USDC' ? APP_USDC_MINT : undefined,
      reference: [newReference()],
      label: 'RampFi',
      message: message.trim() || undefined,
    });
  };

  const reset = () => {
    setRequest(null);
    setPaid(null);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied` });
    } catch {
      toast({ title: 'Clipboard not available', variant: 'destructive' });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RampFi payment request', text: request?.message || 'Pay me on Solana', url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(link, 'Payment link');
  };

  if (!request) {
    return (
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2">
          {(['USDC', 'SOL'] as Token[]).map((t) => (
            <button
              key={t}
              id={`request-token-${t.toLowerCase()}`}
              type="button"
              onClick={() => setToken(t)}
              className={`h-10 rounded-xl text-xs font-extrabold border transition flex items-center justify-center gap-2 cursor-pointer ${
                token === t
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-[0_0_15px_rgba(22,255,187,0.1)]'
                  : 'bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white'
              }`}
            >
              <TokenLogo symbol={t} size={18} />
              <span>{t === 'USDC' ? 'rUSDC' : 'SOL'}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Input
            id="request-amount"
            type="number"
            inputMode="decimal"
            placeholder={`Amount in ${token === 'USDC' ? 'rUSDC' : 'SOL'}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 rounded-xl premium-depth-inset border-white/10 font-mono text-sm"
          />
          <Input
            id="request-message"
            placeholder="Memo / Note (optional, e.g. Coffee)"
            maxLength={64}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="h-10 rounded-xl premium-depth-inset border-white/10 text-xs"
          />
        </div>

        <Button
          id="create-payment-request"
          onClick={create}
          className="w-full h-11 rounded-xl premium-depth-btn text-xs uppercase tracking-wider font-extrabold gap-2"
        >
          <Link2 className="h-4 w-4" /> Create Payment Request
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Generates a live Solana Pay QR &amp; shareable link tracked on-chain in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col items-center gap-2.5">
        <div className="relative rounded-2xl bg-white p-3 border-2 border-primary/30 shadow-[0_0_30px_rgba(22,255,187,0.12)]">
          <QRCode value={url} size={200} level="M" includeMargin marginSize={2} />
          {paid && (
            <div className="absolute inset-0 rounded-2xl bg-[#0b0d15]/95 backdrop-blur-md flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className={`h-12 w-12 ${paid.valid ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-sm font-extrabold text-white">
                {paid.valid ? 'Paid' : 'Underpaid'} · {paid.received} {token === 'USDC' ? 'rUSDC' : 'SOL'}
              </span>
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-white font-mono">
            {request.amount} {token === 'USDC' ? 'rUSDC' : 'SOL'}
          </p>
          {request.message && <p className="text-xs text-muted-foreground">{request.message}</p>}
        </div>
        {!paid && (
          <p className="text-[11px] text-primary font-semibold flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Listening for payment on Devnet…
          </p>
        )}
        {paid && (
          <a
            href={explorerTxUrl(paid.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary font-bold inline-flex items-center gap-1 hover:underline"
          >
            View transaction <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs font-bold gap-1 rounded-xl premium-depth-btn-secondary"
          onClick={() => copy(link, 'Payment link')}
        >
          <Copy className="h-3.5 w-3.5 text-primary" /> Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs font-bold gap-1 rounded-xl premium-depth-btn-secondary"
          onClick={share}
        >
          <Share className="h-3.5 w-3.5 text-primary" /> Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs font-bold gap-1 rounded-xl premium-depth-btn-secondary"
          onClick={reset}
        >
          <RotateCcw className="h-3.5 w-3.5 text-primary" /> New
        </Button>
      </div>
      <button
        type="button"
        onClick={() => copy(url, 'Solana Pay URL')}
        className="w-full text-[10px] font-mono text-muted-foreground break-all text-left p-2.5 rounded-xl premium-depth-inset hover:text-white transition cursor-pointer"
        title="Copy solana: URL"
      >
        {url}
      </button>
    </div>
  );
}
