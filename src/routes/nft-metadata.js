const express = require('express');
const router = express.Router();

// In-memory store for NFT metadata
const metadataStore = new Map();

// Cleanup old entries after 24 hours
const METADATA_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, value] of metadataStore.entries()) {
    if (now - value.createdAt > METADATA_TTL_MS) {
      metadataStore.delete(key);
    }
  }
}

setInterval(cleanupOldEntries, 60 * 60 * 1000);

/**
 * GET /api/nft-metadata/:mint
 * Returns JSON metadata for an NFT
 */
router.get('/:mint', (req, res) => {
  const { mint } = req.params;

  if (!mint) {
    return res.status(400).json({ error: 'Mint address is required' });
  }

  const stored = metadataStore.get(mint);
  const isCompressed = mint.startsWith('cnft');
  const symbol = isCompressed ? 'cLKST' : 'LKST';

  // Build absolute URLs for mock image placeholders
  const host = req.headers.host || 'localhost:3001';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  
  // Next.js static asset endpoint for placeholder
  const frontendUrl = protocol + '://' + host.replace(':3001', ':3000');
  const imageUrl = `${frontendUrl}/placeholder.svg`;

  const metadata = {
    name: stored?.name || 'LazorKit NFT',
    symbol,
    description: stored?.description || 'An NFT minted with LazorKit - gasless and seamless!',
    image: imageUrl,
    properties: {
      files: [{ uri: imageUrl, type: 'image/svg+xml' }],
      category: 'image',
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  return res.json(metadata);
});

/**
 * POST /api/nft-metadata/:mint
 * Store metadata for an NFT before minting
 */
router.post('/:mint', (req, res) => {
  const { mint } = req.params;
  const { name, description } = req.body;

  if (!mint) {
    return res.status(400).json({ error: 'Mint address is required' });
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!description || typeof description !== 'string' || description.trim() === '') {
    return res.status(400).json({ error: 'Description is required' });
  }

  if (name.length > 32) {
    return res.status(400).json({ error: 'Name must be 32 characters or less' });
  }

  if (description.length > 200) {
    return res.status(400).json({ error: 'Description must be 200 characters or less' });
  }

  // Store in-memory
  metadataStore.set(mint, {
    name: name.trim(),
    description: description.trim(),
    createdAt: Date.now(),
  });

  const host = req.headers.host || 'localhost:3001';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  return res.json({
    success: true,
    metadataUri: `${baseUrl}/api/nft-metadata/${mint}`,
  });
});

module.exports = router;
