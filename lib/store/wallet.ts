import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Fiat,
  TokenSym,
  PaymentMethod,
  ActivityKind,
  TokenHolding,
  Device,
  AppCard,
  Activity,
} from '@/lib/types';
import { 
  getTokenBalance, 
  getAllTokenBalances,
  getSwapQuote,
  getSwapTransaction,
  defaultConnection,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS
} from '@/lib/services/jupiter';
import { fetchRealTokenData } from '@/lib/services/real-token-service';
import { getBackendBalance } from '@/lib/services/backend-balance';
import { Connection } from '@solana/web3.js';

// Re-export types for backward compatibility
export type {
  Fiat,
  TokenSym,
  PaymentMethod,
  ActivityKind,
  TokenHolding,
  Device,
  AppCard,
  Activity,
};
// 100% on-chain Devnet mode — no mock data imports
// Solana ecosystem apps directory (static, no external API needed)
const ECOSYSTEM_APPS: AppCard[] = [
  { id: 'nft-creator', name: 'NFT & cNFT Creator', intro: 'Mint gasless NFTs and Compressed NFTs on Solana Devnet', category: 'Tools', tags: ['NFT', 'cNFT', 'Gasless'], image: 'https://www.google.com/s2/favicons?domain=metaplex.com&sz=64', website: '/apps/nft-creator', verified: true },
  { id: 'jupiter', name: 'Jupiter Exchange', intro: 'Leading swap aggregator on Solana', category: 'DeFi', tags: ['DEX', 'Swap'], image: 'https://www.google.com/s2/favicons?domain=jup.ag&sz=64', website: 'https://jup.ag', verified: true },
  { id: 'raydium', name: 'Raydium', intro: 'AMM and liquidity provider for Solana', category: 'DeFi', tags: ['AMM', 'Liquidity'], image: 'https://www.google.com/s2/favicons?domain=raydium.io&sz=64', website: 'https://raydium.io', verified: true },
  { id: 'tensor', name: 'Tensor', intro: 'NFT marketplace and trading platform', category: 'Tools', tags: ['NFT', 'Marketplace'], image: 'https://www.google.com/s2/favicons?domain=tensor.trade&sz=64', website: 'https://tensor.trade', verified: true },
  { id: 'marinade', name: 'Marinade Finance', intro: 'Liquid staking protocol for SOL', category: 'DeFi', tags: ['Staking', 'mSOL'], image: 'https://www.google.com/s2/favicons?domain=marinade.finance&sz=64', website: 'https://marinade.finance', verified: true },
  { id: 'dialect', name: 'Dialect', intro: 'Web3 messaging and notifications', category: 'Social', tags: ['Messaging', 'Notifications'], image: 'https://www.google.com/s2/favicons?domain=dialect.to&sz=64', website: 'https://dialect.to', verified: true },
];

/** Result from swapReal() — contains data needed for component to sign via LazorKit SDK */
export interface SwapResult {
  swapTransaction: any;
  quote: any;
  estimatedOutput: number;
  fromToken: TokenSym;
  toToken: TokenSym;
  amount: number;
}

export interface WalletState {
  hasPasskey: boolean;
  hasWallet: boolean;
  pubkey?: string;
  walletName?: string;
  fiat: Fiat;
  rateUsdToVnd: number;
  tokens: TokenHolding[];
  devices: Device[];
  apps: AppCard[];
  activity: Activity[];
  // Derived selectors (stable lambdas preferred in components)
  getTokenAmount?: (symbol: TokenSym) => number;
  getPortfolioValueUsd?: () => number;
  hasAssets?: () => boolean;
  hasNoAssets?: () => boolean;
  getNumTokens?: () => number;
  getNumNonZeroTokens?: () => number;
  getTokenValueUsd?: (symbol: TokenSym) => number;
  getEffectivePriceUsd?: (symbol: TokenSym) => number;
  getVisibleTokens?: (hideZero: boolean) => TokenHolding[];

  // Mutators
  setHasPasskey: (hasPasskey: boolean) => void;
  setHasWallet: (hasWallet: boolean) => void;
  setPubkey: (pubkey: string) => void;
  setWalletName: (name: string) => void;
  setTokenAmount?: (symbol: TokenSym, amount: number, priceUsdOverride?: number) => void;
  setFiat: (fiat: Fiat) => void;
  recordOnrampPurchase: (
    amount: number,
    fiat: Fiat,
    token: TokenSym,
    orderId: string
  ) => void;
  swapReal: (fromToken: TokenSym, toToken: TokenSym, amount: number) => Promise<SwapResult | false>;
  addActivity: (activity: Activity) => void;
  resetDemoData: () => void;
  // Blockchain functions
  refreshBalances: () => Promise<void>;
  getRealTokenBalance: (tokenMint: string) => Promise<number>;
  fetchTransactionHistory: () => Promise<void>;
  
