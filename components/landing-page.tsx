'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Fingerprint, Shield, ArrowRight, Activity, Zap, CreditCard, Layers, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CryptoFeed } from '@/components/feed/crypto-feed';
import { defaultConnection } from '@/lib/services/jupiter';

interface LandingPageProps {
  onConnectClick: () => void;
}

/** Animated counter hook — counts from 0 to target */
function useCountUp(target: number, duration = 2000, enabled = true) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || target <= 0) return;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return value;
}

export function LandingPage({ onConnectClick }: LandingPageProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0.15, duration: 0.7 } },
  };

  // Live Solana network stats
  const [networkStats, setNetworkStats] = useState({ tps: 0, slot: 0, epoch: 0, txTotal: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [perfSamples, epochInfo] = await Promise.all([
          defaultConnection.getRecentPerformanceSamples(4),
          defaultConnection.getEpochInfo(),
        ]);
        const avgTps = perfSamples.length > 0
          ? perfSamples.reduce((sum, s) => sum + (s.numTransactions / Math.max(s.samplePeriodSecs, 1)), 0) / perfSamples.length
          : 0;
        setNetworkStats({
          tps: Math.round(avgTps),
          slot: epochInfo.absoluteSlot,
          epoch: epochInfo.epoch,
          txTotal: epochInfo.absoluteSlot * 2, // approximate
        });
        setStatsLoaded(true);
      } catch (err) {
        console.warn('Failed to fetch Solana network stats:', err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  // Animated counters
  const animTps = useCountUp(networkStats.tps, 1500, statsLoaded);
  const animSlot = useCountUp(networkStats.slot, 2000, statsLoaded);

  const scrollToFeed = () => {
    document.getElementById('activity-feed-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const partners = [
    { name: 'Solana', url: 'https://solana.com' },
    { name: 'Jupiter', url: 'https://jup.ag' },
    { name: 'Metaplex', url: 'https://metaplex.com' },
    { name: 'Helius', url: 'https://helius.dev' },
    { name: 'LazorKit', url: 'https://lazorkit.xyz' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative font-sans flex flex-col">
      {/* === Ambient Aura Glows (Solana.com-style) === */}
      <div className="absolute top-[-15%] left-[-15%] w-[60%] aspect-square rounded-full aura-green blur-[160px]" />
      <div className="absolute top-[25%] right-[-15%] w-[50%] aspect-square rounded-full aura-purple blur-[140px]" />
      <div className="absolute bottom-[5%] left-[15%] w-[45%] aspect-square rounded-full aura-blue blur-[130px]" />

      {/* === Grid Pattern Background === */}
      <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

      {/* ─── 1. HEADER ─── */}
      <header className="w-full max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between sticky top-0 bg-background/60 backdrop-blur-xl border-b border-border/30 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary via-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-primary/25">
            <Sparkles className="h-4.5 w-4.5 text-background" />
          </div>
          <span className="text-xl font-bold tracking-wider">
            Ramp<span className="gradient-text-brand">Fi</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <a href="#features" className="hover:text-foreground transition-colors duration-200">Features</a>
          <a href="#stats" className="hover:text-foreground transition-colors duration-200">Network</a>
          <a href="#activity-feed-section" className="hover:text-foreground transition-colors duration-200">Feed</a>
        </nav>

        <Button
          onClick={onConnectClick}
          className="h-10 px-5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-xs button-press"
        >
          <Fingerprint className="h-4 w-4" />
          <span>Launch Portal</span>
        </Button>
      </header>

      {/* ─── 2. HERO SECTION (Solana.com inspired) ─── */}
      <section className="w-full max-w-[1100px] mx-auto px-6 pt-20 pb-24 text-center relative z-10 flex flex-col items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8 max-w-3xl flex flex-col items-center"
        >
          {/* Protocol Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary text-[10px] font-extrabold uppercase tracking-[0.2em]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Built on Solana • Devnet</span>
          </motion.div>

          {/* Main Headline — Gradient Text */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05]"
          >
            <span className="gradient-text">The Gateway</span>
            <br />
            <span className="text-foreground">to Digital Finance.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl font-medium"
          >
            Access Solana assets with zero gas fees. Purchase via VietQR bank transfer, 
            trade with Jupiter-powered execution, and mint NFTs — all secured by biometric passkeys.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center gap-4 pt-2 w-full justify-center"
          >
            <Button
              onClick={onConnectClick}
              className="w-full sm:w-auto h-13 px-8 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-primary/25 text-sm button-press"
            >
              <Fingerprint className="h-5 w-5" />
              <span>Connect with Passkey</span>
            </Button>

            <Button
              variant="outline"
              onClick={scrollToFeed}
              className="w-full sm:w-auto h-13 px-8 border-border/60 hover:bg-white/[0.03] text-foreground font-bold rounded-2xl transition-all text-sm flex items-center justify-center gap-2 button-press hover:border-primary/30"
            >
              <span>Explore Feed</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── NEON DIVIDER ─── */}
      <div className="neon-divider-thick w-full" />

      {/* ─── 3. LIVE STATS (Solana.com style — animated counters) ─── */}
      <section id="stats" className="w-full relative z-10 py-12">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Stat 1: Tx Cost */}
          <div className="stat-card p-5 text-center space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase block">Transaction Cost</span>
            <div className="text-2xl sm:text-3xl font-black text-primary font-mono stat-value">$0.00</div>
            <span className="text-[10px] text-primary/60 font-semibold">Gas Sponsored</span>
          </div>

          {/* Stat 2: Live TPS */}
          <div className="stat-card p-5 text-center space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase block">Active TPS</span>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono stat-value">
              {statsLoaded ? animTps.toLocaleString() : '...'}
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-semibold">Transactions/sec</span>
          </div>

          {/* Stat 3: Epoch */}
          <div className="stat-card p-5 text-center space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase block">Current Epoch</span>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono stat-value">
              {networkStats.epoch > 0 ? networkStats.epoch.toLocaleString() : '...'}
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-semibold">Solana Devnet</span>
          </div>

          {/* Stat 4: Slot Height */}
          <div className="stat-card p-5 text-center space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase block">Slot Height</span>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono stat-value">
              {statsLoaded ? `${(animSlot / 1e6).toFixed(1)}M` : '...'}
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-semibold">Blocks produced</span>
          </div>
        </div>
      </section>

      {/* ─── NEON DIVIDER ─── */}
      <div className="neon-divider w-full" />

      {/* ─── 4. FEATURES GRID (Glassmorphism cards with icon glow) ─── */}
      <section id="features" className="w-full max-w-[1200px] mx-auto px-6 py-20 relative z-10">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Built for the <span className="gradient-text-brand">Solana Ecosystem</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Enterprise-grade infrastructure designed for speed, security, and zero-friction onboarding to Web3.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Feature 1 */}
          <div className="feature-card space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">VietQR On-Ramp</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Purchase crypto instantly via VietQR and Napas — scan and pay from 40+ Vietnamese banks.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="feature-card space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Gasless Execution</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Zero SOL gas fees. All transaction costs sponsored by Kora Paymaster — swaps, transfers, and mints.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="feature-card space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Fingerprint className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Biometric Passkeys</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No seed phrases. Sign transactions with Face ID or Touch ID using WebAuthn SECP256R1 standard.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="feature-card space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Cross-Device Sync</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Recover wallet across devices with multi-passkey authorization. Private keys never leave your hardware.
            </p>
          </div>
        </div>
      </section>

      {/* ─── PARTNER STRIP ─── */}
      <section className="w-full py-10 relative z-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.25em]">Powered By</span>
          </div>
          <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap">
            {partners.map((partner) => (
              <a
                key={partner.name}
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="partner-logo text-sm sm:text-base font-bold text-foreground/60 hover:text-foreground transition-all flex items-center gap-1"
              >
                {partner.name}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEON DIVIDER ─── */}
      <div className="neon-divider-thick w-full" />

      {/* ─── 5. ACTIVITY FEED ─── */}
      <section id="activity-feed-section" className="w-full py-20 relative z-10">
        <div className="max-w-[760px] mx-auto px-6 space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              On-Chain <span className="gradient-text-brand">Activity Feed</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Real-time market trends, community posts, and aggregated Solana ecosystem news.
            </p>
          </div>

          <div className="gradient-border-card p-5 sm:p-6 shadow-2xl">
            <CryptoFeed onTradeClick={onConnectClick} />
          </div>
        </div>
      </section>

      {/* ─── 6. FOOTER ─── */}
      <footer className="w-full border-t border-border/30 py-10 bg-background relative z-10 mt-auto">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center shadow-md">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="text-foreground font-bold">RampFi</span>
            <span>© 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://solana.com" target="_blank" className="hover:text-foreground transition">Solana</a>
            <a href="https://jup.ag" target="_blank" className="hover:text-foreground transition">Jupiter</a>
            <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" className="hover:text-foreground transition">Explorer</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
