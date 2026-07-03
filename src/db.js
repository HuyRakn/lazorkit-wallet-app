const mongoose = require('mongoose');
const Order = require('./models/Order');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const conn = await mongoose.connect(mongoUri);

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Seed initial posts if empty
    try {
      const Post = require('./models/Post');
      const count = await Post.countDocuments();
      if (count === 0) {
        console.log('🌱 Seeding initial posts feed...');
        const initialPosts = [
          {
            walletAddress: 'System',
            content: 'Colosseum and Solana Foundation launch the Radar Hackathon. Developers globally compete for $1 million in track prizes and access to seed funding.',
            type: 'news',
            metadata: {
              title: 'Solana Radar Hackathon Launching with $1M in Global Prizes',
              source: 'Solana Foundation',
              url: 'https://solana.com/news/radar-hackathon',
              image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop',
            }
          },
          {
            walletAddress: 'System',
            content: 'Explore active bounties, deep-dives, writing tasks, and development grants on Superteam Earn. Build tools for Solana and earn stablecoins directly.',
            type: 'news',
            metadata: {
              title: 'Superteam Earn: Live Solana Developer Bounties & Grants worth $50,000',
              source: 'Superteam Earn',
              url: 'https://earn.superteam.fun',
              image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=600&auto=format&fit=crop',
            }
          },
          {
            walletAddress: 'System',
            content: 'Colosseum announces the grand champions and category winners of the Renaissance Hackathon. Discover outstanding new DeFi and consumer products on Solana.',
            type: 'news',
            metadata: {
              title: 'Solana Renaissance Hackathon Winners Revealed: The Next Wave of Web3 Innovators',
              source: 'Colosseum',
              url: 'https://www.colosseum.org/renaissance',
              image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
            }
          }
        ];
        await Post.insertMany(initialPosts);
        console.log('✅ Seeding completed!');
      }
    } catch (e) {
      console.warn('Unable to seed posts:', e?.message);
    }

    // Ensure no legacy TTL index remains on orders.expiresAt
    try {
      const ordersCol = mongoose.connection.db.collection('orders');
      const indexes = await ordersCol.indexes();
      for (const idx of indexes) {
        const isExpiresAt = idx.key && idx.key.expiresAt === 1;
        const isTTL = typeof idx.expireAfterSeconds === 'number';
        if (isExpiresAt && isTTL) {
          console.warn(`⚠️  Dropping legacy TTL index on orders.expiresAt: ${idx.name}`);
          await ordersCol.dropIndex(idx.name);
        }
      }
      // Recreate non-TTL index (model also defines this, but ensure immediately)
      await ordersCol.createIndex({ expiresAt: 1 });
    } catch (e) {
      console.warn('Unable to verify/drop legacy TTL index on orders.expiresAt:', e?.message || e);
    }

    // Create device shares collection indexes
    try {
      const deviceSharesCol = mongoose.connection.db.collection('deviceshares');
      await deviceSharesCol.createIndex({ shareId: 1 }, { unique: true });
      await deviceSharesCol.createIndex({ walletAddress: 1, status: 1 });
      await deviceSharesCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (e) {
      console.warn('Unable to create device shares indexes:', e?.message || e);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnected = false;
    throw error;
  }
};

const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected');
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB,
  isConnected: () => isConnected
};
