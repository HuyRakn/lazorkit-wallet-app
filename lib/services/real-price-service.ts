export interface LiveTokenPrice {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  tradingViewSymbol: string;
}

const TOKEN_NAMES: Record<string, string> = {
  SOL: 'Solana',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  JUP: 'Jupiter',
  RAY: 'Raydium',
  BONK: 'Bonk',
  USDC: 'USD Coin',
  USDT: 'Tether',
};

const TV_SYMBOLS: Record<string, string> = {
  SOL: 'COINBASE:SOLUSD',
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  JUP: 'BINANCE:JUPUSDT',
  RAY: 'BINANCE:RAYUSDT',
  BONK: 'BINANCE:BONKUSDT',
  USDC: 'KRAKEN:USDCUSD',
  USDT: 'KRAKEN:USDTUSD',
};

const MAINNET_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// In-memory cache
let cachedPrices: Record<string, LiveTokenPrice> | null = null;
let lastFetched = 0;
const CACHE_TTL = 10000; // 10 seconds

export async function fetchLivePrices(): Promise<Record<string, LiveTokenPrice>> {
  const now = Date.now();
  if (cachedPrices && now - lastFetched < CACHE_TTL) {
    return cachedPrices;
  }

  // Fallback default values
  const defaultPrices: Record<string, LiveTokenPrice> = {
    SOL: { symbol: 'SOL', name: 'Solana', priceUsd: 148.52, change24h: 5.42, volume24h: 320000000, tradingViewSymbol: TV_SYMBOLS.SOL },
    BTC: { symbol: 'BTC', name: 'Bitcoin', priceUsd: 110956.00, change24h: 1.25, volume24h: 28000000000, tradingViewSymbol: TV_SYMBOLS.BTC },
    ETH: { symbol: 'ETH', name: 'Ethereum', priceUsd: 3412.50, change24h: -0.45, volume24h: 14000000000, tradingViewSymbol: TV_SYMBOLS.ETH },
    JUP: { symbol: 'JUP', name: 'Jupiter', priceUsd: 0.985, change24h: 8.14, volume24h: 45000000, tradingViewSymbol: TV_SYMBOLS.JUP },
    RAY: { symbol: 'RAY', name: 'Raydium', priceUsd: 1.74, change24h: -2.11, volume24h: 12000000, tradingViewSymbol: TV_SYMBOLS.RAY },
    BONK: { symbol: 'BONK', name: 'Bonk', priceUsd: 0.0000242, change24h: 12.65, volume24h: 85000000, tradingViewSymbol: TV_SYMBOLS.BONK },
    USDC: { symbol: 'USDC', name: 'USD Coin', priceUsd: 1.00, change24h: 0.01, volume24h: 5600000000, tradingViewSymbol: TV_SYMBOLS.USDC },
    USDT: { symbol: 'USDT', name: 'Tether', priceUsd: 1.00, change24h: -0.02, volume24h: 48000000000, tradingViewSymbol: TV_SYMBOLS.USDT },
  };

  try {
    // 1. Fetch Solana tokens from DexScreener API
    // 2. Fetch BTC & ETH from CoinGecko (Jupiter price v2 is deprecated and blocked by CORS)
    // Each source fails independently so one outage doesn't discard the other.
    const solanaMints = Object.values(MAINNET_MINTS).join(',');
    const [dexSettled, cgSettled] = await Promise.allSettled([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${solanaMints}`),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true'),
    ]);
    const dexResponse = dexSettled.status === 'fulfilled' ? dexSettled.value : null;
    const cgResponse = cgSettled.status === 'fulfilled' ? cgSettled.value : null;

    const result: Record<string, LiveTokenPrice> = { ...defaultPrices };

    // Process DexScreener data
    if (dexResponse?.ok) {
      const dexJson = await dexResponse.json();
      const pairs = dexJson.pairs || [];

      // Update tokens with the best liquidity pair from DexScreener
      for (const [symbol, mint] of Object.entries(MAINNET_MINTS)) {
        const tokenPairs = pairs.filter((p: any) => p.baseToken?.address === mint);
        if (tokenPairs.length > 0) {
          // Sort by liquidity or volume desc to get the main pool
          const bestPool = tokenPairs.sort((a: any, b: any) =>
            (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
          )[0];

          if (bestPool) {
            result[symbol] = {
              symbol,
              name: TOKEN_NAMES[symbol] || bestPool.baseToken?.name || symbol,
              priceUsd: parseFloat(bestPool.priceUsd) || defaultPrices[symbol].priceUsd,
              change24h: parseFloat(bestPool.priceChange?.h24) || defaultPrices[symbol].change24h,
              volume24h: parseFloat(bestPool.volume?.h24) || defaultPrices[symbol].volume24h,
              tradingViewSymbol: TV_SYMBOLS[symbol],
            };
          }
        }
      }
    }

    // Process CoinGecko data for BTC & ETH
    if (cgResponse?.ok) {
      const cgJson = await cgResponse.json();
      const ids: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum' };
      for (const [symbol, id] of Object.entries(ids)) {
        const entry = cgJson?.[id];
        if (entry?.usd) {
          result[symbol] = {
            ...result[symbol],
            priceUsd: Number(entry.usd),
            change24h: Number(entry.usd_24h_change ?? defaultPrices[symbol].change24h),
            volume24h: Number(entry.usd_24h_vol ?? defaultPrices[symbol].volume24h),
          };
        }
      }
    }

    cachedPrices = result;
    lastFetched = now;
    return result;
  } catch (error) {
    console.warn('Failed to fetch real-time market data, using cached/offline fallback:', error);
    return cachedPrices || defaultPrices;
  }
}
