'use client';

import React from 'react';
import { LiveTokenPrice } from '@/lib/services/real-price-service';
import { formatCurrency, formatPercentage } from '@/lib/utils/format';
import { TokenLogo } from '@/components/ui/token-logo';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TokenRankingsProps {
  prices: Record<string, LiveTokenPrice>;
  selectedSymbol: string;
  onSelectToken: (symbol: string) => void;
}

export function TokenRankings({ prices, selectedSymbol, onSelectToken }: TokenRankingsProps) {
  const tokensList = Object.values(prices).sort((a, b) => b.change24h - a.change24h); // Sort by highest gainer

  return (
    <div className="space-y-3.5 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Solana Live Rankings</span>
        <span className="text-[9px] text-muted-foreground/60">Sorted by 24h Gainers</span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {tokensList.map((token) => {
          const isSelected = selectedSymbol === token.symbol;
          const isUp = token.change24h >= 0;

          return (
            <div
              key={token.symbol}
              onClick={() => onSelectToken(token.symbol)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                  : 'border-border/30 bg-background/25 hover:bg-background/45 hover:border-border/60'
              }`}
            >
              {/* Token Info */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg overflow-hidden border flex items-center justify-center transition-colors ${
                  isSelected ? 'border-primary/45 shadow-sm shadow-primary/10' : 'border-border/40'
                }`}>
                  <TokenLogo symbol={token.symbol} size={32} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{token.symbol}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{token.name}</span>
                </div>
              </div>

              {/* Price & Change */}
              <div className="text-right flex flex-col items-end">
                <span className="text-xs font-bold text-foreground font-mono">
                  {formatCurrency(token.priceUsd, 'USD')}
                </span>
                <span className={`text-[10px] font-black flex items-center gap-0.5 ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isUp ? '+' : ''}{token.change24h}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
