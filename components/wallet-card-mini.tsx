'use client';

import React from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { formatCurrency } from '@/lib/utils/format';
import { motion } from 'framer-motion';

interface WalletCardMiniProps {
  onSendClick?: () => void;
  onDepositClick?: () => void;
}

export function WalletCardMini({ onDepositClick }: WalletCardMiniProps) {
  const { tokens, fiat, pubkey } = useWalletStore();
  const [showBalance, setShowBalance] = React.useState(true);

  // Filter top 3 tokens to show in the balance card (SOL, USDC, JUP)
  const topTokens = tokens.filter(t => ['SOL', 'USDC', 'JUP'].includes(t.symbol));

  const totalBalance = tokens.reduce(
    (sum, token) => sum + token.amount * token.priceUsd,
    0
  );

  return (
    <div className="glass-card rounded-2xl p-5 w-full select-none relative overflow-hidden transition-all duration-300 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-gradient-to-br from-card/80 to-background/90">
      
      {/* Dynamic Cosmic Aura Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-primary/10 to-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4.5 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">
            Your Wallet Balance
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowBalance(!showBalance)}
            className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            title="Toggle Balance View"
          >
            {showBalance ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </motion.button>
        </div>
        {pubkey && (
          <span className="text-[9px] font-bold font-mono text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/20">
            {pubkey.slice(0, 4)}...{pubkey.slice(-4)}
          </span>
        )}
      </div>

      {/* Main Balance Display with VND conversion */}
      <div className="mb-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col"
        >
          <h2 className="text-3xl font-black tracking-tight text-white font-sans bg-gradient-to-r from-white via-white to-white/80 bg-clip-text">
            {showBalance ? formatCurrency(totalBalance, fiat) : '••••••'}
          </h2>
          {showBalance && (
            <span className="text-[10px] text-muted-foreground/60 font-mono mt-1">
              ≈ {(totalBalance * 23500).toLocaleString('vi-VN')} VND
            </span>
          )}
        </motion.div>
      </div>

      {/* Token List inside Card - Premium list items */}
      <div className="space-y-3 relative z-10">
        {topTokens.map((token, index) => {
          const usdVal = token.amount * token.priceUsd;
          
          return (
            <motion.div 
              key={token.symbol} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={`flex items-center justify-between pb-3 ${
                index === topTokens.length - 1 ? '' : 'border-b border-border/10'
              }`}
            >
              {/* Token Logo & Info */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-card to-background flex items-center justify-center border border-border/40 shadow-inner">
                  {token.symbol === 'SOL' && (
                    <img src="https://assets.coingecko.com/coins/images/4128/large/solana.png" alt="SOL" className="w-4.5 h-4.5 object-contain" />
                  )}
                  {token.symbol === 'USDC' && (
                    <img src="https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png" alt="USDC" className="w-4.5 h-4.5 object-contain" />
                  )}
                  {token.symbol === 'JUP' && (
                    <img src="https://assets.coingecko.com/coins/images/34188/large/jup.png" alt="JUP" className="w-4.5 h-4.5 object-contain" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-white">
                    {showBalance ? `${token.amount.toFixed(2)} ${token.symbol}` : `•••• ${token.symbol}`}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/60">
                    {showBalance ? formatCurrency(usdVal, fiat) : '••••'}
                  </span>
                </div>
              </div>

              {/* Action Button: (+) Round Icon */}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(22, 255, 187, 0.15)' }}
                whileTap={{ scale: 0.9 }}
                onClick={onDepositClick}
                className="w-7 h-7 rounded-full bg-card/65 border border-border/40 hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title={`Deposit ${token.symbol}`}
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
