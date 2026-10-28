/**
 * Real on-chain activity feed for Solana Devnet.
 * Aggregates:
 * 1. Confirmed swaps on RampFi Raydium CPMM Pool (4bk4BXegXmuCbUpYDoARNV2KYvtCLL7stp64GnaKyiEF)
 * 2. Onramp payout transactions from Order records
 * 3. Faucet claim transactions
 */
const express = require('express');
const { PublicKey } = require('@solana/web3.js');
const { getConnection } = require('../utils/solana');
const devnetPool = require('../config/devnet-pool.json');
const Order = require('../models/Order');
const FaucetClaim = require('../models/FaucetClaim');
const mongoose = require('mongoose');

const router = express.Router();
let cache = { at: 0, items: [] };
const CACHE_MS = 10000;

router.get('/onchain', async (req, res) => {
  try {
    const now = Date.now();
    if (now - cache.at < CACHE_MS && cache.items.length > 0) {
      return res.json(cache.items);
    }

    const connection = getConnection();
    const poolPubkey = new PublicKey(devnetPool.poolId);

    // 1. Fetch recent signatures on the Raydium CPMM pool
    const poolSigs = await connection.getSignaturesForAddress(poolPubkey, { limit: 10 }).catch(() => []);
    const swapItems = poolSigs
      .filter((s) => !s.err)
      .map((s) => ({
        id: s.signature,
        type: 'swap',
        summary: 'Raydium CPMM Swap (SOL ↔ rUSDC)',
        tx: s.signature,
        timestamp: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : new Date().toISOString(),
        status: 'Success',
      }));

    // 2. Fetch recent onramp orders with transaction signatures
    let onrampItems = [];
    if (mongoose.connection.readyState === 1) {
      const orders = await Order.find({ txSignature: { $exists: true, $ne: null } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(() => []);

      onrampItems = orders.map((o) => ({
        id: o.txSignature,
        type: 'onramp',
        summary: `Onramp Payout ${o.tokenAmount || ''} rUSDC`,
        tx: o.txSignature,
        timestamp: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
        status: 'Success',
      }));
    }

    // 3. Fetch recent faucet claims
    let faucetItems = [];
    if (mongoose.connection.readyState === 1) {
      const claims = await FaucetClaim.find({ 'sol.signature': { $exists: true, $ne: null } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(() => []);

      faucetItems = claims.map((c) => ({
        id: c.sol.signature,
        type: 'faucet',
        summary: 'Devnet Faucet Claim (SOL + rUSDC)',
        tx: c.sol.signature,
        timestamp: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        status: 'Success',
      }));
    }

    const all = [...swapItems, ...onrampItems, ...faucetItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    cache = { at: now, items: all };
    res.json(all);
  } catch (err) {
    console.error('[feed/onchain]', err);
    res.status(500).json({ error: 'Failed to fetch onchain activity feed' });
  }
});

module.exports = router;
