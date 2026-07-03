const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');

// Simulated real-time posts feed generator
let simulationInterval = null;

const simulatedUsers = [
  'HuyR8sN2K9sd7x1k9aPq7uKyT8x9z2aB',
  'Alex9sD2K9sd7x1k9aPq7uKyT8x9z2aC',
  'SolD8sN2K9sd7x1k9aPq7uKyT8x9z2aD',
  'DeFi9sN2K9sd7x1k9aPq7uKyT8x9z2aE',
  'Whal8sN2K9sd7x1k9aPq7uKyT8x9z2aF',
  'Meme9sN2K9sd7x1k9aPq7uKyT8x9z2aG',
  'DevN8sN2K9sd7x1k9aPq7uKyT8x9z2aH',
  'Node9sN2K9sd7x1k9aPq7uKyT8x9z2aI',
];

const simulatedContents = [
  "Just swapped 50 SOL for USDC on Jupiter. Price impact is extremely low today!",
  "LazorKit MPC wallet integration was so smooth. Highly recommend checking out the passkey security.",
  "Solana Devnet transactions are incredibly fast, ping is currently under 300ms!",
  "Orca CLMM pools are printing fees today. Yield is crazy.",
  "A new cNFT collection just dropped on Tensor. Minting now!",
  "Solana Mobile Seeker looks like a game changer for dApp store accessibility.",
  "Just deployed a new anchor program on Devnet. Works flawlessly!",
  "Whale alert: 50,000 SOL transferred from Unknown Wallet to Binance.",
  "Jito staking rewards just hit. Compounding immediately.",
  "Pyth network feeds are extremely accurate. Best oracle in the space.",
  "Checking out the new RampFi portal. The dual-column layout is gorgeous!",
  "Solana Gas fees are still practically zero. Ethereum devs are missing out.",
  "Jupiter LFG launchpad is getting crowded. Lots of exciting projects coming up.",
  "Just minted my first compressed NFT on Solana. Gas fee was only 0.00001 SOL!",
  "Solana network stability has been 100% for the last 6 months. Bullish!",
  "Liquid staking on Solana with Marinade (mSOL) is super simple. 8% APY!",
  "Send transaction of 1,000 USDC completed in 2.3 seconds on Devnet.",
  "Checking out Orca whirlpools. Concentrated liquidity is awesome.",
  "Raydium V4 pools are seeing huge volume today.",
  "Anyone else tracking the new SPL token standards? Extensions are huge.",
];

const startSimulatedFeed = () => {
  if (simulationInterval) return;

  console.log('🚀 Starting real-time feed simulation...');
  simulationInterval = setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return; // Only execute if MongoDB is connected
      }

      const randomUser = simulatedUsers[Math.floor(Math.random() * simulatedUsers.length)];
      const randomContent = simulatedContents[Math.floor(Math.random() * simulatedContents.length)];
      
      const newPost = new Post({
        walletAddress: randomUser,
        content: randomContent,
        type: 'user',
        likes: [],
        comments: []
      });

      await newPost.save();
      console.log('🌱 Simulated a new real-time post:', randomContent.slice(0, 35) + '...');
      
      // Keep DB clean: if posts count > 100, delete oldest
      const count = await Post.countDocuments();
      if (count > 100) {
        const oldest = await Post.find().sort({ createdAt: 1 }).limit(count - 100);
        const ids = oldest.map(p => p._id);
        await Post.deleteMany({ _id: { $in: ids } });
      }
    } catch (err) {
      console.error('Failed to run feed simulation step:', err);
    }
  }, 10000); // Create a post every 10 seconds
};

// Start simulation on import
startSimulatedFeed();

// Get feed posts (with pagination)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments();

    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (err) {
    console.error('Failed to fetch posts:', err);
    res.status(500).json({ error: 'Failed to retrieve posts feed' });
  }
});

// Create a new post
router.post('/', async (req, res) => {
  try {
    const { walletAddress, content } = req.body;

    if (!walletAddress || !content) {
      return res.status(400).json({ error: 'Wallet address and content are required' });
    }

    if (content.length > 280) {
      return res.status(400).json({ error: 'Post content exceeds 280 characters limit' });
    }

    const newPost = new Post({
      walletAddress,
      content,
      type: 'user',
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    console.error('Failed to create post:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Like / Unlike a post
router.post('/:id/like', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const { id } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required to like a post' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(walletAddress);
    if (likeIndex > -1) {
      // Already liked, so unlike it
      post.likes.splice(likeIndex, 1);
    } else {
      // Like it
      post.likes.push(walletAddress);
    }

    await post.save();
    res.json({ id: post._id, likes: post.likes });
  } catch (err) {
    console.error('Failed to toggle like:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Comment on a post
router.post('/:id/comment', async (req, res) => {
  try {
    const { walletAddress, content } = req.body;
    const { id } = req.params;

    if (!walletAddress || !content) {
      return res.status(400).json({ error: 'Wallet address and content are required' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.comments.push({
      walletAddress,
      content,
      timestamp: new Date(),
    });

    await post.save();
    res.json(post);
  } catch (err) {
    console.error('Failed to add comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

module.exports = router;
