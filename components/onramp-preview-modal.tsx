'use client';

import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Fiat, TokenSym } from '@/lib/store/wallet';
import { formatCurrency } from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { TokenLogo } from './ui/token-logo';

export interface OnRampPreviewData {
  fromCurrency: Fiat;
  toToken: TokenSym;
  amount: number; // USD-equivalent
}

interface OnRampPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: OnRampPreviewData;
  onConfirm: () => Promise<void> | void;
}

export function OnRampPreviewModal({
  open,
  onOpenChange,
  data,
  onConfirm,
}: OnRampPreviewModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const breakdown = useMemo(() => {
    const subtotal = data.amount;
    const fee = 1.0; // Fixed $1 fee for all transactions
    const network = 0.0; // Sponsored
    const total = Number((subtotal + fee).toFixed(2));
    return { subtotal, fee, network, total };
  }, [data.amount]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border border-white/12 bg-[#0b0d15]/95 backdrop-blur-2xl">
        <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-purple-500" />

        <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>{t('onRamp.preview')}</span>
              <span className="ml-auto mr-7 text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                VietQR / Napas
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Receiving Token Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center">
                <TokenLogo symbol={data.toToken} size={28} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Receiving Asset
                </div>
                <div className="text-sm font-extrabold text-white">{data.toToken} on Solana</div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-white">
              {formatCurrency(breakdown.subtotal, 'USD')}
            </span>
          </div>

          {/* Breakdown Card */}
          <div className="p-3.5 rounded-xl premium-depth-inset space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Order Subtotal</span>
              <span className="font-mono text-white">{formatCurrency(breakdown.subtotal, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gateway Processing Fee</span>
              <span className="font-mono text-white">{formatCurrency(breakdown.fee, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Solana Network Gas</span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Zap className="w-3 h-3" /> Sponsored ($0.00)
              </span>
            </div>
            <div className="h-px bg-white/10 my-1" />
            <div className="flex justify-between items-center text-sm font-extrabold">
              <span className="text-white">{t('common.total')}</span>
              <span className="font-mono text-primary">{formatCurrency(breakdown.total, 'USD')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>Tokens are transferred directly from the RampFi treasury once payment is confirmed.</span>
          </div>

          <Button
            className="w-full h-11 premium-depth-btn rounded-xl text-xs uppercase tracking-wider font-extrabold"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {t('onRamp.confirmPay')}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
