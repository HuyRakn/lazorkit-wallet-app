const express = require('express');
const { createChallenge, verifyChallenge } = require('../utils/siws');
const { requireWallet } = require('../middleware/authenticate');

const router = express.Router();

// Step 1: one-time sign-in message for a wallet
router.get('/nonce', (req, res) => {
  try {
    const uri = req.get('origin') || 'https://localhost:3000';
    res.json(createChallenge(String(req.query.wallet || ''), uri));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Step 2: verify the passkey signature against the wallet's on-chain authority → JWT
router.post('/verify', async (req, res) => {
  try {
    res.json(await verifyChallenge(req.body));
  } catch (err) {
    if ((err.status || 500) >= 500) console.error('[auth] verify failed', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Who am I (token check)
router.get('/me', requireWallet, (req, res) => {
  res.json({ wallet: req.wallet });
});

module.exports = router;
