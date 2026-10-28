'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Info,
  Download,
  Check,
  X as XIcon,
  Wifi,
  WifiOff,
  Shield,
  ExternalLink,
  Copy,
  LogOut,
  Lock,
  Zap,
  Database,
  Activity,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SimpleSelect } from './ui/simple-select';
import { useWalletStore } from '@/lib/store/wallet';
import { t } from '@/lib/i18n';
import { useLanguage } from '@/hooks/use-language';
import { toast } from '@/hooks/use-toast';
import { DevicesTab } from './devices-tab';
import { defaultConnection } from '@/lib/services/jupiter';
import { Blockie } from '@/components/ui/blockie';
import { useWallet } from '@/hooks/use-lazorkit-wallet';

export const SettingsTab = () => {
  const { fiat, setFiat, logout, walletName, setWalletName, pubkey, activity } = useWalletStore();
  const sdk = useWallet();

  const { language, setLanguage } = useLanguage();
  const [pendingName, setPendingName] = useState<string>(walletName || '');
  const [rpcLatency, setRpcLatency] = useState<number | null>(null);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage as 'en' | 'vi');
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setFiat(newCurrency as 'USD' | 'VND');
  };

  // Check RPC latency
  useEffect(() => {
    const checkRpc = async () => {
      setRpcStatus('checking');
      try {
        const start = performance.now();
        await defaultConnection.getSlot();
        const latency = Math.round(performance.now() - start);
        setRpcLatency(latency);
        setRpcStatus('online');
      } catch {
        setRpcStatus('offline');
        setRpcLatency(null);
      }
    };
    checkRpc();
    const interval = setInterval(checkRpc, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      // Disconnect SDK session FIRST to prevent WalletSync from re-syncing
      if (sdk && sdk.disconnect) {
        try {
          await sdk.disconnect();
          console.log('✅ SDK disconnected successfully');
        } catch (sdkErr) {
          console.warn('SDK disconnect failed (non-fatal):', sdkErr);
        }
      }
      
      // Then clear store + localStorage
      logout();
      toast({
        title: t('notifications.logoutSuccess'),
        description: t('notifications.logoutSuccessDesc'),
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: t('notifications.logoutFailed'),
        description: t('notifications.logoutFailedDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleExportActivity = () => {
    try {
      const data = JSON.stringify(activity || [], null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rampfi-activity-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Activity Exported', description: `${(activity || []).length} records exported successfully.` });
    } catch {
      toast({ title: 'Export Failed', variant: 'destructive' });
    }
  };

  const handleCopyAddress = () => {
    if (pubkey) {
      navigator.clipboard.writeText(pubkey);
      toast({ title: 'Address Copied', description: 'Wallet address copied to clipboard.' });
    }
  };

  const rpcUrl = process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
  const rpcHost = (() => {
    try { return new URL(rpcUrl).hostname; } catch { return rpcUrl; }
  })();

  return (
    <div className='animate-page-enter flex flex-col'>

      {/* ── Profile Header ── */}
      {pubkey && (
        <div className='relative w-full rounded-2xl overflow-hidden border border-border/40 premium-depth-card mb-3 shrink-0'>
          {/* Banner */}
          <div 
            className='w-full h-20 sm:h-22 bg-cover bg-center relative'
            style={{ backgroundImage: "url('/images/settings_banner.png')" }}
          >
            <div className='absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent' />
            <div className='absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5' />
          </div>
          
          {/* Profile Content */}
          <div className='relative px-4 pb-3 -mt-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3'>
            {/* Avatar & Identity */}
            <div className='flex items-end gap-3 z-10'>
              <div className='w-14 h-14 rounded-xl overflow-hidden border-[3px] border-background bg-background shadow-xl shrink-0'>
                <Blockie seed={pubkey} size={8} scale={7} />
              </div>
              <div className='min-w-0 pb-0.5'>
                <h2 className='text-sm font-extrabold text-foreground tracking-tight leading-tight'>{walletName || 'My Wallet'}</h2>
                <div className='flex items-center gap-1.5 mt-0.5'>
                  <span className='text-[10px] font-mono text-muted-foreground truncate max-w-[130px] sm:max-w-[200px]'>
                    {pubkey}
                  </span>
                  <button onClick={handleCopyAddress} className='text-muted-foreground hover:text-primary transition p-0.5 rounded hover:bg-muted/30' title="Copy Address">
                    <Copy className='h-3 w-3' />
                  </button>
                  <div className='flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 shrink-0'>
                    <span className='w-1 h-1 rounded-full bg-primary animate-pulse' />
                    <span className='text-[8px] font-bold text-primary tracking-wider uppercase'>Devnet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Rename */}
            <div className='w-full sm:w-48 shrink-0'>
              <Label htmlFor='walletName' className='text-[8px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5 mb-0.5 block'>
                Rename Wallet
              </Label>
              <div className='relative'>
                <Input
                  id='walletName'
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  className='h-7.5 bg-background/60 border-border/40 focus:border-primary/50 pr-14 transition-all text-xs rounded-xl shadow-inner'
                  placeholder='Enter new name'
                />
                <div className='absolute inset-y-0 right-1 flex items-center gap-0.5'>
                  <button
                    type='button'
                    onClick={() => setWalletName(pendingName.trim())}
                    className='h-5 w-5 inline-flex items-center justify-center rounded-md border border-border/40 hover:bg-muted/30 hover:border-primary/30 transition'
                    aria-label='Save name'
                  >
                    <Check className='h-2.5 w-2.5 text-primary' />
                  </button>
                  <button
                    type='button'
                    onClick={() => { setPendingName(''); setWalletName(''); }}
                    className='h-5 w-5 inline-flex items-center justify-center rounded-md border border-border/40 hover:bg-muted/30 transition'
                    aria-label='Clear name'
                  >
                    <XIcon className='h-2.5 w-2.5 text-muted-foreground' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Settings Grid ── */}
      <div className='grid grid-cols-1 lg:grid-cols-2 content-start gap-4 pb-4 items-stretch'>

        {/* Card 1: Preferences */}
        <div className='rounded-2xl overflow-visible border border-white/10 premium-depth-card flex flex-col justify-between relative z-20 p-5 space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center'>
                <Globe className='h-4 w-4 text-primary' />
              </div>
              <div>
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-foreground'>Preferences</h3>
                <p className='text-[10px] text-muted-foreground'>Regional & display configuration</p>
              </div>
            </div>
          </div>

          <div className='divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20'>
            {/* Language */}
            <div className='px-4 py-3 hover:bg-white/[0.02] transition-colors'>
              <div className='flex items-center justify-between gap-4'>
                <div className='flex-1 min-w-0'>
                  <Label className='text-xs font-bold text-foreground'>{t('settings.language')}</Label>
                  <p className='text-[11px] text-muted-foreground mt-0.5'>Interface localization</p>
                </div>
                <div className='w-36 shrink-0'>
                  <SimpleSelect
                    value={language}
                    onValueChange={handleLanguageChange}
                    options={[
                      { value: 'en', label: 'EN — English' },
                      { value: 'vi', label: 'VI — Tiếng Việt' },
                    ]}
                    className='h-8 bg-background/60 border-white/10 text-xs rounded-xl font-semibold'
                  />
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className='px-4 py-3 rounded-b-xl hover:bg-white/[0.02] transition-colors'>
              <div className='flex items-center justify-between gap-4'>
                <div className='flex-1 min-w-0'>
                  <Label className='text-xs font-bold text-foreground'>{t('settings.currency')}</Label>
                  <p className='text-[11px] text-muted-foreground mt-0.5'>Default fiat valuation</p>
                </div>
                <div className='w-36 shrink-0'>
                  <SimpleSelect
                    value={fiat}
                    onValueChange={handleCurrencyChange}
                    options={[
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'VND', label: 'VND (₫)' },
                    ]}
                    className='h-8 bg-background/60 border-white/10 text-xs rounded-xl font-semibold'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Network */}
        <div className='rounded-2xl overflow-hidden border border-white/10 premium-depth-card flex flex-col justify-between relative z-10 p-5 space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center'>
                <Wifi className='h-4 w-4 text-sky-400' />
              </div>
              <div>
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-foreground'>Network & RPC</h3>
                <p className='text-[10px] text-muted-foreground'>High-throughput Solana cluster</p>
              </div>
            </div>
            {rpcStatus === 'online' && (
              <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20'>
                <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
                <span className='text-[10px] font-bold text-emerald-400 uppercase tracking-wider'>Connected</span>
              </div>
            )}
          </div>

          <div className='divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20'>
            {/* RPC */}
            <div className='px-4 py-3'>
              <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <span className='text-xs font-bold text-foreground block'>RPC Provider</span>
                  <span className='text-[11px] text-muted-foreground font-mono truncate block max-w-[220px] mt-0.5'>{rpcHost}</span>
                </div>
                {rpcStatus === 'checking' ? (
                  <div className='w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                ) : rpcStatus === 'online' ? (
                  <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15'>
                    <Zap className='h-3 w-3 text-emerald-400' />
                    <span className='text-xs font-bold text-emerald-400 font-mono'>{rpcLatency}ms</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20'>
                    <WifiOff className='h-3 w-3 text-rose-400' />
                    <span className='text-xs font-bold text-rose-400'>Offline</span>
                  </div>
                )}
              </div>
            </div>
            {/* Active Network */}
            <div className='px-4 py-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <span className='text-xs font-bold text-foreground block'>Active Cluster</span>
                  <span className='text-[11px] text-muted-foreground mt-0.5'>Solana Devnet • Sponsored Gas</span>
                </div>
                <span className='text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase'>
                  Devnet
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Security & Actions */}
        <div className='rounded-2xl overflow-hidden border border-white/10 premium-depth-card flex flex-col justify-between p-5 space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center'>
                <Shield className='h-4 w-4 text-emerald-400' />
              </div>
              <div>
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-foreground'>Security & Session</h3>
                <p className='text-[10px] text-muted-foreground'>WebAuthn Passkey P-256 hardware enclave</p>
              </div>
            </div>
            <span className='text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md'>
              Hardware Bound
            </span>
          </div>

          <div className='space-y-2.5'>
            {/* Export Activity */}
            <button
              onClick={handleExportActivity}
              className='w-full flex items-center gap-3 p-3 rounded-xl premium-depth-inset hover:border-primary/30 transition-all group cursor-pointer'
            >
              <div className='w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 group-hover:bg-sky-500/20 transition'>
                <Download className='h-4 w-4 text-sky-400' />
              </div>
              <div className='text-left flex-1 min-w-0'>
                <span className='text-xs font-bold text-foreground block'>Export Ledger Activity</span>
                <span className='text-[10px] text-muted-foreground mt-0.5'>{(activity || []).length} on-chain records available</span>
              </div>
              <span className='text-[10px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 shrink-0'>JSON</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className='w-full flex items-center gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group cursor-pointer'
            >
              <div className='w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 group-hover:bg-rose-500/20 transition'>
                <LogOut className='h-4 w-4 text-rose-400' />
              </div>
              <div className='text-left flex-1 min-w-0'>
                <span className='text-xs font-bold text-rose-300 block'>{t('common.logout')}</span>
                <span className='text-[10px] text-muted-foreground mt-0.5'>Disconnect current passkey session</span>
              </div>
            </button>
          </div>
        </div>

        {/* Card 4: System Architecture & About */}
        <div className='rounded-2xl overflow-hidden border border-white/10 premium-depth-card flex flex-col justify-between p-5 space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center'>
                <Info className='h-4 w-4 text-primary' />
              </div>
              <div>
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-foreground'>System Architecture</h3>
                <p className='text-[10px] text-muted-foreground'>Smart Wallet PDA & SDK telemetry</p>
              </div>
            </div>
            <span className='text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20'>
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
              Operational
            </span>
          </div>

          <div className='divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20'>
            {[
              { label: 'Platform', value: 'RampFi v2.4 (2026)', icon: Activity },
              { label: 'Passkey SDK', value: '@lazorkit/wallet ^3.4.1', icon: Database, mono: true },
              { label: 'Execution Layer', value: 'Solana (@solana/web3.js)', icon: Zap, mono: true },
            ].map((item) => (
              <div key={item.label} className='px-4 py-2.5 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <item.icon className='h-3.5 w-3.5 text-primary/70' />
                  <span className='text-xs text-muted-foreground'>{item.label}</span>
                </div>
                <span className={`text-xs font-bold text-foreground ${item.mono ? 'font-mono text-[11px]' : ''}`}>{item.value}</span>
              </div>
            ))}
            {/* Links */}
            <div className='px-4 py-2.5 flex items-center justify-between'>
              <span className='text-xs text-muted-foreground'>Explorer & Docs</span>
              <div className='flex items-center gap-3'>
                <a href='https://solana.com' target='_blank' rel='noopener noreferrer' className='text-xs text-primary hover:text-primary/80 transition flex items-center gap-1 font-bold'>
                  Solana <ExternalLink className='h-3 w-3' />
                </a>
                <a href='https://explorer.solana.com/?cluster=devnet' target='_blank' rel='noopener noreferrer' className='text-xs text-primary hover:text-primary/80 transition flex items-center gap-1 font-bold'>
                  Explorer <ExternalLink className='h-3 w-3' />
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};