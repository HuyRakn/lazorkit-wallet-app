'use client';

import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketAlertCardProps {
  alert: {
    symbol: string;
    priceUsd?: number;
    priceChange: number; // percentage change, e.g. 5.4 or -2.1
    content?: string;
    createdAt?: string;
  };
  onTradeClick?: (symbol: string) => void;
}

export function MarketAlertCard({ alert, onTradeClick }: MarketAlertCardProps) {
  const isUp = alert.priceChange >= 0;
  const changeAbs = Math.abs(alert.priceChange).toFixed(2);

  return (
    <div
      className={`glass-card rounded-xl border p-4 flex items-center justify-between gap-4 transition-all ${
        isUp
          ? 'border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/35'
          : 'border-rose-500/20 bg-rose-500/[0.02] hover:border-rose-500/35'
      }`}
    >
      <div className="flex items-center gap-3.5">
        {/* Glowing Indicator Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            isUp
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {isUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
        </div>

        {/* Content details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground bg-background/50 border border-border px-2 py-0.5 rounded">
              {alert.symbol} / USDC
            </span>
            <span
              className={`text-xs font-extrabold flex items-center ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {changeAbs}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-normal">
            {alert.content ||
              `${alert.symbol} price has moved by ${alert.priceChange > 0 ? '+' : ''}${alert.priceChange}% in the past hour.`}
          </p>
        </div>
      </div>

      {/* Trade shortcut action */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onTradeClick?.(alert.symbol)}
        className={`h-8 text-xs font-bold shrink-0 transition-all ${
          isUp
            ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
            : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
        }`}
      >
        Trade
      </Button>
    </div>
  );
}
