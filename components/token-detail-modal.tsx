'use client';

import { TrendingUp, TrendingDown, Send, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { TokenLogo } from './ui/token-logo';
import { ViewportModal } from './ui/viewport-modal';
import { Card, CardContent } from './ui/card';
import { CopyButton } from './ui/copy-button';
import { TokenHolding } from '@/lib/store/wallet';
import {
  formatCurrency,
  formatTokenAmount,
  formatPercentage,
} from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { generateSparkline } from '@/lib/utils/price';
import { Sparkline } from './ui/sparkline';

interface TokenDetailModalProps {
  token: TokenHolding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TokenDetailModal = ({
  token,
  open,
  onOpenChange,
}: TokenDetailModalProps) => {
  const value = token.amount * token.priceUsd;
  const ChangeIcon = token.change24hPct >= 0 ? TrendingUp : TrendingDown;
  const changeColor =
    token.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-500';
  const spark = generateSparkline(token.symbol + token.mint, 14, token.priceUsd, 0.04);

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${token.symbol} Token Details`}
      className="max-w-md"
    >
      {/* Header Info */}
      <div className="px-6 pt-2 flex items-center space-x-3.5">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-slate-900 border border-white/10 p-1">
          <TokenLogo symbol={token.symbol} size={40} />
        </div>
        <div>
          <h3 className="font-extrabold text-base text-white">{token.symbol}</h3>
          <p className="text-xs text-muted-foreground">{t('token.solanaToken')}</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Balance Card with Glassmorphism */}
        <div className="glass-card border border-white/5 bg-slate-900/40 p-5 rounded-2xl">
          <div className="text-center space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider block">Your Balance</span>
            <div className="text-2xl font-extrabold text-white">
              {formatTokenAmount(token.amount, token.symbol)}
            </div>
            <div className="text-base font-semibold text-muted-foreground font-mono">
              {formatCurrency(value)}
            </div>
            <div className={`text-xs flex items-center justify-center font-bold ${changeColor}`}>
              <ChangeIcon className="h-3.5 w-3.5 mr-1" />
              {formatPercentage(token.change24hPct)} (24h)
            </div>
          </div>
        </div>

        {/* Token Info List */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-muted-foreground">{t('common.price')}</span>
            <span className="font-extrabold text-white">
              {formatCurrency(token.priceUsd)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-muted-foreground">{t('token.marketCap')}</span>
            <span className="font-extrabold text-muted-foreground/60">—</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-muted-foreground">{t('token.totalSupply')}</span>
            <span className="font-extrabold text-white">
              {token.totalSupply ? token.totalSupply.toLocaleString() : '—'}
            </span>
          </div>

          {/* Sparkline Graph */}
          <div className="pt-3 pb-1">
            <Sparkline data={spark} />
            <span className="text-[9px] text-muted-foreground/60 mt-1 block text-right">7d trend (Devnet)</span>
          </div>
        </div>

        {/* Mint Address Box */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">
            {t('token.mintAddress')}
          </span>
          <div className="flex items-center gap-2 p-2 px-3 bg-slate-950/60 border border-white/10 rounded-xl">
            <div className="flex-1 text-xs font-mono text-muted-foreground break-all leading-relaxed">
              {token.mint}
            </div>
            <CopyButton text={token.mint} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            className="h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            <Send className="mr-2 h-4 w-4" />
            {t('wallet.send')}
          </Button>
          <Button
            className="h-11 bg-primary text-slate-950 hover:bg-primary/90 font-extrabold rounded-xl shadow-lg shadow-primary/10"
            onClick={() => onOpenChange(false)}
          >
            <Plus className="mr-2 h-4 w-4 fill-slate-950" />
            {t('wallet.deposit')}
          </Button>
        </div>
      </div>
    </ViewportModal>
  );
};
