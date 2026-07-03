const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env.local');
  process.exit(1);
}

// Define minimal schema
const PostSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);

async function clearPosts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully.');

    console.log('Deleting all posts...');
    const result = await Post.deleteMany({});
    console.log(`Deleted ${result.deletedCount} posts.`);

  } catch (err) {
    console.error('Error clearing posts:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

clearPosts();
