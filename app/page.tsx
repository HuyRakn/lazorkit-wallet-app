'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/lib/store/wallet';
import { SidebarNav } from '@/components/sidebar-nav';
import { BottomNav } from '@/components/bottom-nav';
import { WalletCardMini } from '@/components/wallet-card-mini';
import { MarketHubView } from '@/components/market/market-hub-view';

import { AssetsTab } from '@/components/assets-tab';
import { DevicesTab } from '@/components/devices-tab';
import { SettingsTab } from '@/components/settings-tab';
import { NftCreatorView } from '@/components/nft-creator-view';
import { UnifiedTradeForm } from '@/components/UnifiedTradeForm';
import { CryptoFeed } from '@/components/feed/crypto-feed';
import { AppHeader } from '@/components/app-header';
import { AppsTab } from '@/components/apps-tab';
import { WalletBanner } from '@/components/wallet-banner';
import { SendModalViewport } from '@/components/send-modal-viewport';
import { DepositModalCompact } from '@/components/deposit-modal-compact';
import { ConnectWalletModal } from '@/components/connect-wallet-modal';
import { AuthRequiredView } from '@/components/auth-required-view';
import { LandingPage } from '@/components/landing-page';
import { fetchCommonTokens, JupiterToken, defaultConnection } from '@/lib/services/jupiter';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Sparkles, MessageSquare, Newspaper, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const { hasWallet, pubkey, refreshBalances, activeSection, setActiveSection } = useWalletStore();

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainContainerRef = React.useRef<HTMLDivElement>(null);

  // Scroll to top on active section change
  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTo(0, 0);
    }
  }, [activeSection]);

  // Buy token states
  const [tokenData, setTokenData] = useState<Map<string, JupiterToken>>(new Map());
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Authentication check & Mount validation
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch token metadata on mount
  useEffect(() => {
    const loadTokens = async () => {
      try {
        setLoadingTokens(true);
        const tokens = await fetchCommonTokens();
        setTokenData(tokens);
        if (hasWallet && pubkey && refreshBalances) {
          await refreshBalances();
        }
      } catch (err) {
        console.error('Failed to load token metadata:', err);
      } finally {
        setLoadingTokens(false);
      }
    };

    loadTokens();
  }, [hasWallet, pubkey, refreshBalances]);

  if (!isMounted) {
    return null;
  }

  // Render the central column view depending on selected activeSection
  const renderCenterView = () => {
    // 1. Home tab is always accessible (so users can read news/feed)
    if (activeSection === 'home') {
      return (
        <div className="space-y-6">
          {/* Mobile Balance Card Overview */}
          {pubkey && (
            <div className="md:hidden max-w-md mx-auto w-full">
              <WalletCardMini
                onSendClick={() => setSendModalOpen(true)}
                onDepositClick={() => setDepositModalOpen(true)}
              />
            </div>
          )}

          {/* Desktop Multi-Column Dashboard (Split layout with sticky right column) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Ecosystem Feed (scrolls naturally like Instagram/Facebook) */}
            <div className="md:col-span-7 order-2 md:order-1 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Ecosystem Feed</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-extrabold uppercase tracking-wider">Live Activity</span>
                </div>
                <CryptoFeed onTradeClick={() => setActiveSection('buy')} />
              </div>
            </div>

            {/* Right Column: Sticky Portfolio Assets (Always fits without scroll) */}
            <div className="md:col-span-5 order-1 md:order-2 space-y-6 md:sticky md:top-6 h-fit pb-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">Your Assets</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-extrabold uppercase tracking-wider">Devnet Sync</span>
                </div>
                <AssetsTab onDepositClick={() => setDepositModalOpen(true)} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. If trying to access other tabs without a connected wallet, show AuthRequiredView
    if (!hasWallet) {
      return (
        <AuthRequiredView
          onConnectClick={() => setConnectModalOpen(true)}
          title={`${activeSection.toUpperCase()} Studio Security`}
          description={`Please connect your biometric passkey wallet to access the ${activeSection} interface.`}
        />
      );
    }

    // 3. Authenticated tab views
    switch (activeSection) {
      case 'market':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Market Hub</h2>
              <p className="text-sm text-muted-foreground">Monitor real-time prices, trends, and analytical token data on Solana.</p>
            </div>
            <div className="w-full">
              <MarketHubView />
            </div>
          </div>
        );

      case 'buy':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Buy & Swap</h2>
              <p className="text-sm text-muted-foreground">Purchase crypto instantly using local bank app scans or perform swaps.</p>
            </div>

            <div className="w-full">
              {loadingTokens ? (
                <Card className="swap-buy-glow overflow-hidden bg-card border-border/80 p-8 space-y-4">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-full h-12" />
                  <Skeleton className="w-full h-12" />
                  <Skeleton className="w-2/3 h-10 mt-4 mx-auto" />
                </Card>
              ) : (
                <UnifiedTradeForm tokenData={tokenData} />
              )}
            </div>
          </div>
        );

      case 'send':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Send & Receive Assets</h2>
              <p className="text-sm text-muted-foreground">Transfer assets safely on Solana or display your QR code to receive.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card
                onClick={() => setSendModalOpen(true)}
                className="p-6 bg-card border-border hover:border-primary/40 cursor-pointer transition text-center space-y-3 hover-lift"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Send Tokens</h3>
                <p className="text-xs text-muted-foreground">Send tokens gas-free using a Solana address or username.</p>
              </Card>
              <Card
                onClick={() => setDepositModalOpen(true)}
                className="p-6 bg-card border-border hover:border-primary/40 cursor-pointer transition text-center space-y-3 hover-lift"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Receive Tokens</h3>
                <p className="text-xs text-muted-foreground">Display your public address and QR code to receive funds.</p>
              </Card>
            </div>
            <AssetsTab />
          </div>
        );

      case 'apps':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Ecosystem Integrations</h2>
              <p className="text-sm text-muted-foreground">Discover verified apps and interactive protocols on Solana Devnet.</p>
            </div>
            <AppsTab />
          </div>
        );

      case 'nft':
        return <NftCreatorView />;

      case 'devices':
        return <DevicesTab />;

      case 'settings':
        return <SettingsTab />;

      default:
        return null;
    }
  };

  // 4. Render LandingPage if wallet is not connected (Public Portal View)
  if (!hasWallet) {
    return (
      <>
        <LandingPage onConnectClick={() => setConnectModalOpen(true)} />
        <ConnectWalletModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
      </>
    );
  }

  // 5. Render Workspace Layout if wallet is connected (Private Portal View)
  return (
    <div className="h-screen flex flex-col relative z-10 overflow-hidden">
      {/* Mobile Top Header */}
      <div className="md:hidden">
        <AppHeader showMenu={false} />
      </div>

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-none px-0 mx-0 relative overflow-hidden">
        {/* Left Sidebar - Desktop (Cột 1) */}
        <div className="relative hidden md:block shrink-0 z-30">
          <motion.aside
            animate={{ width: sidebarCollapsed ? 80 : 240 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="h-screen overflow-y-auto bg-card/15 backdrop-blur-2xl border-r border-white/[0.06] overflow-x-hidden"
          >
            <SidebarNav
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onSendClick={() => setSendModalOpen(true)}
              onDepositClick={() => setDepositModalOpen(true)}
              onConnectClick={() => setConnectModalOpen(true)}
              collapsed={sidebarCollapsed}
            />
          </motion.aside>

          {/* Absolutely Centered Floating Toggle Button */}
          <motion.button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            whileHover={{ scale: 1.1, borderColor: 'var(--primary)' }}
            whileTap={{ scale: 0.95 }}
            className="absolute top-1/2 -right-3 -translate-y-1/2 z-50 w-6 h-6 rounded-full bg-[#0d0e12] border border-white/[0.08] text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.8)]"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <motion.div
              animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="flex items-center justify-center"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-primary" />
            </motion.div>
          </motion.button>
        </div>

        {/* Center Main Scroll View (Cột 2) */}
        <main ref={mainContainerRef} className="flex-1 overflow-y-auto pb-24 md:pb-8">

          <div className="px-4 py-6 md:px-8 md:py-6 w-full max-w-[1360px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
              >
                {renderCenterView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Unified Send Modal */}
      <SendModalViewport open={sendModalOpen} onOpenChange={setSendModalOpen} />

      {/* Unified Deposit Modal */}
      <DepositModalCompact open={depositModalOpen} onOpenChange={setDepositModalOpen} />

      {/* Connect Wallet Modal */}
      <ConnectWalletModal open={connectModalOpen} onOpenChange={setConnectModalOpen} />
    </div>
  );
}

/** Live Solana Devnet network stats widget — premium gradient card */
function SolanaNetworkWidget() {
  const [stats, setStats] = React.useState({ tps: 0, slot: 0, epoch: 0, epochProgress: 0, latencyMs: 0, isOnline: true });

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const start = performance.now();
        const [perfSamples, epochInfo] = await Promise.all([
          defaultConnection.getRecentPerformanceSamples(4),
          defaultConnection.getEpochInfo(),
        ]);
        const latencyMs = Math.round(performance.now() - start);

        const avgTps = perfSamples.length > 0
          ? perfSamples.reduce((sum, s) => sum + (s.numTransactions / Math.max(s.samplePeriodSecs, 1)), 0) / perfSamples.length
          : 0;

        const epochProgress = epochInfo.slotsInEpoch > 0
          ? Math.round((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100)
          : 0;

        setStats({
          tps: Math.round(avgTps),
          slot: epochInfo.absoluteSlot,
          epoch: epochInfo.epoch,
          epochProgress,
          latencyMs,
          isOnline: true,
        });
      } catch (err) {
        console.warn('Solana network stats fetch failed:', err);
        setStats(prev => ({ ...prev, isOnline: false }));
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/40 border border-border/20 text-[11px] font-bold text-muted-foreground select-none">
      <span className="flex h-1.5 w-1.5 relative">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${stats.isOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${stats.isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
      </span>
      <span className="text-white/80">Solana Devnet</span>
      {stats.isOnline && stats.latencyMs > 0 ? (
        <span className="font-mono text-primary">({stats.latencyMs}ms)</span>
      ) : (
        <span className="text-amber-400">Offline</span>
      )}
    </div>
  );
}

/** Detailed Solana Devnet dashboard widget with 3D metrics */
function SolanaNetworkStatsPanel() {
  const [stats, setStats] = React.useState({ tps: 0, slot: 0, epoch: 0, epochProgress: 0, latencyMs: 0, isOnline: true });

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const start = performance.now();
        const [perfSamples, epochInfo] = await Promise.all([
          defaultConnection.getRecentPerformanceSamples(4),
          defaultConnection.getEpochInfo(),
        ]);
        const latencyMs = Math.round(performance.now() - start);

        const avgTps = perfSamples.length > 0
          ? perfSamples.reduce((sum, s) => sum + (s.numTransactions / Math.max(s.samplePeriodSecs, 1)), 0) / perfSamples.length
          : 0;

        const epochProgress = epochInfo.slotsInEpoch > 0
          ? Math.round((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100)
          : 0;

        setStats({
          tps: Math.round(avgTps),
          slot: epochInfo.absoluteSlot,
          epoch: epochInfo.epoch,
          epochProgress,
          latencyMs,
          isOnline: true,
        });
      } catch (err) {
        console.warn('Solana network stats fetch failed:', err);
        setStats(prev => ({ ...prev, isOnline: false }));
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="premium-depth-card rounded-2xl p-5 space-y-4 relative overflow-hidden select-none border border-border/40">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/30 via-emerald-400/10 to-transparent" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${stats.isOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${stats.isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-xs font-black tracking-wider text-white uppercase font-sans">Solana Devnet Status</span>
        </div>
        <span className="text-[10px] text-muted-foreground/80 font-bold">100% Live Sync</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Latency */}
        <div className="premium-depth-inset rounded-xl p-3.5 space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Ping Latency</span>
          <span className="text-base font-black text-white font-mono">{stats.isOnline ? `${stats.latencyMs}ms` : 'Offline'}</span>
        </div>
        {/* TPS */}
        <div className="premium-depth-inset rounded-xl p-3.5 space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Network TPS</span>
          <span className="text-base font-black text-emerald-400 font-mono">{stats.isOnline ? stats.tps : '—'}</span>
        </div>
        {/* Epoch */}
        <div className="premium-depth-inset rounded-xl p-3.5 space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Current Epoch</span>
          <span className="text-base font-black text-white font-mono">#{stats.epoch}</span>
        </div>
        {/* Slot */}
        <div className="premium-depth-inset rounded-xl p-3.5 space-y-1 col-span-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Ledger Slot</span>
          <span className="text-sm font-black text-primary font-mono truncate block">{stats.slot.toLocaleString()}</span>
        </div>
      </div>

      {/* Epoch Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>Epoch Progress</span>
          <span>{stats.epochProgress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-background/50 border border-border/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
            style={{ width: `${stats.epochProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

