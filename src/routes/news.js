const express = require('express');
const router = express.Router();
const { getArticles, startFeedEngine } = require('../utils/solana-feed-engine');

// Start the RSS feed engine on import
startFeedEngine();

// ── Curated Solana Ecosystem articles (fallback when RSS is empty) ──
const FALLBACK_ARTICLES = [
  {
    title: 'Solana Radar Hackathon Launching with $1M in Global Prizes',
    source: 'Solana Foundation',
    sourceIcon: '☀️',
    url: 'https://solana.com/news/radar-hackathon',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop',
    content: 'Colosseum and Solana Foundation launch the Radar Hackathon. Developers globally compete for $1 million in track prizes and access to seed funding.',
    createdAt: new Date().toISOString(),
    category: 'news',
  },
  {
    title: 'Superteam Earn: Live Solana Developer Bounties & Grants worth $50,000',
    source: 'Superteam Earn',
    sourceIcon: '🏆',
    url: 'https://earn.superteam.fun',
    image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=600&auto=format&fit=crop',
    content: 'Explore active bounties, deep-dives, writing tasks, and development grants on Superteam Earn. Build tools for Solana and earn stablecoins directly.',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    category: 'news',
  },
  {
    title: 'Solana Renaissance Hackathon Winners Revealed: The Next Wave of Web3 Innovators',
    source: 'Colosseum',
    sourceIcon: '🏟️',
    url: 'https://www.colosseum.org/renaissance',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
    content: 'Colosseum announces the grand champions and category winners of the Renaissance Hackathon. Discover outstanding new DeFi and consumer products on Solana.',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    category: 'news',
  },
  {
    title: 'Metaplex Core: The New Ultra-Lightweight Standard for Solana NFTs',
    source: 'Metaplex',
    sourceIcon: '🎨',
    url: 'https://www.metaplex.com',
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600&auto=format&fit=crop',
    content: 'Metaplex introduces Core, a streamlined NFT protocol that drastically cuts minting costs and computation overhead compared to old Token Metadata standards.',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    category: 'news',
  },
  {
    title: 'Solana Mobile Seeker: Pre-orders Surpass 140,000 Devices Globally',
    source: 'Solana Mobile',
    sourceIcon: '📱',
    url: 'https://solanamobile.com',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=600&auto=format&fit=crop',
    content: 'Solana Mobile announces Seeker, the next-generation web3 smartphone, designed to lower access barriers to decentralized dApps with built-in Seed Vault security.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    category: 'news',
  },
];

/**
 * GET /api/news — Fetch real-time RSS-aggregated articles
 * Falls back to curated Solana articles if RSS returns empty
 */
router.get('/', async (req, res) => {
  try {
    const articles = await getArticles();

    if (articles.length > 0) {
      return res.json(articles);
    }

    // Fallback to curated list if no RSS items found
    return res.json(FALLBACK_ARTICLES);
  } catch (err) {
    console.error('❌ News endpoint error:', err.message);
    return res.json(FALLBACK_ARTICLES);
  }
});

/**
 * GET /api/news/refresh — Force refresh RSS cache
 */
router.get('/refresh', async (req, res) => {
  try {
    const articles = await getArticles(true);
    res.json({
      success: true,
      count: articles.length,
      articles,
    });
  } catch (err) {
    console.error('❌ News refresh error:', err.message);
    res.status(500).json({ error: 'Failed to refresh news feed' });
  }
});

// Fetch trending coins (kept from original)
router.get('/trending', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const coins = (data.coins || []).slice(0, 5).map((item) => ({
        id: item.item.id,
        name: item.item.name,
        symbol: item.item.symbol,
        priceUsd: item.item.data?.price || 0,
        change24h: item.item.data?.price_change_percentage_24h?.usd || 0,
        sparkline: item.item.data?.sparkline || '',
        thumb: item.item.thumb,
      }));
      return res.json(coins);
    }
    throw new Error('CoinGecko trending fetch failed');
  } catch (err) {
    console.warn('Trending CoinGecko API request failed:', err.message);
    const fallbacks = [
      { name: 'Solana', symbol: 'SOL', priceUsd: 148.5, change24h: 5.4 },
      { name: 'Jupiter', symbol: 'JUP', priceUsd: 0.98, change24h: 8.1 },
      { name: 'Raydium', symbol: 'RAY', priceUsd: 1.74, change24h: -2.1 },
    ];
    return res.json(fallbacks);
  }
});

module.exports = router;
