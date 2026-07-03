'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff, ShoppingCart, Filter, RefreshCcw, ArrowLeftRight, ExternalLink } from 'lucide-react';
import { TokenDetailModal } from './token-detail-modal';
import { useWalletStore, TokenHolding } from '@/lib/store/wallet';
import { AssetsActivity } from './assets-activity';
import { fetchCommonTokens, JupiterToken } from '@/lib/services/jupiter';
import { Button } from './ui/button';
import { TokenLogo } from './ui/token-logo';
import { motion } from 'framer-motion';
import { WalletBanner } from './wallet-banner';
import {
  formatCurrency,
  formatTokenAmount,
  formatPercentage,
} from '@/lib/utils/format';
import { useRouter } from 'next/navigation';

const ALLOC_COLORS = ['#16ffbb', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export const AssetsTab = ({ onDepositClick }: { onDepositClick?: () => void }) => {
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
      } catch (err) {
        console.error('Failed to load token data:', err);
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

  const portfolio = useMemo(() => {
    if (!tokens || tokens.length === 0) return { total: 0, allocations: [] as { symbol: string; value: number; pct: number; color: string }[] };

    let total = 0;
    const items = tokens.map((tk) => {
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

  const visibleTokens = useMemo(() => {
    const base = getVisibleTokens ? getVisibleTokens(hideZero) : (hideZero ? tokens.filter(t => t.amount > 0) : tokens);

    return [...base].sort((a, b) => {
      if (sortBy === 'change') return (b.change24hPct || 0) - (a.change24hPct || 0);
      const aPrice = tokenData.get(a.symbol)?.usdPrice ?? a.priceUsd ?? 0;
      const bPrice = tokenData.get(b.symbol)?.usdPrice ?? b.priceUsd ?? 0;
      return (b.amount * bPrice) - (a.amount * aPrice);
    });
  }, [getVisibleTokens, hideZero, tokens, sortBy, tokenData]);

  return (
    <div className='space-y-6'>

      {/* ─── Wallet Card (Main Wallet Card in place of Total Net Worth) ─── */}
      {!loading && !error && !isNoAssets && (
        <div className="space-y-4">
          <WalletBanner onDepositClick={onDepositClick} />
        </div>
      )}

      {/* ─── Assets List Container (Flat list in single card) ─── */}
      <div className="space-y-3">
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>Holdings</h3>
          <div className='flex items-center gap-2'>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'value' | 'change')}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-card/65 border border-border/40 text-muted-foreground cursor-pointer focus:outline-none hover:text-white transition-colors"
            >
              <option value="value">Sort By: Value</option>
              <option value="change">Sort By: Change</option>
            </select>
            <button
              className={`px-2.5 h-7 rounded-lg border text-[10px] font-bold items-center gap-1 hidden sm:inline-flex transition-all ${hideZero
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card/65 border-border/40 text-muted-foreground hover:text-white'
                }`}
              onClick={() => setHideZero(!hideZero)}
            >
              <Filter className='h-3 w-3' />
              {hideZero ? 'Hide Zero' : 'Show Zero'}
            </button>
          </div>
        </div>

        {/* Unified Glass Table Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl skeleton" />
                    <div className="space-y-1.5">
                      <div className="w-16 h-3.5 skeleton" />
                      <div className="w-24 h-2 skeleton" />
                    </div>
                  </div>
                  <div className="w-16 h-4 skeleton" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className='text-center py-8 px-4 bg-destructive/5 border-b border-border/10'>
              <div className='text-xs text-destructive mb-2 font-bold uppercase'>RPC Node Connection Failed</div>
              <div className='text-xs text-muted-foreground mb-4'>Unable to reach Solana Devnet. Please retry.</div>
              <Button size='sm' variant='outline' className='h-8 text-xs font-bold rounded-lg border-border/40 hover:bg-card' onClick={handleRefresh}>
                <RefreshCcw className='h-3 w-3 mr-1.5' />
                Retry Connection
              </Button>
            </div>
          )}

          {!loading && !error && isNoAssets && (
            <div className='text-center py-10 px-4 bg-card/10'>
              <div className='text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2'>No Assets Available</div>
              <div className='text-xs text-muted-foreground/60 mb-4'>This passkey wallet currently holds 0 SOL.</div>
              <Button
                size='sm'
                onClick={() => { setActiveSection('buy'); router.push('/'); }}
                className='px-4 h-9 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-all inline-flex items-center gap-1.5'
              >
                <ShoppingCart className='h-3.5 w-3.5' />
                Get Devnet Tokens
              </Button>
            </div>
          )}

          {!loading && !error && !isNoAssets && (
            <div className="divide-y divide-border/10">
              {visibleTokens.map((token) => {
                const jupiterToken = tokenData.get(token.symbol);
                const effectivePriceUsd = jupiterToken?.usdPrice ?? token.priceUsd ?? 0;
                const value = token.amount * effectivePriceUsd;
                const displayValue = fiat === 'VND' ? value * rateUsdToVnd : value;
                const change = token.change24hPct || 0;
                const ChangeIcon = change >= 0 ? TrendingUp : TrendingDown;
                const changeColor = change >= 0 ? 'text-emerald-400' : 'text-red-400';
                const allocColor = portfolio.allocations.find(a => a.symbol === token.symbol)?.color;

                return (
                  <motion.div
                    key={token.symbol}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', x: 2 }}
                    className="flex items-center justify-between p-4 cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedToken(token)}
                  >
                    {/* Left: Token Logo & Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-card/65 border border-border/30"
                        style={allocColor ? { boxShadow: `0 0 0 2px ${allocColor}20` } : undefined}
                      >
                        <TokenLogo symbol={token.symbol} jupiterIcon={jupiterToken?.icon} size={36} />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                          {token.symbol}
                          <span className="text-[9px] text-muted-foreground/60 font-medium font-mono">
                            {jupiterToken?.name || `${token.symbol} Token`}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {showBalance ? formatTokenAmount(token.amount, token.symbol) : '••••••'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Balance & Value */}
                    <div className="text-right">
                      <div className="font-extrabold text-sm text-white">
                        {showBalance ? formatCurrency(displayValue, fiat) : '••••••'}
                      </div>
                      <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 mt-0.5 ${changeColor}`}>
                        <ChangeIcon className="h-3 w-3" />
                        {showBalance ? formatPercentage(change) : '••••'}
                      </div>
                      {effectivePriceUsd > 0 && showBalance && (
                        <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
                          ${effectivePriceUsd < 0.01 ? effectivePriceUsd.toExponential(2) : effectivePriceUsd.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Trade Button */}
      {!loading && !error && !isNoAssets && (
        <div className="flex justify-center pt-1">
          <Button
            size="sm"
            onClick={() => router.push('/buy')}
            className="px-5 h-9 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md shadow-primary/10 border-0 transition-all flex items-center gap-1.5"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Quick Swap Aggregator
          </Button>
        </div>
      )}

      {/* ─── Activity Section ─── */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</h3>
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
