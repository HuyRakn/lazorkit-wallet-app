const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['user', 'news', 'alert'],
    default: 'user',
    index: true,
  },
  likes: {
    type: [String], // Array of wallet addresses
    default: [],
  },
  comments: {
    type: [commentSchema],
    default: [],
  },
  // Extra fields for news or market alert items
  metadata: {
    title: String,
    source: String,
    url: String,
    image: String,
    symbol: String,
    priceChange: Number,
    priceUsd: Number,
  },
}, {
  timestamps: true,
});

// Indexes for fast querying & sorting by date
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