  // Logout and reset functions
  logout: () => void;
  resetPasskey: () => void;
  resetWallet: () => void;
  
  // Navigation State
  activeSection: string;
  setActiveSection: (section: string) => void;
}

// On-chain mode: start with empty tokens/activity, fetch real data on login
const getInitialData = () => {
  const tokenSymbols = Object.keys(TOKEN_ADDRESSES) as TokenSym[];
  const initialTokens = tokenSymbols.map(symbol => ({
    symbol,
    amount: 0,
    priceUsd: symbol === 'USDC' || symbol === 'USDT' ? 1.0 : 0.0,
    change24hPct: 0,
    mint: TOKEN_ADDRESSES[symbol as keyof typeof TOKEN_ADDRESSES] || '',
  }));

  return {
    pubkey: undefined,
    tokens: initialTokens as TokenHolding[],
    devices: [],
    apps: ECOSYSTEM_APPS,
    activity: [] as Activity[],
  };
};

// Safe storage adapter that handles SSR
const createSafeStorage = (): Storage => {
  if (typeof window === 'undefined') {
    // Return a no-op storage for SSR that implements the Storage interface
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      get length() { return 0; },
      key: () => null,
    } as Storage;
  }
  return localStorage;
};

// Clear corrupted persisted state that would break JSON.parse during hydration
const checkStorageIntegrity = () => {
  if (typeof window === 'undefined') return;

  const storageKey = 'lazorkit-wallet-storage';
  try {
    const persistedRaw = localStorage.getItem(storageKey);
    if (persistedRaw === 'undefined') {
      localStorage.removeItem(storageKey);
    } else if (persistedRaw) {
      try {
        JSON.parse(persistedRaw);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  } catch {}
};

export const useWalletStore = create<WalletState>()(
  persist<WalletState>(
    (set, get) => {
      // Check for environment changes and clear storage if needed (only on client)
      if (typeof window !== 'undefined') {
        checkStorageIntegrity();
      }

      const initialData = getInitialData();
      return {
        hasPasskey: false,
        hasWallet: false,
        pubkey: initialData.pubkey,
        walletName: 'My Wallet',
        fiat: 'USD',
        rateUsdToVnd: 27000,
        tokens: initialData.tokens,
        devices: initialData.devices,
        apps: initialData.apps,
        activity: initialData.activity,
        activeSection: 'home',
        setActiveSection: (section: string) => set({ activeSection: section }),

        // Derived selectors
        getTokenAmount: (symbol: TokenSym) => {
          const state = get();
          const found = state.tokens.find((t) => t.symbol === symbol);
          return found ? found.amount : 0;
        },
        getPortfolioValueUsd: () => {
          const state = get();
          return state.tokens.reduce((sum, token) => sum + token.amount * token.priceUsd, 0);
        },
        hasAssets: () => {
          const state = get();
          return state.tokens.some((t) => t.amount > 0);
        },
        hasNoAssets: () => {
          const state = get();
          return !state.tokens.some((t) => t.amount > 0);
        },
        getNumTokens: () => {
          const state = get();
          return state.tokens.length;
        },
        getNumNonZeroTokens: () => {
          const state = get();
          return state.tokens.filter((t) => t.amount > 0).length;
        },
        getTokenValueUsd: (symbol: TokenSym) => {
          const state = get();
          const found = state.tokens.find((t) => t.symbol === symbol);
          return found ? found.amount * found.priceUsd : 0;
        },
        getEffectivePriceUsd: (symbol: TokenSym) => {
          const state = get();
          const found = state.tokens.find((t) => t.symbol === symbol);
          return found ? found.priceUsd : 0;
        },
        getVisibleTokens: (hideZero: boolean) => {
          const state = get();
          return hideZero ? state.tokens.filter((t) => t.amount > 0) : state.tokens;
        },

        setHasPasskey: (hasPasskey) => set({ hasPasskey }),
        setHasWallet: (hasWallet) => set({ hasWallet }),
        setPubkey: (pubkey) => {
          if (typeof window !== 'undefined') {
            (window as any).__lz_pubkey = pubkey;
          }
          set({ pubkey });
        },
        setWalletName: (name: string) => set({ walletName: name }),
        setFiat: (fiat) => set({ fiat }),
        setTokenAmount: (symbol: TokenSym, amount: number, priceUsdOverride?: number) => {
          const state = get();
          const idx = state.tokens.findIndex((t) => t.symbol === symbol);
          const next = [...state.tokens];
          if (idx >= 0) {
            // Add to existing amount (original behavior)
            next[idx] = {
              ...next[idx],
              amount: (next[idx].amount || 0) + amount,
              ...(priceUsdOverride != null ? { priceUsd: priceUsdOverride } : {}),
            } as any;
          } else {
            // Create new token if not found
            next.push({
              symbol,
              amount,
              priceUsd: priceUsdOverride ?? 1,
              change24hPct: 0,
              mint: TOKEN_ADDRESSES[symbol as keyof typeof TOKEN_ADDRESSES] || '',
            } as any);
          }
          set({ tokens: next });
        },

        recordOnrampPurchase: (amount, fiat, token, orderId) => {
          const state = get();
          
          const tokenIndex = state.tokens.findIndex((t) => t.symbol === token);
          const next = [...state.tokens];
          if (tokenIndex >= 0) {
            next[tokenIndex] = {
              ...next[tokenIndex],
              amount: next[tokenIndex].amount + amount,
            } as any;
          } else {
            next.push({
              symbol: token,
              amount: amount,
              priceUsd: 1,
              change24hPct: 0,
              mint: TOKEN_ADDRESSES[token as keyof typeof TOKEN_ADDRESSES] || '',
            });
          }
          set({ tokens: next });

          const newActivity: Activity = {
            id: Date.now().toString(),
            kind: 'onramp',
            ts: new Date().toISOString(),
            summary: `Bought ${amount} ${token} via ${fiat === 'USD' ? 'USD' : 'VND'} bank transfer`,
            amount,
            token,
            orderId,
          };

          set({ activity: [newActivity, ...state.activity] });
        },

        // All fake swap/send/deposit functions removed — 100% on-chain mode


        addActivity: (activity) => {
          const state = get();
          set({ activity: [activity, ...state.activity] });
        },

        resetDemoData: () => {
          const data = getInitialData();
          set({
            hasPasskey: false,
            hasWallet: false,
            pubkey: data.pubkey,
            fiat: 'USD',
            tokens: data.tokens,
            devices: data.devices,
            apps: data.apps,
            activity: data.activity,
          });
        },

        // New blockchain functions
        // generateNewWallet: removed; handled by LazorKit SDK

        refreshBalances: async () => {
          const state = get();
          if (!state.pubkey) return;

          try {
            console.log('🔄 Refreshing balances on-chain for:', state.pubkey);
            const tokenHoldings = await fetchRealTokenData(state.pubkey, defaultConnection);
            console.log('✅ Refreshed balances:', tokenHoldings);
            set({ tokens: tokenHoldings });

            // Automatically sync transaction history from Solana devnet
            get().fetchTransactionHistory().catch(console.error);
          } catch (error) {
            console.error('❌ Error refreshing balances:', error);
          }
        },

        getRealTokenBalance: async (tokenMint: string) => {
          const state = get();
          if (!state.pubkey) {
            console.warn('No pubkey available for getRealTokenBalance');
            return 0;
          }

          if (!tokenMint || typeof tokenMint !== 'string') {
            console.warn('Invalid tokenMint:', tokenMint);
            return 0;
          }

          try {
            if (!defaultConnection) {
              console.error('No connection available');
              return 0;
            }

            const balance = await getTokenBalance(state.pubkey, tokenMint, defaultConnection);
            return typeof balance === 'number' ? balance : 0;
          } catch (error) {
            console.error('Error getting token balance:', error);
            return 0;
          }
        },

        swapReal: async (fromToken: TokenSym, toToken: TokenSym, amount: number) => {
          const state = get();
          if (!state.pubkey) {
            console.warn('No pubkey available for swapReal');
            return false;
          }

          if (!fromToken || !toToken || !amount || amount <= 0) {
            console.warn('Invalid swap parameters:', { fromToken, toToken, amount });
            return false;
          }

          try {
            const fromMint = (TOKEN_ADDRESSES as Record<string, string>)[fromToken];
            const toMint = (TOKEN_ADDRESSES as Record<string, string>)[toToken];
            
            if (!fromMint || !toMint) {
              console.error('Invalid token addresses:', { fromToken, toToken, fromMint, toMint });
              return false;
            }

            if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
              console.error('Invalid amount:', amount);
              return false;
            }

            const decimals = TOKEN_DECIMALS[fromToken as keyof typeof TOKEN_DECIMALS] ?? 9;
            const rawAmount = Math.round(amount * Math.pow(10, decimals));

            // Get Jupiter swap quote (uses Mainnet API for price discovery)
            const quote = await getSwapQuote(fromMint, toMint, rawAmount);
            if (!quote || typeof quote !== 'object') {
              console.error('Failed to get swap quote:', quote);
              return false;
            }

            // Get Jupiter swap serialized transaction
            const swapTransaction = await getSwapTransaction(quote, state.pubkey);
            if (!swapTransaction || typeof swapTransaction !== 'object') {
              console.error('Failed to get swap transaction:', swapTransaction);
              return false;
            }


            // Calculate estimated output for UI display
            const toDecimals = TOKEN_DECIMALS[toToken as keyof typeof TOKEN_DECIMALS] ?? 9;
            const estimatedOutput = parseFloat(quote.outAmount || '0') / Math.pow(10, toDecimals);

            // Return the transaction data for the component to sign via LazorKit SDK
            // Activity will be recorded AFTER the component confirms the signature
            return {
              swapTransaction,
              quote,
              estimatedOutput,
              fromToken,
              toToken,
              amount,
            };
          } catch (error) {
            console.error('Error preparing swap:', error);
            
            // Record failed swap activity
            const failedActivity: Activity = {
              id: Date.now().toString(),
              kind: 'swap',
              ts: new Date().toISOString(),
              summary: `Swap ${amount} ${fromToken} → ${toToken} failed: ${(error as Error)?.message || 'Unknown error'}`,
              amount,
              token: fromToken,
              status: 'Failed',
            };
            set({ activity: [failedActivity, ...get().activity] });
            
            return false;
          }
        },

        // Fetch real transaction history from Solana Devnet
        fetchTransactionHistory: async () => {
          const state = get();
          if (!state.pubkey) return;

          try {
            const { PublicKey } = await import('@solana/web3.js');
            const pubkey = new PublicKey(state.pubkey);
            const signatures = await defaultConnection.getSignaturesForAddress(pubkey, { limit: 20 });

            const chainActivities: Activity[] = signatures.map((sig) => ({
              id: sig.signature,
              kind: 'send' as ActivityKind,
              ts: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
              summary: sig.err ? `Failed transaction` : `On-chain transaction confirmed`,
              txSignature: sig.signature,
              status: sig.err ? 'Failed' as const : 'Success' as const,
            }));

            // Merge with existing activities, avoiding duplicates
            const existingIds = new Set(state.activity.map(a => a.id));
            const newActivities = chainActivities.filter(a => !existingIds.has(a.id));

            if (newActivities.length > 0) {
              set({ activity: [...newActivities, ...state.activity].sort((a, b) => 
                new Date(b.ts).getTime() - new Date(a.ts).getTime()
              )});
            }
          } catch (error) {
            console.warn('Failed to fetch transaction history:', error);
          }
        },

        // Logout and reset functions
        logout: () => {
          set({
            hasPasskey: false,
            hasWallet: false,
            pubkey: undefined,
            tokens: [],
            activity: []
          });
          
          // Xóa passkeyData khỏi localStorage để đảm bảo đăng xuất hoàn toàn
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('lazorkit-passkey-data');
              localStorage.removeItem('lz_last_ref');
            } catch (e) {
              console.warn('Failed to clear localStorage:', e);
            }
          }
          
          // Redirect to /buy after logout
          if (typeof window !== 'undefined') {
            window.location.href = '/buy';
          }
        },

        resetPasskey: () => {
          set({ hasPasskey: false });
          
          // Xóa passkeyData khỏi localStorage khi reset passkey
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('lazorkit-passkey-data');
              localStorage.removeItem('lz_last_ref');
            } catch (e) {
              console.warn('Failed to clear localStorage:', e);
            }
          }
          
        },

        resetWallet: () => {
          set({
            hasPasskey: false,
            hasWallet: false,
            pubkey: undefined,
            tokens: [],
            activity: []
          });
          
          // Xóa passkeyData khỏi localStorage khi reset wallet
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('lazorkit-passkey-data');
              localStorage.removeItem('lz_last_ref');
            } catch (e) {
              console.warn('Failed to clear localStorage:', e);
            }
          }
          
        },
      };
    },
    {
      name: 'lazorkit-wallet-storage',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persistedState: unknown, version: number): WalletState => {
        if (version === 0) {
          const initialData = getInitialData();
          const base = (persistedState && typeof persistedState === 'object') ? (persistedState as Record<string, unknown>) : {};
          return {
            ...base,
            hasPasskey: false,
            hasWallet: false,
            pubkey: initialData.pubkey,
            tokens: initialData.tokens,
            devices: initialData.devices,
            apps: initialData.apps,
            activity: initialData.activity,
          } as any as WalletState;
        }
        return persistedState as any as WalletState;
      },
    }
  )
);
