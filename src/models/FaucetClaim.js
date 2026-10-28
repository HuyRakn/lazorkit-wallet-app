const mongoose = require('mongoose');

const faucetClaimSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  ip: { type: String, index: true },
  solAmount: Number,
  usdcAmount: Number,
  solSignature: String,
  usdcSignature: String,
}, { timestamps: true });

faucetClaimSchema.index({ walletAddress: 1, createdAt: -1 });

module.exports = mongoose.models.FaucetClaim || mongoose.model('FaucetClaim', faucetClaimSchema);
