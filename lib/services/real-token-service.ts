import { Connection, PublicKey } from '@solana/web3.js';
import { JupiterToken, fetchTokenData, getAllTokenBalances, defaultConnection, TOKEN_ADDRESSES } from './jupiter';
import { TokenHolding } from '@/lib/types';


export interface RealTokenData {
  symbol: string;
  amount: number;
  priceUsd: number;
  change24hPct: number;
  mint: string;
  jupiterData?: JupiterToken;
}

// Cache for real token data
const tokenDataCache = new Map<string, any>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
const lastFetchTime = new Map<string, number>();

export async function fetchRealTokenData(
  walletAddress: string,
  connection: Connection = defaultConnection
): Promise<TokenHolding[]> {
  try {
    const cacheKey = `tokens_${walletAddress}`;
    const lastFetch = lastFetchTime.get(cacheKey) || 0;
    
    // Return cached data if still valid
    if (Date.now() - lastFetch < CACHE_DURATION && tokenDataCache.has(cacheKey)) {
      const cached = tokenDataCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const tokens: TokenHolding[] = [];
    
    // Fetch all balances at once using a batch (only 2 RPC calls: SOL + SPL Token accounts)
    const allBalances = await getAllTokenBalances(walletAddress, connection);
    
    // Fetch data for all supported tokens with rate limiting
    const tokenSymbols = Object.keys(TOKEN_ADDRESSES) as Array<keyof typeof TOKEN_ADDRESSES>;
    
    // Process tokens in batches to avoid rate limiting on Jupiter API
    const batchSize = 3;
    for (let i = 0; i < tokenSymbols.length; i += batchSize) {
      const batch = tokenSymbols.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (symbol) => {
        try {
          const mint = TOKEN_ADDRESSES[symbol];
          
          // Get Jupiter token data (with delay to avoid rate limiting)
          const jupiterData = await fetchTokenData(symbol);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Get real balance from the batch loaded balances
          const balance = allBalances.get(mint) || 0;
          
          // Get price from Jupiter or fallback
          const priceUsd = jupiterData?.usdPrice || getDefaultPrice(symbol);
          
          // Get 24h change from Jupiter or fallback
          const change24hPct = jupiterData?.change24hPct || getDefaultChange(symbol);
          
          const tokenData: TokenHolding = {
            symbol,
            amount: balance,
            priceUsd,
            change24hPct,
            mint,
          };
          
          tokens.push(tokenData);
          
          // Cache individual token data
          const tokenCacheKey = `${symbol}_${walletAddress}`;
          tokenDataCache.set(tokenCacheKey, {
            ...tokenData,
            jupiterData,
          });
          
        } catch (error) {
          console.warn(`Failed to fetch data for ${symbol}:`, error);
          // Add token with zero balance if fetch fails
          tokens.push({
            symbol,
            amount: 0,
            priceUsd: getDefaultPrice(symbol),
            change24hPct: getDefaultChange(symbol),
            mint: TOKEN_ADDRESSES[symbol],
          });
        }
      }));
      
      // Delay between batches
      if (i + batchSize < tokenSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Update cache
    tokenDataCache.set(cacheKey, tokens); // Store all tokens
    lastFetchTime.set(cacheKey, Date.now());
    
    return tokens;
    
  } catch (error) {
    console.error('Error fetching real token data:', error);
    // Return empty array on error
    return [];
  }
}

// Default prices for fallback (return 0 to maintain on-chain integrity)
function getDefaultPrice(symbol: string): number {
  return 0;
}

// Default 24h changes for fallback
function getDefaultChange(symbol: string): number {
  return 0;
}

// Clear cache function
export function clearTokenDataCache(): void {
  tokenDataCache.clear();
  lastFetchTime.clear();
}

// Get cached token data
export function getCachedTokenData(symbol: string, walletAddress: string): RealTokenData | null {
  const cacheKey = `${symbol}_${walletAddress}`;
  return tokenDataCache.get(cacheKey) || null;
}
