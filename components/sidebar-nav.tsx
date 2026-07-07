import React from 'react';
import { Home, CreditCard, Send, Image, ShieldAlert, Settings, Compass, BarChart3, Fingerprint, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { motion } from 'framer-motion';

interface SidebarNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSendClick: () => void;
  onDepositClick: () => void;
  onConnectClick: () => void;
  collapsed: boolean;
}

export function SidebarNav({
  activeSection,
  onSectionChange,
  onConnectClick,
  collapsed,
}: SidebarNavProps) {
  const { pubkey, logout } = useWalletStore();
  const sdk = useWallet();

  const handleDisconnect = async () => {
    // Disconnect SDK first to prevent WalletSync auto-restore
    if (sdk && sdk.disconnect) {
      try {
        await sdk.disconnect();
      } catch (e) {
        console.warn('SDK disconnect failed:', e);
      }
    }
    logout && logout();
  };

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'market', label: 'Markets', icon: BarChart3 },
    { id: 'buy', label: 'Buy & Swap', icon: CreditCard },
    { id: 'send', label: 'Transfers', icon: Send },
    { id: 'apps', label: 'Apps', icon: Compass },
    { id: 'nft', label: 'NFT Studio', icon: Image },
    { id: 'devices', label: 'Security', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full py-6 select-none justify-between items-center w-full relative">

      {/* Top Logo */}
      <div 
        onClick={() => onSectionChange('home')}
        className="flex items-center gap-3 mt-2 px-6 w-full justify-start overflow-hidden h-9 cursor-pointer active:opacity-80 transition-opacity"
        title="Go to Home"
      >
        <img src="/logo.png" alt="RampFi" className="w-8 h-8 object-contain shrink-0" />
        <motion.span
          animate={{ 
            opacity: collapsed ? 0 : 1,
            x: collapsed ? -10 : 0
          }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="font-black text-sm tracking-wider bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent whitespace-nowrap overflow-hidden"
        >
          Ramp<span className="text-primary">Fi</span>
        </motion.span>
      </div>

      {/* Navigation Icons Grid */}
      <nav className="flex flex-col gap-2 my-auto w-full px-0">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              title={item.label}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              animate={{ 
                paddingLeft: collapsed ? "30px" : "24px"
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className={`relative h-11 w-full flex items-center gap-3 outline-none group cursor-pointer transition-colors duration-150 overflow-hidden ${isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {/* Premium indicator backdrop & Glow Border with LayoutID */}
              {isActive && (
                <motion.div
                  layoutId="active-indicator-cosmic"
                  className="absolute inset-y-1 left-2 right-2 rounded-xl bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 shadow-[0_0_20px_rgba(22,255,187,0.1)] z-0"
                  style={{ backdropFilter: 'blur(8px)' }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                />
              )}

              {/* Glowing active indicator line at the edge */}
              {isActive && (
                <motion.div
                  layoutId="active-line-cosmic"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-md bg-gradient-to-b from-primary to-accent shadow-[0_0_15px_var(--primary)] z-10"
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                />
              )}

              <Icon className="h-5 w-5 shrink-0 relative z-10 transition-transform duration-300 group-hover:scale-105" />
              <motion.span
                animate={{ 
                  opacity: collapsed ? 0 : 1,
                  x: collapsed ? -10 : 0
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className="text-xs font-bold tracking-wide relative z-10 whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-3.5 mb-2 w-full px-2">
        {/* Auth status icon */}
        {pubkey ? (
          <motion.button
            onClick={handleDisconnect}
            animate={{ 
              paddingLeft: collapsed ? "21px" : "16px"
            }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="h-10 w-full flex items-center gap-3 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 cursor-pointer transition-colors duration-150 overflow-hidden"
            title="Disconnect Wallet"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            <motion.span
              animate={{ 
                opacity: collapsed ? 0 : 1,
                x: collapsed ? -10 : 0
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="text-[11px] font-bold text-red-400 whitespace-nowrap overflow-hidden"
            >
              Disconnect
            </motion.span>
          </motion.button>
        ) : (
          <motion.button
            onClick={onConnectClick}
            animate={{ 
              paddingLeft: collapsed ? "21px" : "16px"
            }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="h-10 w-full flex items-center gap-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary cursor-pointer transition-colors duration-150 overflow-hidden"
            title="Connect Wallet"
          >
            <Fingerprint className="h-4.5 w-4.5 shrink-0" />
            <motion.span
              animate={{ 
                opacity: collapsed ? 0 : 1,
                x: collapsed ? -10 : 0
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="text-[11px] font-bold whitespace-nowrap overflow-hidden"
            >
              Connect Wallet
            </motion.span>
          </motion.button>
        )}
      </div>

    </div>
  );
}
