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
export const ECOSYSTEM_APPS: AppCard[] = [
  { id: 'nft-creator', name: 'NFT & cNFT Creator', intro: 'Mint gasless NFTs and Compressed NFTs on Solana Devnet', category: 'Tools', tags: ['NFT', 'cNFT', 'Gasless'], image: 'https://assets.coingecko.com/coins/images/19224/large/metaplex.png', banner: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&auto=format&fit=crop&q=80', website: '/apps/nft-creator', verified: true },
  { id: 'jupiter', name: 'Jupiter Exchange', intro: 'Leading swap aggregator on Solana with best-price routing across all DEXes', category: 'DeFi', tags: ['DEX', 'Swap', 'Aggregator'], image: 'https://assets.coingecko.com/coins/images/34188/large/jup.png', banner: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&auto=format&fit=crop&q=80', website: 'https://jup.ag', verified: true },
  { id: 'raydium', name: 'Raydium', intro: 'AMM and concentrated liquidity provider for Solana ecosystem', category: 'DeFi', tags: ['AMM', 'Liquidity', 'Yield'], image: 'https://assets.coingecko.com/coins/images/13917/large/raydium.png', banner: 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=600&auto=format&fit=crop&q=80', website: 'https://raydium.io', verified: true },
  { id: 'tensor', name: 'Tensor', intro: 'Professional NFT marketplace and real-time trading platform', category: 'NFT', tags: ['NFT', 'Marketplace', 'Trading'], image: 'https://assets.coingecko.com/coins/images/36820/large/tnsr.png', banner: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80', website: 'https://tensor.trade', verified: true },
  { id: 'marinade', name: 'Marinade Finance', intro: 'Native and liquid staking protocol for SOL with mSOL rewards', category: 'DeFi', tags: ['Staking', 'mSOL', 'Yield'], image: 'https://assets.coingecko.com/coins/images/17798/large/msol.png', banner: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80', website: 'https://marinade.finance', verified: true },
  { id: 'dialect', name: 'Dialect', intro: 'Web3 messaging, notifications, and on-chain alerts', category: 'Social', tags: ['Messaging', 'Notifications'], image: 'https://assets.coingecko.com/coins/images/31822/large/dialect.png', banner: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=600&auto=format&fit=crop&q=80', website: 'https://dialect.to', verified: true },
  { id: 'magic-eden', name: 'Magic Eden', intro: 'Largest cross-chain NFT marketplace with Solana focus', category: 'NFT', tags: ['NFT', 'Marketplace', 'Collections'], image: 'https://assets.coingecko.com/coins/images/36208/large/ME_Logo_Digital_Gradient.png', banner: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80', website: 'https://magiceden.io', verified: true },
  { id: 'orca', name: 'Orca', intro: 'User-friendly DEX with concentrated liquidity whirlpools', category: 'DeFi', tags: ['DEX', 'Whirlpools', 'Liquidity'], image: 'https://assets.coingecko.com/coins/images/17547/large/Orca_Logo.png', banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80', website: 'https://orca.so', verified: true },
  { id: 'drift', name: 'Drift Protocol', intro: 'Decentralized perpetual futures and spot trading on Solana', category: 'DeFi', tags: ['Perps', 'Trading', 'Futures'], image: 'https://assets.coingecko.com/coins/images/37390/large/drift.png', banner: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80', website: 'https://drift.trade', verified: true },
  { id: 'jito', name: 'Jito', intro: 'MEV-optimized liquid staking with JitoSOL and enhanced validator rewards', category: 'DeFi', tags: ['Staking', 'MEV', 'JitoSOL'], image: 'https://assets.coingecko.com/coins/images/33481/large/jto.png', banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', website: 'https://jito.network', verified: true },
  { id: 'metaplex', name: 'Metaplex', intro: 'NFT protocol and creators tools — Core, Bubblegum, Candy Machine', category: 'Tools', tags: ['NFT', 'Protocol', 'Creator'], image: 'https://assets.coingecko.com/coins/images/19224/large/metaplex.png', banner: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80', website: 'https://metaplex.com', verified: true },
  { id: 'realms', name: 'Realms', intro: 'On-chain governance and DAO voting platform for Solana protocols', category: 'Social', tags: ['DAO', 'Governance', 'Voting'], image: 'https://assets.coingecko.com/coins/images/26359/large/realms.png', banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80', website: 'https://realms.today', verified: true },
  { id: 'squads', name: 'Squads', intro: 'Multisig wallet and treasury management for teams and DAOs', category: 'Tools', tags: ['Multisig', 'Treasury', 'Security'], image: 'https://assets.coingecko.com/coins/images/30746/large/squads.png', banner: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80', website: 'https://squads.so', verified: true },
  { id: 'drip', name: 'DRiP', intro: 'Free collectibles and NFT drops from Solana artists and creators', category: 'NFT', tags: ['Drops', 'Art', 'Free'], image: 'https://assets.coingecko.com/coins/images/32822/large/drip.jpg', banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80', website: 'https://drip.haus', verified: true },
  { id: 'phantom', name: 'Phantom', intro: 'The friendly crypto wallet for Solana, Ethereum, and Bitcoin', category: 'Tools', tags: ['Wallet', 'Browser', 'Multi-chain'], image: 'https://assets.coingecko.com/coins/images/29283/large/phantom.png', banner: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&auto=format&fit=crop&q=80', website: 'https://phantom.app', verified: true },
  { id: 'solpay', name: 'SolPay Mini', intro: 'Fast, secure, and decentralized merchant payments on Solana Pay protocol', category: 'DeFi', tags: ['Payments', 'Merchant', 'SolPay'], image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', banner: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80', website: 'https://solpay.solana.com', verified: true },
  { id: 'orbit-dex', name: 'Orbit Dex', intro: 'High-frequency orderbook and AMM trading platform on Solana', category: 'DeFi', tags: ['DEX', 'Trading', 'Orderbook'], image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', banner: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&auto=format&fit=crop&q=80', website: 'https://orbit.exchange', verified: true },
  { id: 'ripple-chat', name: 'RippleChat', intro: 'End-to-end encrypted messaging and group chats on Solana Identity', category: 'Social', tags: ['Messaging', 'Encrypted', 'Chat'], image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', banner: 'https://images.unsplash.com/photo-1611605698335-8b15d27e03f2?w=600&auto=format&fit=crop&q=80', website: 'https://ripple.chat', verified: true },
  { id: 'keystone-tools', name: 'Keystone Tools', intro: 'Security configuration utilities and airgapped key diagnostics', category: 'Tools', tags: ['Security', 'Diagnostics', 'Hardware'], image: 'https://assets.coingecko.com/coins/images/10365/large/Key.png', banner: 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?w=600&auto=format&fit=crop&q=80', website: 'https://keystone.tools', verified: true },
  { id: 'solana-social', name: 'Solana Social', intro: 'Decentralized social networking protocol and profile indexer', category: 'Social', tags: ['Social', 'Networking', 'Profiles'], image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', banner: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80', website: 'https://solana.social', verified: true },
  { id: 'pyth-network', name: 'Pyth Network', intro: 'First-party financial oracle network providing real-time market data to smart contracts', category: 'Tools', tags: ['Oracle', 'Data', 'Feeds'], image: 'https://assets.coingecko.com/coins/images/31924/large/pyth.png', banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80', website: 'https://pyth.network', verified: true },
  { id: 'kamino-finance', name: 'Kamino Finance', intro: 'One-stop DeFi shop on Solana combining Lending, Liquidity, and Leverage', category: 'DeFi', tags: ['Lending', 'Liquidity', 'Leverage'], image: 'https://assets.coingecko.com/coins/images/36881/large/kamino.png', banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', website: 'https://kamino.finance', verified: true },
  { id: 'marginfi', name: 'Marginfi', intro: 'Decentralized lending protocol on Solana prioritizing risk management and yield', category: 'DeFi', tags: ['Lending', 'Borrowing', 'Yield'], image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', banner: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&auto=format&fit=crop&q=80', website: 'https://marginfi.com', verified: true },
  { id: 'helius', name: 'Helius', intro: 'The leading developer platform on Solana for RPCs, APIs, and Webhooks', category: 'Tools', tags: ['RPC', 'APIs', 'Developer'], image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80', website: 'https://helius.dev', verified: true },
  { id: 'helium', name: 'Helium', intro: 'Decentralized wireless infrastructure network built on Solana blockchain', category: 'Social', tags: ['IoT', 'Mobile', 'Wireless'], image: 'https://assets.coingecko.com/coins/images/13554/large/hnt.png', banner: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80', website: 'https://helium.com', verified: true },
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
  setRateUsdToVnd: (rate: number) => void;
  fetchExchangeRate: () => Promise<void>;
  recordOnrampPurchase: (
    amount: number,
    fiat: Fiat,
    token: TokenSym,
    orderId: string
  ) => void;
  swapReal: (fromToken: TokenSym, toToken: TokenSym, amount: number, slippage?: number) => Promise<SwapResult | false>;
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
    priceUsd: 0.0,
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
        setRateUsdToVnd: (rateUsdToVnd) => set({ rateUsdToVnd }),
        fetchExchangeRate: async () => {
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
            const response = await fetch(`${apiBase}/api/orders/exchange-rate`);
            if (response.ok) {
              const data = await response.json();
              if (data && typeof data.rate === 'number') {
                set({ rateUsdToVnd: data.rate });
              }
            }
          } catch (error) {
            console.error('Failed to fetch exchange rate:', error);
          }
        },
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
            get().fetchExchangeRate().catch(console.error);
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

        swapReal: async (fromToken: TokenSym, toToken: TokenSym, amount: number, slippage?: number) => {
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
            const slippageBps = slippage ? Math.round(slippage * 100) : 50;
            const quote = await getSwapQuote(fromMint, toMint, rawAmount, slippageBps);
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
          
          // Set explicit logout flag to prevent WalletSync from auto-restoring
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('lazorkit-explicit-logout', 'true');
              
              // Clear passkey and session data
              localStorage.removeItem('lazorkit-passkey-data');
              localStorage.removeItem('lz_last_ref');
              
              // Clear SDK internal session keys
              localStorage.removeItem('lazorkit-smart-wallet-id-devnet');
              localStorage.removeItem('lazorkit-smart-wallet-id-mainnet');
              
              // Clear any other lazorkit-* keys the SDK may have set
              const keysToRemove: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('lazorkit-') || key.startsWith('lz_')) && key !== 'lazorkit-wallet-storage' && key !== 'lazorkit-explicit-logout') {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => localStorage.removeItem(key));
              
              // Also clear the persisted zustand store to prevent stale hasWallet=true
              localStorage.removeItem('lazorkit-wallet-storage');
            } catch (e) {
              console.warn('Failed to clear localStorage:', e);
            }
          }
          
          // Redirect to root after logout
          if (typeof window !== 'undefined') {
            window.location.href = '/';
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
