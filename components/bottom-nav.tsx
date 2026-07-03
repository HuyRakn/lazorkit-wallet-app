'use client';

import React from 'react';
import { Home, BarChart3, CreditCard, LayoutGrid, Settings } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function BottomNav({ activeSection, onSectionChange }: BottomNavProps) {
  const { hasWallet } = useWalletStore();

  if (!hasWallet) return null;

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'market', label: 'Markets', icon: BarChart3 },
    { id: 'buy', label: 'Trade', icon: CreditCard },
    { id: 'apps', label: 'Apps', icon: LayoutGrid },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-45">
      {/* Floating Glassmorphic Neo-Dock */}
      <div className="flex items-center justify-between h-16 px-4 rounded-full bg-background/80 backdrop-blur-2xl border border-border/40 shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => onSectionChange(tab.id)}
                whileTap={{ scale: 0.95 }}
                className="relative flex items-center justify-center select-none transition-all duration-200 outline-none cursor-pointer"
              >
                <motion.div
                  layout
                  transition={{ 
                    type: 'spring', 
                    stiffness: 400, 
                    damping: 30,
                    layout: { duration: 0.25 } 
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary/15 to-accent/5 text-primary border border-primary/30 shadow-[0_0_20px_rgba(22,255,187,0.15)]' 
                      : 'text-muted-foreground/80 hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-5.5 w-5.5 transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100 hover:scale-105'}`} />
                  
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, width: 'auto', marginLeft: 4 }}
                      exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs font-black tracking-wider uppercase overflow-hidden whitespace-nowrap"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </motion.div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
