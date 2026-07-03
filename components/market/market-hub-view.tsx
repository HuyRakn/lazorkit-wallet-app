'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Star, TrendingUp, TrendingDown, Coins, Zap, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceChart } from './price-chart';
import { TokenLogo } from '@/components/ui/token-logo';
import { fetchLivePrices, LiveTokenPrice } from '@/lib/services/real-price-service';
import { formatCurrency } from '@/lib/utils/format';

interface MarketHubViewProps {
  layout?: 'full' | 'mini';
}

export function MarketHubView({ layout = 'full' }: MarketHubViewProps) {
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
      console.error('Failed to load live prices in market hub:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPrices();
    // Poll prices every 8 seconds for real-time vibe
    const interval = setInterval(() => {
      loadPrices(true);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const selectedPriceData = prices[selectedToken];
  const sortedTokens = Object.values(prices).sort((a, b) => b.change24h - a.change24h);

  if (layout === 'mini') {
    return (
      <div className="glass-card rounded-2xl border border-border/40 p-4 bg-background/25 flex flex-col space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Coins className="h-4.5 w-4.5 text-primary" />
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Top Hot Tokens</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadPrices(true)}
            disabled={refreshing}
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Refresh Prices"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[9px] text-muted-foreground">Syncing...</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-0.5">
            {sortedTokens.slice(0, 5).map((token) => {
              const isUp = token.change24h >= 0;

              return (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/20 bg-background/10 hover:bg-background/20 transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg overflow-hidden border border-border/25 flex items-center justify-center bg-white/5">
                      <TokenLogo symbol={token.symbol} size={28} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">{token.symbol}</span>
                      <span className="text-[9px] text-muted-foreground">{token.name}</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-bold text-foreground font-mono">
                      {formatCurrency(token.priceUsd, 'USD')}
                    </span>
                    <span className={`text-[9px] font-black flex items-center gap-0.5 mt-0.5 ${
                      isUp ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isUp ? '+' : ''}{token.change24h}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-fade-in">
      {/* Realtime Stats Bar */}
      {selectedPriceData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-background/50 border border-border/50 rounded-2xl p-4 md:p-5">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Selected Asset</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center">
                <TokenLogo symbol={selectedPriceData.symbol} size={20} />
              </div>
              <span className="text-sm font-extrabold text-foreground">{selectedPriceData.name} ({selectedPriceData.symbol})</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Mark Price</span>
            <span className="text-base font-extrabold text-foreground font-mono leading-none">
              {formatCurrency(selectedPriceData.priceUsd, 'USD')}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">24h Change</span>
            <span className={`text-sm font-extrabold flex items-center gap-0.5 font-mono ${
              selectedPriceData.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {selectedPriceData.change24h >= 0 ? '+' : ''}{selectedPriceData.change24h}%
              {selectedPriceData.change24h >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Est. 24h Volume</span>
            <span className="text-sm font-bold text-foreground/90 font-mono block">
              {formatCurrency(selectedPriceData.volume24h, 'USD')}
            </span>
          </div>
        </div>
      )}

      {/* Main Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Terminal Chart (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl border border-border/40 p-1 bg-background/25 overflow-hidden">
            {selectedPriceData ? (
              <PriceChart
                symbol={selectedPriceData.tradingViewSymbol}
                tokenSymbol={selectedPriceData.symbol}
                height="h-[460px]"
              />
            ) : (
              <div className="h-[460px] flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-muted-foreground">Loading Chart...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Rankings & Hot Pairs (1/3 width) */}
        <div className="space-y-5 flex flex-col justify-start">
          <div className="glass-card rounded-2xl border border-border/40 p-5 bg-background/25 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Coins className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Top Hot Tokens</span>
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
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-muted-foreground">Syncing prices...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {sortedTokens.map((token) => {
                  const isSelected = selectedToken === token.symbol;
                  const isUp = token.change24h >= 0;

                  return (
                    <div
                      key={token.symbol}
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-md shadow-primary/5'
                          : 'border-border/30 bg-background/20 hover:bg-background/40 hover:border-border/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg overflow-hidden border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-primary/40 shadow-sm shadow-primary/10' : 'border-border/30'
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
                          <span className="text-[9px] text-muted-foreground tracking-wide">{token.name}</span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs font-bold text-foreground font-mono">
                          {formatCurrency(token.priceUsd, 'USD')}
                        </span>
                        <span className={`text-[10px] font-black flex items-center gap-0.5 leading-none mt-0.5 ${
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
            )}
          </div>

          {/* RampFi Sponsored Integration Widget */}
          <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border border-primary/20 rounded-2xl p-5 relative overflow-hidden space-y-3">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-wider">
              <Award className="h-4 w-4" /> Liquidity Sponsor
            </div>
            <h4 className="text-sm font-extrabold text-foreground">Solana Jupiter Routing Ecosystem</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore dynamic pricing aggregates directly sourced from Jupiter API. Execute transactions instantly with zero-delay updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
export default MarketHubView;
