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
import { Sparkles, MessageSquare, Newspaper, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const { hasWallet, pubkey, refreshBalances, activeSection, setActiveSection } = useWalletStore();

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
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

          {/* Main Crypto-Social Feed */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Activity Feed</span>
            <CryptoFeed onTradeClick={() => setActiveSection('buy')} />
          </div>

          {/* Current Assets Tab */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Your Assets</span>
            <AssetsTab />
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Top Header */}
      <div className="md:hidden">
        <AppHeader showMenu={false} />
      </div>

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-none px-0 mx-0 relative">
        {/* Left Sidebar - Desktop (Cột 1) */}
        <aside className="hidden md:block w-[280px] lg:w-[320px] shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-border bg-card/10 backdrop-blur-md">
          <SidebarNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onSendClick={() => setSendModalOpen(true)}
            onDepositClick={() => setDepositModalOpen(true)}
            onConnectClick={() => setConnectModalOpen(true)}
          />
        </aside>

        {/* Center Main Scroll View (Cột 2) */}
        <main ref={mainContainerRef} className="flex-1 px-4 py-6 md:p-8 overflow-y-auto pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderCenterView()}
            </motion.div>
          </AnimatePresence>
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
    <div className="gradient-border-card p-4 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-[0.15em]">Network Monitor</span>
        <span className="flex h-2 w-2 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${stats.isOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${stats.isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
        </span>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-foreground">Solana Devnet</h4>
        <p className="text-[11px] text-muted-foreground">
          {stats.isOnline ? 'All systems operational • Kora paymaster active' : 'Connecting to RPC node...'}
        </p>
      </div>

      {/* 3-stat grid */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
        <div className="text-center">
          <div className="text-xs font-black text-foreground font-mono stat-value">{stats.tps > 0 ? stats.tps.toLocaleString() : '...'}</div>
          <div className="text-[9px] text-muted-foreground/60 font-semibold mt-0.5">TPS</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-black text-foreground font-mono stat-value">{stats.latencyMs > 0 ? `${stats.latencyMs}ms` : '...'}</div>
          <div className="text-[9px] text-muted-foreground/60 font-semibold mt-0.5">Ping</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-black text-foreground font-mono stat-value">{stats.slot > 0 ? `${(stats.slot / 1e6).toFixed(1)}M` : '...'}</div>
          <div className="text-[9px] text-muted-foreground/60 font-semibold mt-0.5">Slot</div>
        </div>
      </div>

      {/* Epoch progress bar */}
      {stats.epoch > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[9px] text-muted-foreground/60 font-mono">
            <span>Epoch {stats.epoch}</span>
            <span>{stats.epochProgress}%</span>
          </div>
          <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${stats.epochProgress}%`,
                background: 'linear-gradient(90deg, #16ffbb, #0ea5e9)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

