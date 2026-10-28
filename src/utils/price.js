/**
 * Live SOL/USD price for backend payouts (onramp SOL delivery).
 * Sources in order: CoinGecko → Jupiter lite price API. Cached for 60s.
 */
const CACHE_MS = 60 * 1000;
let cache = { price: null, at: 0 };

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getSolPriceUsd() {
  if (cache.price && Date.now() - cache.at < CACHE_MS) return cache.price;

  const sources = [
    async () => {
      const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      return Number(j?.solana?.usd);
    },
    async () => {
      const mint = 'So11111111111111111111111111111111111111112';
      const j = await fetchJson(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
      return Number(j?.[mint]?.usdPrice);
    },
  ];

  for (const source of sources) {
    try {
      const price = await source();
      if (Number.isFinite(price) && price > 0) {
        cache = { price, at: Date.now() };
        return price;
      }
    } catch (e) {
      console.warn('[price] source failed:', e?.message || e);
    }
  }
  if (cache.price) return cache.price; // stale but better than nothing
  throw new Error('SOL price unavailable');
}

module.exports = { getSolPriceUsd };
