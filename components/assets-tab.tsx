'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff, ShoppingCart, Filter, RefreshCcw, ArrowLeftRight, PieChart, ExternalLink } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { TokenDetailModal } from './token-detail-modal';
import { useWalletStore, TokenHolding } from '@/lib/store/wallet';
import { AssetsActivity } from './assets-activity';
import { fetchCommonTokens, JupiterToken, TOKEN_ADDRESSES } from '@/lib/services/jupiter';
import { Button } from './ui/button';
import { TokenLogo } from './ui/token-logo';
import {
  formatCurrency,
  formatTokenAmount,
  formatPercentage,
} from '@/lib/utils/format';
import { useRouter } from 'next/navigation';

// Allocation colors
const ALLOC_COLORS = ['#16ffbb', '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export const AssetsTab = () => {
  const { tokens, fiat, rateUsdToVnd, hasAssets, hasNoAssets, getVisibleTokens, pubkey, refreshBalances, setActiveSection } = useWalletStore();
  const router = useRouter();
  const [showBalance, setShowBalance] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TokenHolding | null>(null);
  const [tokenData, setTokenData] = useState<Map<string, JupiterToken>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideZero, setHideZero] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'value' | 'change'>('value');
  const [refreshing, setRefreshing] = useState(false);
  const isNoAssets = hasNoAssets ? hasNoAssets() : (!hasAssets ? tokens.length === 0 : !hasAssets());

  // Fetch token data on mount and when pubkey changes
  useEffect(() => {
    const loadTokenData = async () => {
      try {
        setLoading(true);
        setError(null);
        const jupiterTokens = await fetchCommonTokens();
        setTokenData(jupiterTokens);
        if (pubkey && refreshBalances) {
          await refreshBalances();
        }
      } catch (error) {
        console.error('Failed to load token data:', error);
        setError('failed');
      } finally {
        setLoading(false);
      }
    };
    loadTokenData();
  }, [pubkey, refreshBalances]);

  useEffect(() => {
    if (hasAssets && hasAssets()) {
      setHideZero(true);
    }
  }, [hasAssets]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const jupiterTokens = await fetchCommonTokens();
      setTokenData(jupiterTokens);
      if (pubkey && refreshBalances) {
        await refreshBalances();
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [pubkey, refreshBalances, refreshing]);

  // Calculate portfolio metrics from real data
  const portfolio = useMemo(() => {
    if (!tokens || tokens.length === 0) return { total: 0, allocations: [] as { symbol: string; value: number; pct: number; color: string }[] };

    let total = 0;
    const items = tokens.map((tk, i) => {
      const jup = tokenData.get(tk.symbol);
      const price = jup?.usdPrice ?? tk.priceUsd ?? 0;
      const value = tk.amount * price;
      total += value;
      return { symbol: tk.symbol, value, change: tk.change24hPct || 0 };
    });

    const allocations = items
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((item, i) => ({
        symbol: item.symbol,
        value: item.value,
        pct: total > 0 ? (item.value / total) * 100 : 0,
        color: ALLOC_COLORS[i % ALLOC_COLORS.length],
      }));

    return { total, allocations };
  }, [tokens, tokenData]);

  const displayTotal = fiat === 'VND' ? portfolio.total * rateUsdToVnd : portfolio.total;

  // Sort tokens
  const visibleTokens = useMemo(() => {
    const base = getVisibleTokens ? getVisibleTokens(hideZero) : (hideZero ? tokens.filter(t => t.amount > 0) : tokens);

    return [...base].sort((a, b) => {
      if (sortBy === 'change') return (b.change24hPct || 0) - (a.change24hPct || 0);
      // sort by value
      const aPrice = tokenData.get(a.symbol)?.usdPrice ?? a.priceUsd ?? 0;
      const bPrice = tokenData.get(b.symbol)?.usdPrice ?? b.priceUsd ?? 0;
      return (b.amount * bPrice) - (a.amount * aPrice);
    });
  }, [getVisibleTokens, hideZero, tokens, sortBy, tokenData]);

  return (
    <div className='space-y-4'>
      {/* ─── Portfolio Overview ─── */}
      {!loading && !error && !isNoAssets && (
        <div className="gradient-border-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Portfolio Value</div>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono stat-value mt-1">
                {showBalance ? formatCurrency(displayTotal, fiat) : '••••••'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground transition-colors"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                className='p-2 rounded-lg hover:bg-muted/20 text-muted-foreground transition-colors'
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
          </div>

          {/* Allocation Bar */}
          {portfolio.allocations.length > 0 && showBalance && (
            <div className="space-y-2">
              {/* Stacked progress bar */}
              <div className="h-2 rounded-full overflow-hidden flex bg-muted/20">
                {portfolio.allocations.map((alloc) => (
                  <div
                    key={alloc.symbol}
                    className="h-full transition-all duration-500"
                    style={{ width: `${alloc.pct}%`, backgroundColor: alloc.color }}
                    title={`${alloc.symbol}: ${alloc.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {portfolio.allocations.map((alloc) => (
                  <div key={alloc.symbol} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: alloc.color }} />
                    <span className="font-semibold text-foreground">{alloc.symbol}</span>
                    <span>{alloc.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explorer link */}
          {pubkey && (
            <a
              href={`https://explorer.solana.com/address/${pubkey}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors font-medium"
            >
              View on Solana Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* ─── Header ─── */}
      <div className='flex items-center justify-between'>
        <h3 className='text-base font-bold'>Assets</h3>
        <div className='flex items-center gap-2'>
          {/* Sort toggle */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'value' | 'change')}
            className="text-[10px] px-2 py-1 rounded-md bg-muted/20 border border-border/30 text-muted-foreground cursor-pointer focus:outline-none"
          >
            <option value="value">By Value</option>
            <option value="change">By 24h Change</option>
          </select>
          <button
            className={`px-2 h-7 rounded-md border text-xs items-center gap-1 hidden sm:inline-flex ${hideZero ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted/20 border-border/30 text-muted-foreground'}`}
            onClick={() => setHideZero(!hideZero)}
          >
            <Filter className='h-3.5 w-3.5' />
            {hideZero ? 'Non-zero' : 'All'}
          </button>
          <button
            className='p-2 rounded-md hover:bg-muted/20 text-muted-foreground'
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
          </button>
        </div>
      </div>

      {/* ─── Token List ─── */}
      <div className='space-y-2'>
        {loading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='h-16 rounded-lg bg-muted/30 smooth-loading' />
            ))}
          </>
        )}

        {!loading && error && (
          <div className='text-center py-10 border rounded-lg bg-destructive/5 border-destructive/40'>
            <div className='text-sm text-destructive mb-3'>Error</div>
            <div className='text-xs text-muted-foreground mb-4'>Failed to load token metadata</div>
            <Button size='sm' variant='outline' className='inline-flex items-center gap-1' onClick={handleRefresh}>
              <RefreshCcw className='h-4 w-4' />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && isNoAssets && (
          <div className='text-center py-10 border rounded-lg bg-muted/20'>
            <div className='text-sm text-muted-foreground mb-3'>No assets found</div>
            <div className='text-xs text-muted-foreground mb-4'>Purchase tokens or receive a transfer to get started.</div>
            <Button
              size='sm'
              onClick={() => { setActiveSection('buy'); router.push('/'); }}
              className='px-4 h-9 rounded-full text-sm font-medium text-black bg-[#16ffbb] hover:bg-[#16ffbb]/90 shadow-[0_6px_16px_rgba(22,255,187,0.18)] border-0 transition-all inline-flex items-center gap-2'
            >
              <ShoppingCart className='h-4 w-4 text-black' />
              Buy Crypto
            </Button>
          </div>
        )}

        {!loading && !error && visibleTokens.map((token, i) => {
          const jupiterToken = tokenData.get(token.symbol);
          const effectivePriceUsd = jupiterToken?.usdPrice ?? token.priceUsd ?? 0;
          const value = token.amount * effectivePriceUsd;
          const displayValue = fiat === 'VND' ? value * rateUsdToVnd : value;
          const change = token.change24hPct || 0;
          const ChangeIcon = change >= 0 ? TrendingUp : TrendingDown;
          const changeColor = change >= 0 ? 'text-emerald-400' : 'text-red-400';
          const allocColor = portfolio.allocations.find(a => a.symbol === token.symbol)?.color;

          return (
            <Card
              key={token.symbol}
              className='cursor-pointer hover:border-primary/20 transition-all duration-200 glass-card'
              onClick={() => setSelectedToken(token)}
            >
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    {/* Token icon with allocation color ring */}
                    <div className='relative'>
                      <div 
                        className='w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-muted/20'
                        style={allocColor ? { boxShadow: `0 0 0 2px ${allocColor}30` } : undefined}
                      >
                        <TokenLogo symbol={token.symbol} jupiterIcon={jupiterToken?.icon} size={40} />
                      </div>
                    </div>

                    <div>
                      <div className='font-bold text-sm text-foreground'>{token.symbol}</div>
                      <div className='text-xs text-muted-foreground'>
                        {jupiterToken?.name || `${token.symbol} Token`}
                      </div>
                      <div className='text-[10px] text-muted-foreground/60 font-mono'>
                        {showBalance ? formatTokenAmount(token.amount, token.symbol) : '••••••'}
                      </div>
                    </div>
                  </div>

                  <div className='text-right'>
                    <div className='font-bold text-sm'>
                      {showBalance ? formatCurrency(displayValue, fiat) : '••••••'}
                    </div>
                    <div className={`text-xs flex items-center justify-end gap-0.5 ${changeColor}`}>
                      <ChangeIcon className='h-3 w-3' />
                      {showBalance ? formatPercentage(change) : '••••'}
                    </div>
                    {/* Live price */}
                    {effectivePriceUsd > 0 && showBalance && (
                      <div className='text-[10px] text-muted-foreground/40 font-mono mt-0.5'>
                        ${effectivePriceUsd < 0.01 ? effectivePriceUsd.toExponential(2) : effectivePriceUsd.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Swap Button ─── */}
      {!loading && !error && !isNoAssets && (
        <div className='pt-2'>
          <div className='flex justify-center'>
            <Button
              size='sm'
              onClick={() => router.push('/buy')}
              className='px-5 h-9 rounded-full text-sm font-medium text-black bg-[#16ffbb] hover:bg-[#16ffbb]/90 shadow-[0_6px_16px_rgba(22,255,187,0.18)] border-0 transition-all'
            >
              <ArrowLeftRight className='h-4 w-4 mr-1.5 text-black' />
              Trade
            </Button>
          </div>
        </div>
      )}

      {/* ─── Activity Section ─── */}
      <div className="pt-2">
        <h3 className="text-base font-bold mb-3">Recent Activity</h3>
        <AssetsActivity />
      </div>

      {/* Token Detail Modal */}
      {selectedToken && (
        <TokenDetailModal
          token={selectedToken}
          open={!!selectedToken}
          onOpenChange={(open) => !open && setSelectedToken(null)}
        />
      )}
    </div>
  );
};
