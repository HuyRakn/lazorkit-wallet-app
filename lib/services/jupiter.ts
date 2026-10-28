import { Connection, PublicKey } from '@solana/web3.js';

export type SwapMode = 'ExactIn' | 'ExactOut';

export interface JupiterToken {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  holderCount?: number;
  isVerified?: boolean;
  tags?: string[];
  change24hPct?: number;
}

export interface SwapQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: SwapMode;
  slippageBps: number;
  platformFee?: unknown;
  priceImpactPct?: string;
  routePlan?: unknown[];
}

export interface SwapTransaction {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

// RPC endpoint từ biến môi trường, mặc định devnet
const RAW_ENV_RPC = process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
const ENV_RPC = RAW_ENV_RPC.includes('47712b7a-ea63-49b8-9685-dff77d9eb55a')
  ? 'https://api.devnet.solana.com'
  : RAW_ENV_RPC;

const RPC_ENDPOINTS = {
  env: ENV_RPC,
} as const;

// Real on-chain Devnet rUSDC mint controlled by the RampFi treasury
export const APP_USDC_MINT =
  process.env.NEXT_PUBLIC_USDC_MINT || 'RSLc86ULA3mxeapSrAZ9qo3jFUjZNaqrzpXkMGH5BYo';

// Tokens with active on-chain Devnet liquidity in the RampFi Raydium CPMM pool
export const DEVNET_TRADABLE_TOKENS = ['SOL', 'USDC'] as const;

// Common token addresses on Solana (Devnet)
export const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: APP_USDC_MINT,
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
} as const;

// Common token decimals (fallback when API metadata not available)
export const TOKEN_DECIMALS: Record<keyof typeof TOKEN_ADDRESSES, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  RAY: 6,
  JUP: 6,
  ORCA: 6,
  mSOL: 9,
  JitoSOL: 9,
  PYTH: 6,
};

export function getSymbolDecimals(symbol: string, jupToken?: JupiterToken): number {
  if (jupToken && typeof jupToken.decimals === 'number') return jupToken.decimals;
  const key = symbol as keyof typeof TOKEN_DECIMALS;
  return TOKEN_DECIMALS[key] ?? 9;
}

// Create connection instances
export const connections = {
  env: new Connection(RPC_ENDPOINTS.env, 'confirmed'),
};

export const defaultConnection = connections.env;

// Cache for token data
const tokenCache = new Map<string, JupiterToken>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const requestQueue = new Map<string, Promise<JupiterToken | null>>();
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 1000;
const lastFetchTime = new Map<string, number>();

const MAINNET_LOOKUP_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export async function fetchTokenData(
  symbolOrAddress: string
): Promise<JupiterToken | null> {
  const cacheKey = symbolOrAddress.toUpperCase();
  const cached = tokenCache.get(cacheKey);
  const lastFetch = lastFetchTime.get(cacheKey) || 0;

  if (cached && Date.now() - lastFetch < CACHE_DURATION) {
    return cached;
  }

  if (requestQueue.has(cacheKey)) {
    return (await requestQueue.get(cacheKey)) ?? null;
  }

  const lastRequest = lastRequestTime.get(cacheKey) || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  const requestPromise = (async () => {
    try {
      const query =
        MAINNET_LOOKUP_MINTS[cacheKey] ||
        TOKEN_ADDRESSES[cacheKey as keyof typeof TOKEN_ADDRESSES] ||
        symbolOrAddress;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://lite-api.jup.ag/tokens/v2/search?query=${query}`,
        {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          return cached || null;
        }
        throw new Error(`Failed to fetch token data: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        return null;
      }

      const token = data[0];
      const result: JupiterToken = {
        id: cacheKey === 'USDC' ? APP_USDC_MINT : token.id,
        name: token.name,
        symbol: token.symbol,
        icon: token.icon,
        decimals: token.decimals,
        fdv: token.fdv,
        mcap: token.mcap,
        usdPrice: token.usdPrice,
        liquidity: token.liquidity,
        holderCount: token.holderCount,
        isVerified: token.isVerified,
        tags: token.tags,
        change24hPct: token.change24hPct || token.priceChange24h,
      };

      tokenCache.set(cacheKey, result);
      lastFetchTime.set(cacheKey, Date.now());
      lastRequestTime.set(cacheKey, Date.now());

      return result;
    } catch {
      return cached || null;
    } finally {
      requestQueue.delete(cacheKey);
    }
  })();

  requestQueue.set(cacheKey, requestPromise);
  return await requestPromise;
}

export async function fetchCommonTokens(): Promise<Map<string, JupiterToken>> {
  const tokens = new Map<string, JupiterToken>();
  const symbols = ['SOL', 'USDC', 'USDT', 'BONK', 'RAY', 'JUP', 'ORCA', 'mSOL', 'JitoSOL', 'PYTH'];
  const results = await Promise.all(symbols.map((symbol) => fetchTokenData(symbol)));

  results.forEach((token, index) => {
    if (token) {
      tokens.set(symbols[index], token);
    }
  });

  return tokens;
}

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<SwapQuote | null> {
  try {
    if (!inputMint || !outputMint || !amount || amount <= 0) {
      return null;
    }
    const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
    const url = `${backendBase}/api/jupiter/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${amount}&slippageBps=${slippageBps}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.inputMint || !data.outputMint || !data.inAmount || !data.outAmount) {
      return null;
    }
    return data as SwapQuote;
  } catch {
    return null;
  }
}

export async function getSwapTransaction(
  quote: SwapQuote,
  userPublicKey: string,
  wrapAndUnwrapSol: boolean = true
): Promise<SwapTransaction | null> {
  try {
    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get swap transaction: ${response.statusText}`);
    }
    return await response.json();
  } catch {
    return null;
  }
}

export async function getTokenBalance(
  walletAddress: string,
  tokenMint: string,
  connection: Connection = defaultConnection
): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const mintPublicKey = new PublicKey(tokenMint);

    if (tokenMint === TOKEN_ADDRESSES.SOL) {
      const balance = await connection.getBalance(publicKey);
      return balance / 1e9;
    }

    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: mintPublicKey,
      });
      if (tokenAccounts.value.length === 0) return 0;
      return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    } catch (mintError: any) {
      if (
        mintError.message?.includes('could not find mint') ||
        mintError.message?.includes('Token mint could not be unpacked')
      ) {
        return 0;
      }
      throw mintError;
    }
  } catch {
    return 0;
  }
}

export async function getAllTokenBalances(
  walletAddress: string,
  connection: Connection = defaultConnection
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  try {
    const publicKey = new PublicKey(walletAddress);
    const solBalance = await connection.getBalance(publicKey);
    balances.set(TOKEN_ADDRESSES.SOL, solBalance / 1e9);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed.info.mint;
      const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
      if (balance && balance > 0) {
        balances.set(mint, balance);
      }
    }
  } catch (error) {
    console.error('Error getting all token balances:', error);
  }
  return balances;
}

