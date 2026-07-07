/**
 * Solana Feed Engine — RSS Aggregator + On-Chain Activity Monitor
 * 
 * Aggregates news from multiple FREE RSS/Atom feeds and combines with
 * simulated on-chain activity for a rich, real-time feed experience.
 * 
 * Sources: Solana Blog, CoinDesk, The Block, Cointelegraph
 * Update interval: 60s for RSS, 30s for on-chain activity
 */

const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'RampFi/1.0 RSS Aggregator',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
  customFields: {
    item: [['media:content', 'media'], ['media:thumbnail', 'mediaThumbnail']],
  },
});

// ── FREE RSS Sources (no API key needed) ──
const RSS_SOURCES = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    icon: '📰',
    category: 'news',
    filter: (item) => {
      const title = (item.title || '').toLowerCase();
      const content = (item.contentSnippet || '').toLowerCase();
      return title.includes('solana') || title.includes('sol') || 
             title.includes('defi') || title.includes('nft') ||
             title.includes('crypto') || title.includes('web3') ||
             content.includes('solana');
    },
  },
  {
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
    icon: '⚡',
    category: 'news',
    filter: (item) => {
      const title = (item.title || '').toLowerCase();
      return title.includes('solana') || title.includes('defi') || 
             title.includes('nft') || title.includes('crypto') ||
             title.includes('blockchain') || title.includes('token');
    },
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    icon: '🧱',
    category: 'news',
    filter: (item) => {
      const title = (item.title || '').toLowerCase();
      return title.includes('solana') || title.includes('defi') || 
             title.includes('nft') || title.includes('crypto') ||
             title.includes('web3');
    },
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    icon: '🔓',
    category: 'news',
    filter: (item) => {
      const title = (item.title || '').toLowerCase();
      return title.includes('solana') || title.includes('defi') || 
             title.includes('nft') || title.includes('web3') ||
             title.includes('blockchain');
    },
  },
];

// ── In-Memory Cache ──
let cachedArticles = [];
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds
const MAX_ARTICLES = 50;

// ── Deduplication Set (by URL hash) ──
const seenUrls = new Set();

/**
 * Extract image URL from RSS item
 */
function extractImage(item) {
  // Try media:content
  if (item.media && item.media.$ && item.media.$.url) {
    return item.media.$.url;
  }
  // Try media:thumbnail
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  // Try enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  // Try to extract from content HTML
  if (item.content) {
    const match = item.content.match(/<img[^>]+src="([^"]+)"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch all RSS feeds concurrently with error tolerance
 */
async function fetchAllFeeds() {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        const items = (feed.items || [])
          .filter(source.filter)
          .slice(0, 8) // Max 8 articles per source
          .map((item) => ({
            title: (item.title || '').trim(),
            source: source.name,
            sourceIcon: source.icon,
            url: item.link || item.guid || '',
            image: extractImage(item) || `https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=400&auto=format&fit=crop`,
            content: (item.contentSnippet || item.content || '').slice(0, 200).trim(),
            createdAt: item.isoDate || item.pubDate || new Date().toISOString(),
            category: source.category,
          }));
        return items;
      } catch (err) {
        console.warn(`⚠️  RSS fetch failed for ${source.name}:`, err.message);
        return [];
      }
    })
  );

  const allItems = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return allItems;
}

/**
 * Get cached or fresh articles
 */
async function getArticles(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedArticles.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
    return cachedArticles;
  }

  try {
    const freshItems = await fetchAllFeeds();

    // Deduplicate by URL
    const unique = [];
    for (const item of freshItems) {
      if (!seenUrls.has(item.url) && item.title) {
        seenUrls.add(item.url);
        unique.push(item);
      }
    }

    // Merge with existing cache (prepend new items)
    const merged = [...unique, ...cachedArticles];

    // Sort by date descending
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Trim to max
    cachedArticles = merged.slice(0, MAX_ARTICLES);
    lastFetchTime = now;

    // Clean up dedup set if too large
    if (seenUrls.size > 500) {
      seenUrls.clear();
      cachedArticles.forEach((a) => seenUrls.add(a.url));
    }

    console.log(`📡 RSS Feed refreshed: ${unique.length} new articles, ${cachedArticles.length} total cached`);
    return cachedArticles;
  } catch (err) {
    console.error('❌ RSS Feed engine error:', err);
    return cachedArticles; // Return stale cache on error
  }
}

/**
 * Start background refresh interval
 */
let refreshInterval = null;

function startFeedEngine() {
  if (refreshInterval) return;

  console.log('🚀 Starting RampFi RSS Feed Engine...');
  
  // Initial fetch
  getArticles(true).catch(console.error);

  // Refresh every 60 seconds
  refreshInterval = setInterval(() => {
    getArticles(true).catch(console.error);
  }, CACHE_TTL);
}

function stopFeedEngine() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('🛑 RSS Feed Engine stopped');
  }
}

module.exports = {
  getArticles,
  startFeedEngine,
  stopFeedEngine,
  RSS_SOURCES,
};
