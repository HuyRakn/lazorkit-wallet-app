'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertCircle, Zap, Shield, Loader2, ArrowDown, CheckCircle2, ExternalLink, Route } from 'lucide-react';
import { TokenLogo } from './ui/token-logo';
import { explorerTxUrl } from '@/lib/utils/explorer';

interface SwapReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromToken: string;
  toToken: string;
  amount: number;
  estimatedReceive: number;
  fee: number;
  quote?: {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    priceImpactPct?: string | number;
    routePlan?: any[];
    otherAmountThreshold?: string;
    dex?: string;
    minOutAmount?: string;
    outDecimals?: number;
    feeRatePct?: number;
  };
  /** Resolves with the transaction signature once the swap lands on-chain. */
  onConfirm: () => Promise<string | void> | string | void;
}

/** Countdown hook for quote expiry */
function useCountdown(seconds: number, enabled: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [seconds, enabled]);

  return remaining;
}

export function SwapReviewModal({
  open,
  onOpenChange,
  fromToken,
  toToken,
  amount,
  estimatedReceive,
  quote,
  onConfirm,
}: SwapReviewModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const countdown = useCountdown(30, open && !isExecuting && !txSignature);

  useEffect(() => {
    if (open) {
      setTxSignature(null);
      setTxError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsExecuting(true);
    setTxError(null);
    try {
      const signature = await onConfirm();
      if (typeof signature === 'string') setTxSignature(signature);
    } catch (err: any) {
      setTxError(err?.message || 'Transaction failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const priceImpact = Number(quote?.priceImpactPct ?? 0) || 0;
  const priceImpactLevel = priceImpact > 3 ? 'high' : priceImpact > 1 ? 'medium' : 'low';
  const isRaydium = quote?.dex === 'raydium-cpmm';

  const routeLabels: string[] = isRaydium
    ? ['Raydium CPMM']
    : quote?.routePlan?.map((hop: any) => {
        const swap = hop?.swapInfo;
        return swap?.label || swap?.ammKey?.slice(0, 6) || 'Pool';
      }) || [];
  const routeHops = routeLabels.length;
  const minReceived =
    quote?.minOutAmount && quote.outDecimals != null
      ? Number(quote.minOutAmount) / 10 ** quote.outDecimals
      : null;

  const rate = amount > 0 ? estimatedReceive / amount : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !isExecuting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border border-white/12 bg-[#0b0d15]/95 backdrop-blur-2xl flex flex-col max-h-[88vh]">
        {/* Top Accent Line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-purple-500 shrink-0" />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2.5 text-white">
              <span>Review Swap</span>
              {countdown > 0 && !isExecuting && !txSignature && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  {countdown}s
                </span>
              )}
              <span className="ml-auto mr-7 text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {isRaydium ? 'Raydium CPMM' : 'Devnet'}
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          {/* Spend / Receive Stack */}
          <div className="space-y-0">
            {/* FROM — Spend */}
            <div className="flex items-center justify-between p-3 rounded-t-xl bg-rose-500/[0.06] border border-rose-500/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                  <TokenLogo symbol={fromToken} size={28} />
                </div>
                <div>
                  <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">▼ You Pay</div>
                  <div className="text-sm font-extrabold text-white font-mono">
                    {amount.toFixed(6)} {fromToken}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground bg-white/[0.03] px-2 py-0.5 rounded border border-white/5">
                Wallet
              </span>
            </div>

            {/* Arrow Divider */}
            <div className="flex justify-center -my-2 relative z-10">
              <div className="w-6 h-6 rounded-full bg-[#111522] border border-white/15 flex items-center justify-center shadow-md">
                <ArrowDown className="w-3 h-3 text-primary" />
              </div>
            </div>

            {/* TO — Receive */}
            <div className="flex items-center justify-between p-3 rounded-b-xl bg-emerald-500/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                  <TokenLogo symbol={toToken} size={28} />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">▲ You Receive</div>
                  <div className="text-sm font-extrabold text-white font-mono">
                    ~{estimatedReceive.toFixed(6)} {toToken}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Estimated
              </span>
            </div>
          </div>

          {/* Swap Route Pill */}
          {routeHops > 0 && (
            <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.07] flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                <Route className="w-3 h-3 text-primary" />
                Route
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                  {fromToken}
                </span>
                {routeLabels.map((label: string, i: number) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/80 text-[10px] font-medium border border-white/10">
                      {label}
                    </span>
                  </span>
                ))}
                <span className="text-muted-foreground text-[10px]">→</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                  {toToken}
                </span>
              </div>
            </div>
          )}

          {/* Compact Details Box */}
          <div className="p-3 rounded-xl premium-depth-inset space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Exchange Rate</span>
              <span className="font-mono font-semibold text-white">
                1 {fromToken} = {rate.toFixed(6)} {toToken}
              </span>
            </div>

            {minReceived != null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Minimum Received</span>
                <span className="font-mono font-semibold text-white">
                  {minReceived.toFixed(6)} {toToken}
                </span>
              </div>
            )}

            {quote && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Price Impact</span>
                <span
                  className={`font-mono font-bold ${
                    priceImpactLevel === 'high'
                      ? 'text-rose-400'
                      : priceImpactLevel === 'medium'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {priceImpact.toFixed(2)}%{priceImpactLevel === 'high' && ' ⚠️'}
                </span>
              </div>
            )}

            {quote?.feeRatePct != null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">LP Pool Fee</span>
                <span className="font-mono text-white/90">{quote.feeRatePct}%</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Network Gas</span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Zap className="w-3 h-3" />
                Sponsored (Free)
              </span>
            </div>
          </div>

          {/* Price Impact Warning (only when elevated) */}
          {priceImpactLevel !== 'low' && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] ${
                priceImpactLevel === 'high'
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>Price Impact ({priceImpact.toFixed(2)}%):</strong>{' '}
                {priceImpactLevel === 'high' ? 'Consider smaller trade size.' : 'Pool reserve impact on Devnet.'}
              </span>
            </div>
          )}

          {/* On-Chain Result or Error */}
          {txSignature && (
            <a
              href={explorerTxUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Swap confirmed on-chain
              </span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                {txSignature.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          )}

          {txError && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="break-words">{txError}</p>
            </div>
          )}
        </div>

        {/* Sticky Footer with Confirm Button */}
        <div className="px-5 pt-3 pb-4 border-t border-white/[0.06] bg-black/20 space-y-2.5 shrink-0">
          <Button
            className={`w-full h-11 font-extrabold rounded-xl transition-all text-xs uppercase tracking-wider ${
              countdown === 0 && !isExecuting && !txSignature
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'premium-depth-btn'
            }`}
            onClick={
              txSignature || (countdown === 0 && !isExecuting)
                ? () => onOpenChange(false)
                : handleConfirm
            }
            disabled={isExecuting}
          >
            {isExecuting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing with Passkey...</span>
              </div>
            ) : txSignature ? (
              <span>Done</span>
            ) : countdown === 0 ? (
              <span>Quote Expired — Refresh</span>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Swap</span>
              </div>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2.5 text-[10px] text-muted-foreground/70 font-medium">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary/70" />
              Passkey P-256
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400/70" />
              {isRaydium ? 'Raydium CPMM Pool' : 'Jupiter Route'}
            </span>
            <span>•</span>
            <span>Solana Devnet</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
