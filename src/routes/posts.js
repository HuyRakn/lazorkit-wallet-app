const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');

// No simulated feed — all posts are real user-generated content only
// Posts are created via the POST / endpoint by authenticated wallet users

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
