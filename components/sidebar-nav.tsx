'use client';

import React from 'react';
import { Home, CreditCard, Send, Image, ShieldAlert, Settings, Sparkles, Fingerprint, BarChart3, LayoutGrid } from 'lucide-react';
import { WalletCardMini } from './wallet-card-mini';
import { useWalletStore } from '@/lib/store/wallet';
import { motion } from 'framer-motion';

interface SidebarNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSendClick: () => void;
  onDepositClick: () => void;
  onConnectClick: () => void;
}

export function SidebarNav({
  activeSection,
  onSectionChange,
  onSendClick,
  onDepositClick,
  onConnectClick,
}: SidebarNavProps) {
  const { pubkey } = useWalletStore();

  const menuItems = [
    { id: 'home', label: 'Home Feed', icon: Home },
    { id: 'market', label: 'Market Hub', icon: BarChart3, badge: { text: 'Live', variant: 'live' } },
    { id: 'buy', label: 'Buy & Swap', icon: CreditCard },
    { id: 'send', label: 'Send / Receive', icon: Send },
    { id: 'apps', label: 'Ecosystem Apps', icon: LayoutGrid, badge: { text: 'Beta', variant: 'default' } },
    { id: 'nft', label: 'NFT Studio', icon: Image, badge: { text: 'New', variant: 'new' } },
    { id: 'devices', label: 'Passkey Devices', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full py-7 px-4 bg-[#08090d] border-r border-white/[0.06] select-none justify-between">
      
      <div>
        {/* Brand logo section */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <img src="/logo.png" alt="RampFi Logo" className="w-9 h-9 object-contain" />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider text-white leading-none">
              Ramp<span className="text-primary font-black">Fi</span>
            </span>
            <span className="text-[9px] text-muted-foreground font-bold tracking-widest mt-1.5 uppercase">
              Enterprise Portal
            </span>
          </div>
        </div>

        {/* Wallet overview widget / Connect Button */}
        <div className="mb-6">
          {pubkey ? (
            <WalletCardMini onSendClick={onSendClick} onDepositClick={onDepositClick} />
          ) : (
            <button
              onClick={onConnectClick}
              className="w-full flex flex-col items-center justify-center p-5 rounded-2xl border border-dashed border-white/10 hover:border-primary/40 hover:bg-white/[0.02] transition-all duration-200 text-center gap-2.5 group button-press"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white">Connect Wallet</span>
                <span className="text-[9px] text-muted-foreground block font-medium uppercase tracking-wider">Biometric Passkey</span>
              </div>
            </button>
          )}
        </div>

        {/* Navigation menu list */}
        <nav className="space-y-1.5 px-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`relative w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all duration-150 outline-none group ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/80 hover:text-white hover:bg-white/[0.01]'
                }`}
              >
                {/* Clean glassmorphic background pill with LayoutId */}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute inset-0 rounded-xl bg-white/[0.03] border border-white/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.3)] z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                
                {/* Active left indicator glowing pin */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary shadow-[0_0_10px_rgba(22,255,187,0.5)] z-20" />
                )}
                
                <div className="relative z-10 flex items-center gap-3">
                  <Icon className={`h-4.5 w-4.5 transition-colors duration-150 ${isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-white'}`} />
                  <span className="text-[13px] font-bold tracking-wide">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`relative z-10 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    item.badge.variant === 'live'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                      : item.badge.variant === 'new'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {item.badge.text}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Indicator */}
      <div className="pt-4 border-t border-white/[0.06] px-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold tracking-wider uppercase">
          <span>v2.3.0</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-white/80">Solana Devnet</span>
          </div>
        </div>
      </div>

    </div>
  );
}
