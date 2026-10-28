'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Coins,
  Compass,
  Copy,
  CreditCard,
  Droplets,
  ExternalLink,
  Home,
  Image as ImageIcon,
  QrCode,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { claimFaucet } from '@/lib/services/backend-api';
import { toast } from '@/hooks/use-toast';
import { explorerAddressUrl } from '@/lib/utils/explorer';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSectionChange: (section: string) => void;
  onSendClick: () => void;
  onDepositClick: () => void;
}

interface CommandItem {
  id: string;
  group: 'Quick Actions' | 'Navigation';
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSectionChange,
  onSendClick,
  onDepositClick,
}: CommandPaletteProps) {
  const { pubkey, refreshBalances, addActivity } = useWalletStore();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const items: CommandItem[] = useMemo(() => {
    const closeAnd = (fn: () => void | Promise<void>) => async () => {
      onOpenChange(false);
      await fn();
    };

    return [
      {
        id: 'act-swap',
        group: 'Quick Actions',
        label: 'Swap SOL ↔ rUSDC on Raydium CPMM',
        subtitle: 'Execute instant gasless AMM swaps on Solana Devnet',
        icon: ArrowLeftRight,
        badge: 'Gasless',
        shortcut: 'S',
        action: closeAnd(() => onSectionChange('buy')),
      },
      {
        id: 'act-send',
        group: 'Quick Actions',
        label: 'Send Tokens (Passkey / Quick Pay)',
        subtitle: 'Transfer SOL or rUSDC with 0 gas fees',
        icon: Send,
        badge: 'Instant',
        shortcut: 'T',
        action: closeAnd(() => onSendClick()),
      },
      {
        id: 'act-receive',
        group: 'Quick Actions',
        label: 'Receive & Create Solana Pay QR',
        subtitle: 'Display your Smart Vault QR or request a specific amount',
        icon: QrCode,
        badge: 'Solana Pay',
        shortcut: 'R',
        action: closeAnd(() => onDepositClick()),
      },
      {
        id: 'act-faucet',
        group: 'Quick Actions',
        label: 'Claim Devnet Faucet (+0.5 SOL & +100 rUSDC)',
        subtitle: 'Airdrop test funds directly from the RampFi treasury',
        icon: Droplets,
        badge: 'Free',
        shortcut: 'F',
        action: closeAnd(async () => {
          if (!pubkey) return;
          try {
            toast({ title: 'Requesting Devnet Faucet…', description: 'Dispensing 0.5 SOL + 100 rUSDC to your vault.' });
            const res = await claimFaucet(pubkey);
            const sig = res.usdc.signature || res.sol.signature;
            addActivity?.({
              id: sig || `faucet-${Date.now()}`,
              kind: 'receive',
              ts: new Date().toISOString(),
              summary: `Faucet: +${res.sol.amount} SOL, +${res.usdc.amount} USDC`,
              amount: res.usdc.amount,
              token: 'USDC',
              status: 'Success',
              txSignature: sig,
            });
            toast({
              title: '✅ Faucet funds received!',
              description: `+${res.sol.amount} SOL and +${res.usdc.amount} rUSDC landed in your wallet.`,
            });
            setTimeout(() => refreshBalances?.().catch(() => {}), 1500);
          } catch (err: any) {
            toast({
              title: 'Faucet cooldown or error',
              description: err?.message || 'Could not claim faucet right now.',
              variant: 'destructive',
            });
          }
        }),
      },
      {
        id: 'act-stake',
        group: 'Quick Actions',
        label: 'Stake SOL for ~6.8% APY',
        subtitle: 'Delegate native SOL to Devnet validators via seed PDA',
        icon: Coins,
        badge: '~6.8% APY',
        action: closeAnd(() => onSectionChange('stake')),
      },
      {
        id: 'act-copy-address',
        group: 'Quick Actions',
        label: 'Copy Smart Wallet Address',
        subtitle: pubkey ? `${pubkey.slice(0, 12)}…${pubkey.slice(-12)}` : 'No wallet connected',
        icon: Copy,
        shortcut: 'C',
        action: closeAnd(async () => {
          if (!pubkey) return;
          await navigator.clipboard.writeText(pubkey);
          toast({ title: 'Address Copied', description: pubkey });
        }),
      },
      {
        id: 'act-explorer',
        group: 'Quick Actions',
        label: 'View Smart Vault on Solana Explorer',
        subtitle: 'Inspect on-chain PDA state, token accounts, and history',
        icon: ExternalLink,
        action: closeAnd(() => {
          if (pubkey) window.open(explorerAddressUrl(pubkey), '_blank', 'noopener,noreferrer');
        }),
      },
      {
        id: 'nav-home',
        group: 'Navigation',
        label: 'Home & Live On-Chain Feed',
        subtitle: 'Ecosystem pulse, live Devnet activity, and quick portfolio',
        icon: Home,
        action: closeAnd(() => onSectionChange('home')),
      },
      {
        id: 'nav-market',
        group: 'Navigation',
        label: 'Market Hub & Analytics',
        subtitle: 'Real-time Solana token prices, charts, and 24h movers',
        icon: BarChart3,
        action: closeAnd(() => onSectionChange('market')),
      },
      {
        id: 'nav-buy',
        group: 'Navigation',
        label: 'Buy & Swap Studio',
        subtitle: 'VietQR fiat on-ramp and Raydium CPMM token swaps',
        icon: CreditCard,
        action: closeAnd(() => onSectionChange('buy')),
      },
      {
        id: 'nav-send',
        group: 'Navigation',
        label: 'Transfers & Full Portfolio',
        subtitle: 'Asset allocation, holdings breakdown, and transaction history',
        icon: ArrowUpRight,
        action: closeAnd(() => onSectionChange('send')),
      },
      {
        id: 'nav-apps',
        group: 'Navigation',
        label: 'Solana Ecosystem Apps',
        subtitle: 'Explore verified DeFi, NFT, and infrastructure protocols',
        icon: Compass,
        action: closeAnd(() => onSectionChange('apps')),
      },
      {
        id: 'nav-nft',
        group: 'Navigation',
        label: 'NFT & cNFT Creator Studio',
        subtitle: 'Mint gasless NFTs and view your on-chain collection',
        icon: ImageIcon,
        action: closeAnd(() => onSectionChange('nft')),
      },
      {
        id: 'nav-security',
        group: 'Navigation',
        label: 'Security, Passkeys & Quick Pay Sessions',
        subtitle: 'Manage on-chain authorities, spending limits, and 24h session keys',
        icon: ShieldAlert,
        action: closeAnd(() => onSectionChange('devices')),
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        label: 'Wallet Settings & Preferences',
        subtitle: 'Currency display (USD/VND), network cluster, and account info',
        icon: Settings,
        action: closeAnd(() => onSectionChange('settings')),
      },
    ];
  }, [pubkey, onOpenChange, onSectionChange, onSendClick, onDepositClick, addActivity, refreshBalances]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!mounted) return null;

  const quickActions = filtered.filter((i) => i.group === 'Quick Actions');
  const navItems = filtered.filter((i) => i.group === 'Navigation');

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-start justify-center pt-[12vh] px-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="w-full max-w-xl rounded-2xl bg-[#0b0d15]/95 backdrop-blur-2xl border border-white/12 shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_50px_rgba(22,255,187,0.1)] overflow-hidden"
          >
            {/* Top Specular Gradient Accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-purple-500" />

            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.01]">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command, action, or jump to section..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold text-muted-foreground bg-white/5 border border-white/10 rounded-md">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-3">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No matching commands or sections found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <>
                  {quickActions.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Quick Actions
                      </div>
                      {quickActions.map((item) => {
                        const globalIdx = filtered.indexOf(item);
                        const isSelected = globalIdx === selectedIndex;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            onClick={() => item.action()}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-primary/15 via-accent/10 to-transparent border border-primary/30 text-white shadow-[0_0_20px_rgba(22,255,187,0.08)]'
                                : 'border border-transparent text-muted-foreground hover:text-white hover:bg-white/[0.03]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                    : 'bg-white/[0.03] border-white/10 text-muted-foreground'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{item.label}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{item.subtitle}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-primary text-[9px] font-extrabold uppercase tracking-wider">
                                  {item.badge}
                                </span>
                              )}
                              {item.shortcut && (
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground bg-white/5 border border-white/10 rounded">
                                  {item.shortcut}
                                </kbd>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {navItems.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                        <Compass className="h-3 w-3 text-accent" /> Workspace Navigation
                      </div>
                      {navItems.map((item) => {
                        const globalIdx = filtered.indexOf(item);
                        const isSelected = globalIdx === selectedIndex;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            onClick={() => item.action()}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-primary/15 via-accent/10 to-transparent border border-primary/30 text-white'
                                : 'border border-transparent text-muted-foreground hover:text-white hover:bg-white/[0.03]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                    : 'bg-white/[0.03] border-white/10 text-muted-foreground'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">{item.label}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{item.subtitle}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/60">Jump ↵</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-black/30 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono">↵</kbd> Execute
                </span>
              </div>
              <span className="flex items-center gap-1 text-primary/80 font-semibold">
                <Zap className="h-3 w-3" /> RampFi Command OS
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

