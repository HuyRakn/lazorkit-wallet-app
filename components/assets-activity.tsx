'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { EmptyState } from './ui/empty-state';
import { 
  Clock, ExternalLink, CheckCircle2, XCircle, Loader2, 
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Filter, RefreshCcw 
} from 'lucide-react';
import { useWalletStore, Activity, ActivityKind } from '@/lib/store/wallet';

/** Relative time formatter */
function timeAgo(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Get icon/color based on activity kind */
function getActivityMeta(kind: ActivityKind) {
  switch (kind) {
    case 'send':
      return { icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Sent' };
    case 'receive':
      return { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Received' };
    case 'swap':
      return { icon: ArrowLeftRight, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Swap' };
    case 'buy':
      return { icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10', label: 'Buy' };
    default:
      return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20', label: 'Transaction' };
  }
}

type FilterType = 'all' | 'send' | 'receive' | 'swap';

export function AssetsActivity() {
  const { activity, fetchTransactionHistory, pubkey } = useWalletStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // Fetch real on-chain transaction history on mount
  useEffect(() => {
    if (!pubkey) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        await fetchTransactionHistory();
      } catch (err) {
        console.warn('Failed to fetch transaction history:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pubkey, fetchTransactionHistory]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchTransactionHistory();
    } catch (err) {
      console.warn('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactionHistory, refreshing]);

  // Filter activities
  const filteredActivity = useMemo(() => {
    if (filter === 'all') return activity;
    return activity.filter(a => a.kind === filter);
  }, [activity, filter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'send', label: 'Sends' },
    { key: 'receive', label: 'Receives' },
    { key: 'swap', label: 'Swaps' },
  ];

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className='p-4 space-y-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3 animate-pulse'>
              <div className='w-8 h-8 rounded-lg bg-muted/30' />
              <div className='flex-1 space-y-1.5'>
                <div className='h-3 w-32 bg-muted/30 rounded' />
                <div className='h-2 w-20 bg-muted/20 rounded' />
              </div>
              <div className='h-3 w-16 bg-muted/20 rounded' />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'bg-muted/10 text-muted-foreground hover:bg-muted/20 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Activity List */}
      <Card className="glass-card overflow-hidden">
        <CardContent className='p-0'>
          {filteredActivity.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={filter === 'all' ? 'No transactions yet' : `No ${filter} transactions`}
              description="Your on-chain activity will appear here after your first transaction on Devnet."
              className='py-10'
            />
          ) : (
            <ul className='divide-y divide-border/30'>
              {filteredActivity.slice(0, 20).map((a) => {
                const meta = getActivityMeta(a.kind);
                const Icon = meta.icon;
                const status = (a as any).status || 'Success';
                const txSig = (a as any).txSignature;

                return (
                  <li key={a.id} className='px-4 py-3 flex items-center gap-3 hover:bg-muted/5 transition-colors group'>
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>

                    {/* Content */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-1.5'>
                        <span className='text-sm font-semibold text-foreground truncate'>
                          {meta.label}
                        </span>
                        {/* Status Badge */}
                        {status === 'Success' ? (
                          <CheckCircle2 className='w-3 h-3 text-emerald-400 shrink-0' />
                        ) : status === 'Failed' ? (
                          <XCircle className='w-3 h-3 text-red-400 shrink-0' />
                        ) : (
                          <Loader2 className='w-3 h-3 text-amber-400 animate-spin shrink-0' />
                        )}
                      </div>
                      <div className='text-xs text-muted-foreground truncate'>
                        {a.summary}
                      </div>
                    </div>

                    {/* Right side: time + explorer link */}
                    <div className='flex items-center gap-2 shrink-0'>
                      <span className='text-[10px] text-muted-foreground/60 font-mono'>
                        {timeAgo(a.ts)}
                      </span>
                      {txSig && (
                        <a
                          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                          title="View on Solana Explorer"
                        >
                          <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Explorer link */}
      {pubkey && activity.length > 0 && (
        <div className="text-center">
          <a
            href={`https://explorer.solana.com/address/${pubkey}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors font-medium"
          >
            View all on Solana Explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
