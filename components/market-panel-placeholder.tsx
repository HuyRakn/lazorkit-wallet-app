'use client';

import React from 'react';
import { TrendingUp, RefreshCw, BarChart2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/ui/token-logo';

export function MarketPanelPlaceholder() {
  const topTokens = [
    { symbol: 'SOL', name: 'Solana', price: '$148.52', change: '+5.42%', up: true },
    { symbol: 'JUP', name: 'Jupiter', price: '$0.985', change: '+8.14%', up: true },
    { symbol: 'RAY', name: 'Raydium', price: '$1.74', change: '-2.11%', up: false },
    { symbol: 'BONK', name: 'Bonk', price: '$0.000024', change: '+12.65%', up: true },
  ];

  return (
    <div className="flex flex-col gap-5 p-5 bg-sidebar h-full border-l border-sidebar-border select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-sidebar-border/40">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Market Overview</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Candlestick Chart Placeholder */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">SOL / USDC</span>
            <span className="text-[10px] text-emerald-400 font-semibold">+5.42%</span>
          </div>
          <div className="flex gap-1">
            {['1H', '4H', '1D'].map((tf, i) => (
              <span
                key={tf}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                  i === 2 ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf}
              </span>
            ))}
          </div>
        </div>

        {/* Mock Candlestick SVG - Premium rendering */}
        <div className="relative w-full h-32 bg-background/25 rounded-lg overflow-hidden border border-border/40 flex items-center justify-center">
          <svg className="w-full h-full px-2" viewBox="0 0 300 120" fill="none">
            {/* Horizontal Grid lines */}
            <line x1="0" y1="30" x2="300" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1="0" y1="90" x2="300" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

            {/* Candlesticks: Green and Red */}
            {/* Candle 1 (Green) */}
            <line x1="30" y1="50" x2="30" y2="90" stroke="#10b981" strokeWidth="1.5" />
            <rect x="25" y="60" width="10" height="20" fill="#10b981" rx="1" />

            {/* Candle 2 (Green) */}
            <line x1="70" y1="30" x2="70" y2="80" stroke="#10b981" strokeWidth="1.5" />
            <rect x="65" y="40" width="10" height="30" fill="#10b981" rx="1" />

            {/* Candle 3 (Red) */}
            <line x1="110" y1="40" x2="110" y2="95" stroke="#ef4444" strokeWidth="1.5" />
            <rect x="105" y="50" width="10" height="35" fill="#ef4444" rx="1" />

            {/* Candle 4 (Green) */}
            <line x1="150" y1="20" x2="150" y2="70" stroke="#10b981" strokeWidth="1.5" />
            <rect x="145" y="30" width="10" height="30" fill="#10b981" rx="1" />

            {/* Candle 5 (Red) */}
            <line x1="190" y1="50" x2="190" y2="100" stroke="#ef4444" strokeWidth="1.5" />
            <rect x="185" y="60" width="10" height="25" fill="#ef4444" rx="1" />

            {/* Candle 6 (Green) */}
            <line x1="230" y1="20" x2="230" y2="75" stroke="#10b981" strokeWidth="1.5" />
            <rect x="225" y="25" width="10" height="40" fill="#10b981" rx="1" />

            {/* Candle 7 (Green) */}
            <line x1="270" y1="10" x2="270" y2="50" stroke="#16ffbb" strokeWidth="1.5" />
            <rect x="265" y="15" width="10" height="25" fill="#16ffbb" rx="1" className="neon-pulse" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Hot Tokens Rankings */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Solana Trending</span>
        <div className="space-y-2">
          {topTokens.map((token) => (
            <div
              key={token.symbol}
              className="flex items-center justify-between p-2.5 rounded-xl border border-border/20 bg-background/25 hover:bg-background/40 hover:border-border/60 transition-all duration-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/40 flex items-center justify-center bg-white/5">
                  <TokenLogo symbol={token.symbol} size={32} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">{token.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">{token.name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-foreground block">{token.price}</span>
                <span className={`text-[10px] font-bold ${token.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {token.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promotional Banner (RampFi) */}
      <div className="mt-auto bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 rounded-2xl p-4 text-center space-y-2.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl pointer-events-none" />
        <span className="text-[10px] text-primary font-bold tracking-widest uppercase">Solana On-Ramp</span>
        <p className="text-xs font-bold text-foreground">Fastest Fiat-to-Crypto in Vietnam</p>
        <p className="text-[10px] text-muted-foreground">Direct bank transfer. Under 30 seconds.</p>
      </div>
    </div>
  );
}
