/**
 * Devnet faucet: sends a little SOL + rUSDC from the treasury so new passkey
 * wallets can try every on-chain feature (send, swap, NFT, staking) immediately.
 *
 * Limits: one claim per wallet per FAUCET_COOLDOWN_HOURS, FAUCET_MAX_PER_IP per IP
 * in the same window. Disabled automatically on non-dev clusters.
 */
const express = require('express');
const mongoose = require('mongoose');
const FaucetClaim = require('../models/FaucetClaim');
const { transferSolToUser, transferSplTokenToUser } = require('../utils/transfer');
const { isDevCluster, isValidPublicKey } = require('../utils/solana');

const router = express.Router();

const config = () => ({
  sol: Number(process.env.FAUCET_SOL ?? 0.5),
  usdc: Number(process.env.FAUCET_USDC ?? 100),
  cooldownMs: Number(process.env.FAUCET_COOLDOWN_HOURS ?? 24) * 60 * 60 * 1000,
  maxPerIp: Number(process.env.FAUCET_MAX_PER_IP ?? 5),
});

// In-memory fallback when MongoDB is unavailable
const memoryClaims = [];
const inFlight = new Set();
const dbReady = () => mongoose.connection.readyState === 1;

async function lastClaimFor(walletAddress) {
  if (dbReady()) return FaucetClaim.findOne({ walletAddress }).sort({ createdAt: -1 }).lean();
  return memoryClaims.filter(c => c.walletAddress === walletAddress).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

async function ipClaimsSince(ip, since) {
  if (dbReady()) return FaucetClaim.countDocuments({ ip, createdAt: { $gte: since } });
  return memoryClaims.filter(c => c.ip === ip && c.createdAt >= since).length;
}

async function recordClaim(claim) {
  if (dbReady()) return FaucetClaim.create(claim);
  memoryClaims.push({ ...claim, createdAt: new Date() });
  return claim;
}

function nextClaimAt(last, cooldownMs) {
  if (!last) return null;
  const t = new Date(last.createdAt).getTime() + cooldownMs;
  return t > Date.now() ? new Date(t).toISOString() : null;
}

// GET /api/faucet/status/:walletAddress
router.get('/status/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    if (!isValidPublicKey(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' });
    const cfg = config();
    const last = await lastClaimFor(walletAddress);
    const next = nextClaimAt(last, cfg.cooldownMs);
    return res.json({
      enabled: isDevCluster(),
      canClaim: isDevCluster() && !next,
      nextClaimAt: next,
      amounts: { SOL: cfg.sol, USDC: cfg.usdc },
      lastClaim: last ? { solSignature: last.solSignature, usdcSignature: last.usdcSignature, at: last.createdAt } : null,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/faucet  { walletAddress }
router.post('/', async (req, res, next) => {
  const { walletAddress } = req.body || {};
  try {
    if (!isDevCluster()) return res.status(403).json({ error: 'Faucet is only available on devnet' });
    if (!isValidPublicKey(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' });
    if (inFlight.has(walletAddress)) return res.status(409).json({ error: 'Claim already in progress' });

    const cfg = config();
    const last = await lastClaimFor(walletAddress);
    const next = nextClaimAt(last, cfg.cooldownMs);
    if (next) return res.status(429).json({ error: 'Already claimed recently', nextClaimAt: next });

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const ipCount = await ipClaimsSince(ip, new Date(Date.now() - cfg.cooldownMs));
    if (ipCount >= cfg.maxPerIp) return res.status(429).json({ error: 'Too many claims from this network' });

    inFlight.add(walletAddress);
    const result = { walletAddress, ip, solAmount: 0, usdcAmount: 0 };

    if (cfg.sol > 0) {
      const sol = await transferSolToUser(walletAddress, cfg.sol);
      result.solAmount = sol.amount;
      result.solSignature = sol.signature;
    }
    if (cfg.usdc > 0) {
      try {
        const usdc = await transferSplTokenToUser(walletAddress, cfg.usdc);
        result.usdcAmount = cfg.usdc;
        result.usdcSignature = usdc.signature;
      } catch (e) {
        console.warn('[faucet] rUSDC transfer failed (SOL already sent):', e?.message || e);
      }
    }

    await recordClaim(result);
    const cooldownEnd = new Date(Date.now() + cfg.cooldownMs).toISOString();
    return res.json({
      ok: true,
      sol: { amount: result.solAmount, signature: result.solSignature },
      usdc: { amount: result.usdcAmount, signature: result.usdcSignature },
      nextClaimAt: cooldownEnd,
    });
  } catch (err) {
    console.error('[faucet] claim failed:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Faucet claim failed' });
  } finally {
    if (walletAddress) inFlight.delete(walletAddress);
  }
});

module.exports = router;
