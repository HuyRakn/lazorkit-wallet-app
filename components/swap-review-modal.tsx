'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertCircle, Zap, Shield, Loader2, ArrowDown, CheckCircle2, Clock, ExternalLink, Route } from 'lucide-react';
import { TokenLogo } from './ui/token-logo';

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
    priceImpactPct?: string;
    routePlan?: any[];
    otherAmountThreshold?: string;
  };
  onConfirm: () => Promise<void> | void;
}

/** Countdown hook for quote expiry */
function useCountdown(seconds: number, enabled: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds, enabled]);

  return remaining;
}

export function SwapReviewModal({ open, onOpenChange, fromToken, toToken, amount, estimatedReceive, fee, quote, onConfirm }: SwapReviewModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const countdown = useCountdown(30, open && !isExecuting && !txSignature);

  // Reset state when modal opens
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
      await onConfirm();
    } catch (err: any) {
      setTxError(err?.message || 'Transaction failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const priceImpact = parseFloat(quote?.priceImpactPct || '0');
  const priceImpactLevel = priceImpact > 3 ? 'high' : priceImpact > 1 ? 'medium' : 'low';
  const routeHops = quote?.routePlan?.length || 0;

  // Extract route names from Jupiter routePlan
  const routeLabels = quote?.routePlan?.map((hop: any) => {
    const swap = hop?.swapInfo;
    return swap?.label || swap?.ammKey?.slice(0, 6) || 'Pool';
  }) || [];

  const rate = amount > 0 ? estimatedReceive / amount : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !isExecuting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md gradient-border-card border-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              Review Swap
              {countdown > 0 && !isExecuting && !txSignature && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {countdown}s
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* ── Transaction Simulation Preview ── */}
          <div className="space-y-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              This transaction will:
            </div>

            {/* FROM — Spend */}
            <div className="flex items-center justify-between p-3 rounded-t-xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center">
                  <TokenLogo symbol={fromToken} size={32} />
                </div>
                <div>
                  <div className="text-xs text-red-400 font-semibold">▼ Spend</div>
                  <div className="text-sm font-bold text-foreground">{amount.toFixed(6)} {fromToken}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">from your wallet</div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-1.5 relative z-10">
              <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center">
                <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* TO — Receive */}
            <div className="flex items-center justify-between p-3 rounded-b-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center">
                  <TokenLogo symbol={toToken} size={32} />
                </div>
                <div>
                  <div className="text-xs text-emerald-400 font-semibold">▲ Receive</div>
                  <div className="text-sm font-bold text-foreground">~{estimatedReceive.toFixed(6)} {toToken}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">estimated</div>
            </div>
          </div>

          {/* ── Route Visualization ── */}
          {routeHops > 0 && (
            <div className="p-3 rounded-xl bg-muted/10 border border-border/40 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <Route className="w-3 h-3" />
                Swap Route
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">{fromToken}</span>
                {routeLabels.map((label: string, i: number) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground text-[10px] font-medium border border-border/30">
                      {label}
                    </span>
                  </span>
                ))}
                <span className="text-muted-foreground text-xs">→</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">{toToken}</span>
              </div>
            </div>
          )}

          {/* ── Details Grid ── */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs py-1">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono text-foreground">1 {fromToken} = {rate.toFixed(6)} {toToken}</span>
            </div>

            {quote && (
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={`font-semibold ${
                  priceImpactLevel === 'high' ? 'text-red-400' : 
                  priceImpactLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {priceImpact.toFixed(2)}%
                  {priceImpactLevel === 'high' && ' ⚠️'}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs py-1">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Zap className="w-3 h-3" />
                Sponsored (Free)
              </span>
            </div>

            <div className="flex justify-between items-center text-xs py-1">
              <span className="text-muted-foreground">Route</span>
              <span className="text-foreground">{routeHops > 0 ? `${routeHops} hop${routeHops > 1 ? 's' : ''}` : 'Direct'}</span>
            </div>
          </div>

          {/* ── Price Impact Warning ── */}
          {priceImpactLevel !== 'low' && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
              priceImpactLevel === 'high' 
                ? 'bg-red-500/10 border border-red-500/20 text-red-300' 
                : 'bg-amber-500/5 border border-amber-500/20 text-amber-300'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>Price Impact Warning:</strong> This swap has a {priceImpact.toFixed(2)}% price impact. 
                {priceImpactLevel === 'high' ? ' Consider splitting into smaller orders.' : ' Proceed with caution.'}
              </p>
            </div>
          )}

          {/* ── Devnet Notice ── */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Devnet:</strong> Jupiter pricing from Mainnet. 
              On Devnet, the transaction will be simulated if liquidity pools are unavailable.
            </p>
          </div>

          {/* ── Security Footer ── */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/60 font-medium">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary/60" />
              Passkey Signed
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400/60" />
              Jupiter API
            </span>
            <span>•</span>
            <span>Solana Devnet</span>
          </div>

          {/* ── Confirm Button ── */}
          <Button 
            className={`w-full h-12 font-bold rounded-xl transition-all shadow-lg ${
              countdown === 0 && !isExecuting
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
            }`}
            onClick={countdown === 0 && !isExecuting ? () => onOpenChange(false) : handleConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing via Passkey...</span>
              </div>
            ) : countdown === 0 ? (
              <span>Quote Expired — Close</span>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Swap</span>
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
