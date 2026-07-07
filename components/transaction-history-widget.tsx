'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useWalletStore } from '@/lib/store/wallet';
import { ExternalLink, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Sparkles, History } from 'lucide-react';

export function TransactionHistoryWidget() {
  const { activity, pubkey } = useWalletStore();
  const recentTx = (activity || []).slice(0, 10);

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getIcon = (kind: string) => {
    switch (kind) {
      case 'send': return <ArrowUpRight className="h-4 w-4" />;
      case 'swap': return <ArrowLeftRight className="h-4 w-4" />;
      case 'onramp': return <ArrowDownLeft className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getColor = (kind: string) => {
    switch (kind) {
      case 'send': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'swap': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'onramp': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  if (!pubkey) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Recent Transactions</h3>
        {recentTx.length > 0 && (
          <span className="text-[9px] font-bold text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded-full">
            {recentTx.length}
          </span>
        )}
      </div>

      {recentTx.length === 0 ? (
        <div className="glass-card rounded-xl border border-border/40 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-muted/10 border border-border/30 flex items-center justify-center mx-auto">
            <History className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <p className="text-xs text-muted-foreground">No transactions yet. Send or swap tokens to see activity here.</p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.04 } },
          }}
          className="space-y-2"
        >
          {recentTx.map((tx: any, idx: number) => (
            <motion.div
              key={tx.id || idx}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              className="glass-card rounded-xl border border-border/40 p-3.5 flex items-center justify-between hover:border-primary/15 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${getColor(tx.kind)}`}>
                  {getIcon(tx.kind)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">{tx.summary}</span>
                  <span className="text-[9px] text-muted-foreground">{formatTimeAgo(tx.ts)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tx.status && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    tx.status === 'Success' ? 'bg-emerald-500/10 text-emerald-400' :
                    tx.status === 'Failed' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {tx.status}
                  </span>
                )}
                {tx.txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${tx.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/30 group-hover:text-primary/50 transition"
                    title="View on Solana Explorer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
