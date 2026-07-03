'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Eye, EyeOff, Send, Plus } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { formatAddress, formatCurrency } from '@/lib/utils/format';
import { Button } from './ui/button';
import { toast } from '@/hooks/use-toast';
import { Blockie } from './ui/blockie';

interface WalletCardMiniProps {
  onSendClick?: () => void;
  onDepositClick?: () => void;
}

export function WalletCardMini({ onSendClick, onDepositClick }: WalletCardMiniProps) {
  const { pubkey, tokens, fiat } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Calculate total balance from on-chain tokens
  const totalBalance = tokens.reduce(
    (sum, token) => sum + token.amount * token.priceUsd,
    0
  );
  
  // Fallback loading check
  const loadingPrices = tokens.some(t => t.priceUsd === 0) && totalBalance === 0;

  const displayBalance = totalBalance;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pubkey) return;
    try {
      await navigator.clipboard.writeText(pubkey);
      setCopied(true);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="space-y-4 md:space-y-4 w-full select-none">
      {/* Dragon Wallet Card */}
      <div 
        className="relative rounded-2xl shadow-xl overflow-hidden aspect-[1.586/1] transform transition-all duration-300 hover:scale-[1.02] border border-emerald-500/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)]"
        style={{
          backgroundImage: 'url(/card_wallet.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Card Overlay / Tint */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />

        {/* Card Content */}
        <div className="relative z-10 p-5 md:p-4 h-full flex flex-col justify-between">
          
          {/* Top Row: Blockie + Network */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5 md:gap-2">
              <div className="w-9 h-9 md:w-8 md:h-8 rounded-lg overflow-hidden border border-[color:#16ffbb]/30 bg-background/50 flex-shrink-0">
                <Blockie seed={pubkey || 'rampfi'} size={8} scale={4} />
              </div>
              <span className="text-white font-extrabold text-sm md:text-xs tracking-widest uppercase">SOLANA</span>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-1 px-2.5 py-1 md:px-1.5 md:py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] md:text-[9px] text-emerald-400 font-extrabold tracking-wide uppercase">Devnet</span>
            </div>
          </div>

          {/* Contactless Icon */}
          <div className="absolute top-5 right-5 hidden sm:block md:hidden">
            <svg className="w-8 h-8 text-gray-500/25" viewBox="0 0 40 40" fill="none">
              <path d="M8 20C8 14.5 11 9 16 9M12 20C12 16.5 14 14 16 14M16 20C16 18 16 20 16 20" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 20C16 14.5 19 9 24 9M20 20C20 16.5 22 14 24 14M24 20C24 18 24 20 24 20" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M24 20C24 14.5 27 9 32 9M28 20C28 16.5 30 14 32 14M32 20C32 18 32 20 32 20" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Bottom Row: Address and Balance info */}
          <div className="space-y-4 md:space-y-1.5">
            {/* Address bar */}
            <div className="flex items-center gap-2 md:gap-1.5 bg-black/45 md:bg-black/35 backdrop-blur-sm px-3 py-1.5 md:px-2.5 md:py-1 rounded-xl md:rounded-lg border border-white/10 md:border-white/5 w-fit">
              <code className="text-gray-100 font-mono text-xs sm:text-sm md:text-[11px] tracking-wider md:tracking-widest">
                {pubkey ? formatAddress(pubkey) : '----...----'}
              </code>
              {pubkey && (
                <div className="flex items-center gap-1.5 md:gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-0.5 text-gray-400 hover:text-[color:#16ffbb] transition-colors"
                    title="Copy Address"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 md:h-3 md:w-3 text-[color:#16ffbb]" /> : <Copy className="h-3.5 w-3.5 md:h-3 md:w-3" />}
                  </button>
                  <a
                    href={`https://explorer.solana.com/address/${pubkey}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 text-gray-400 hover:text-[color:#16ffbb] transition-colors"
                    title="View on Explorer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Balances & Branding */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-gray-400/90 md:text-gray-400/80 text-[10px] sm:text-[11px] md:text-[8px] uppercase tracking-widest font-extrabold md:font-semibold mb-1 md:mb-0.5">
                  Portfolio Value
                </p>
                <div className="flex items-center gap-2 md:gap-1.5">
                  <span className="text-white text-3xl sm:text-4xl md:text-xl font-extrabold md:font-black tracking-tight font-sans">
                    {showBalance
                      ? (loadingPrices && totalBalance === 0
                        ? '—'
                        : formatCurrency(displayBalance, fiat))
                      : '••••••'}
                  </span>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-1 md:p-0.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showBalance ? <EyeOff className="h-4.5 w-4.5 md:h-3.5 md:w-3.5" /> : <Eye className="h-4.5 w-4.5 md:h-3.5 md:w-3.5" />}
                  </button>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-black text-base sm:text-lg md:text-sm tracking-wide leading-none">
                  <span className="text-white">Ramp</span>
                  <span className="text-[color:#16ffbb]">Fi</span>
                </p>
                <p className="text-gray-500/90 text-[9px] sm:text-[10px] md:text-[8px] tracking-wide mt-1 md:mt-0.5">Signature</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Action Buttons Below Dragon Card */}
      <div className="grid grid-cols-2 gap-3 md:gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onSendClick}
          className="w-full h-11 md:h-9 text-sm md:text-xs font-bold border-border/80 bg-background/30 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all duration-200 button-press rounded-xl md:rounded-lg"
        >
          <Send className="mr-2 md:mr-1.5 h-4 w-4 md:h-3.5 md:w-3.5" />
          Send
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onDepositClick}
          className="w-full h-11 md:h-9 text-sm md:text-xs font-bold border-border/80 bg-background/30 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all duration-200 button-press rounded-xl md:rounded-lg"
        >
          <Plus className="mr-2 md:mr-1.5 h-4 w-4 md:h-3.5 md:w-3.5" />
          Receive
        </Button>
      </div>
    </div>
  );
}
