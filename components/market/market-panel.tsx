'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceChart } from './price-chart';
import { TokenRankings } from './token-rankings';
import { fetchLivePrices, LiveTokenPrice } from '@/lib/services/real-price-service';

export function MarketPanel() {
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [prices, setPrices] = useState<Record<string, LiveTokenPrice>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPrices = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      
      const data = await fetchLivePrices();
      setPrices(data);
    } catch (e) {
      console.error('Failed to load live prices in market panel:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Poll prices every 10 seconds
  useEffect(() => {
    loadPrices();
    const interval = setInterval(() => {
      loadPrices(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectedPriceData = prices[selectedToken];

  return (
    <div className="flex flex-col gap-5 p-5 bg-sidebar h-full border-l border-sidebar-border select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-sidebar-border/40">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-bold text-foreground">Market Hub</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => loadPrices(true)}
          disabled={refreshing}
          className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Refresh Prices"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-muted-foreground">Fetching Live Data...</span>
        </div>
      ) : (
        <>
          {/* 1. Candlestick Price Chart */}
          {selectedPriceData && (
            <PriceChart
              symbol={selectedPriceData.tradingViewSymbol}
              tokenSymbol={selectedPriceData.symbol}
            />
          )}

          {/* 2. Token Rankings */}
          <TokenRankings
            prices={prices}
            selectedSymbol={selectedToken}
            onSelectToken={setSelectedToken}
          />

          {/* 3. RampFi Promo Card */}
          <div className="mt-auto bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border border-primary/20 rounded-2xl p-4 text-center space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl pointer-events-none" />
            <span className="text-[9px] text-primary font-bold tracking-widest uppercase block">Gateway Sponsored</span>
            <p className="text-xs font-bold text-foreground">Fastest Fiat Gateway in Vietnam</p>
            <p className="text-[10px] text-muted-foreground">Direct bank transfer. Under 30 seconds.</p>
          </div>
        </>
      )}
    </div>
  );
}
export default MarketPanel;
