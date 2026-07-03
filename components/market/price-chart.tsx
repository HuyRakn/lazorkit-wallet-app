'use client';

import React, { useState, useEffect } from 'react';
import { BarChart2, Calendar } from 'lucide-react';

interface PriceChartProps {
  symbol: string; // TradingView Symbol (e.g. COINBASE:SOLUSD)
  tokenSymbol: string; // Display symbol (e.g. SOL)
  height?: string; // Optional custom height class (e.g. h-[300px])
}

type Timeframe = '1H' | '4H' | '1D' | '1W';

const TIMEFRAME_INTERVALS: Record<Timeframe, string> = {
  '1H': '60',
  '4H': '240',
  '1D': 'D',
  '1W': 'W',
};

export function PriceChart({ symbol, tokenSymbol, height = 'h-[220px]' }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [iframeUrl, setIframeUrl] = useState('');

  useEffect(() => {
    const interval = TIMEFRAME_INTERVALS[timeframe];
    // Encode symbol safely
    const encodedSymbol = encodeURIComponent(symbol);
    const url = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodedSymbol}&interval=${interval}&hidesidetoolbar=1&symboledit=0&saveimage=1&toolbarbg=1a1b23&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FHo_Chi_Minh&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=rampfi&utm_medium=widget&utm_campaign=chart`;
    setIframeUrl(url);
  }, [symbol, timeframe]);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3.5 select-none lg:h-full lg:flex lg:flex-col">
      {/* Header Info */}
      <div className="flex items-center justify-between font-sans">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
            {tokenSymbol.slice(0, 2)}
          </div>
          <span className="text-xs font-bold text-foreground">{tokenSymbol} / USD</span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide">TradingView Live</span>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1 bg-background/60 p-0.5 rounded-lg border border-border/40">
          {(Object.keys(TIMEFRAME_INTERVALS) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`text-[9px] font-extrabold px-2 py-1 rounded-md transition-all duration-150 ${
                timeframe === tf
                  ? 'bg-primary text-black font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView Widget Iframe wrapper */}
      <div className={`relative w-full ${height} bg-[#131722]/80 rounded-lg overflow-hidden lg:flex-1`}>
        {iframeUrl ? (
          <iframe
            id="tradingview_chart"
            name="tradingview_chart"
            src={iframeUrl}
            className="w-full h-full border-0"
            allowFullScreen
            scrolling="no"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Loading Chart...
          </div>
        )}
        {/* Subtle decorative edge shadows to fit dark UI */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
