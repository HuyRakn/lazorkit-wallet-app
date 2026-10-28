const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Order = require('../models/Order');
const { transferSplTokenToUser, transferSolToUser } = require('../utils/transfer');
const { getSolPriceUsd } = require('../utils/price');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
// bs58 v6 ships CJS with the codec on `.default`
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;

/**
 * Wallet model (LazorKit SDK 3.x / protocol v2):
 * The frontend SDK creates and owns the smart wallet during `connect()`.
 * The address users receive funds on is the wallet's *vault* PDA
 * (`WalletInfo.vaultPda`), which the frontend sends as `smartWalletAddress`.
 * The backend no longer builds wallet-creation transactions itself.
 */

function getRpcUrl() {
  return process.env.RPC_URL || process.env.LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
}

function isValidPublicKey(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the fund-holding wallet address from frontend passkey/wallet data. */
function resolveWalletAddress(passkeyData) {
  if (!passkeyData || typeof passkeyData !== 'object') return null;
  const candidates = [passkeyData.smartWalletAddress, passkeyData.vaultPda, passkeyData.smartWallet];
  return candidates.find(isValidPublicKey) || null;
}

/**
 * Optionally seed a brand-new wallet vault with a little SOL so it can pay rent
 * (e.g. for creating recipient token accounts). Only on devnet/localnet, only
 * when the vault is empty, and never fatal for the caller.
 */
async function fundNewWalletIfEmpty(connection, walletAddress) {
  const lamports = Number(process.env.SMART_WALLET_INIT_LAMPORTS);
  const adminSecret = process.env.PRIVATE_KEY;
  const isDev = /devnet|localhost|127\.0\.0\.1/i.test(getRpcUrl());
  if (!isDev || !adminSecret || !Number.isFinite(lamports) || lamports <= 0) {
    return { funded: false, reason: 'funding disabled' };
  }
  try {
    const vault = new PublicKey(walletAddress);
    const balance = await connection.getBalance(vault, 'confirmed');
    if (balance > 0) return { funded: false, reason: 'already funded' };

    const admin = Keypair.fromSecretKey(bs58.decode(adminSecret));
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: vault, lamports })
    );
    const signature = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: 'confirmed' });
    console.log('[wallet-funding] Seeded new wallet', walletAddress, 'with', lamports, 'lamports:', signature);
    return { funded: true, signature, lamports };
  } catch (e) {
    console.warn('[wallet-funding] Skipped:', e?.message || e);
    return { funded: false, reason: e?.message || 'funding failed' };
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { amount, currency, token, metadata, passkeyData, orderLines } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ error: 'Missing amount or currency' });
    }

    const reference = `lz_${Date.now()}`;

    // Calculate fee (fixed $1.00 for all transactions)
    const subtotal = Number(Number(amount).toFixed(2));
    const fee = 1.00; // Fixed $1 fee for all transactions
    const networkFee = 0.00; // No network fee
    const total = Number((subtotal + fee).toFixed(2));

    const returnSuccess = `${process.env.APP_BASE_URL || 'https://localhost:3000'}/callback/success?status=success&ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token || '')}&currency=${encodeURIComponent(currency)}&amount=${encodeURIComponent(total)}&subtotal=${encodeURIComponent(subtotal)}`;
    const returnFailed = `${process.env.APP_BASE_URL || 'https://localhost:3000'}/callback/failed?status=failed&ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token || '')}&currency=${encodeURIComponent(currency)}&amount=${encodeURIComponent(total)}&subtotal=${encodeURIComponent(subtotal)}`;

    // Create a mock local checkout URL pointing to our frontend mock checkout page
    const checkoutUrl = `/onramp-checkout?ref=${reference}`;

    // Save order to DB with passkeyData
    const order = await Order.create({
      reference,
      provider: 'mock',
      amount: Number(amount),
      currency,
      token,
      status: 'pending',
      checkoutUrl,
      passkeyData: passkeyData || undefined,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiration
    });

    console.log('[orders.create] Order saved to DB (Mock Sandbox):', {
      reference: order.reference,
      hasPasskeyData: !!order.passkeyData,
      smartWalletAddress: order.passkeyData?.smartWalletAddress
    });

    return res.json({ orderId: order._id, reference, checkoutUrl, status: order.status });
  } catch (err) {
    return next(err);
  }
});

/**
 * Payment-provider webhook authentication. With ONRAMP_WEBHOOK_SECRET set, callbacks
 * must carry `x-rampfi-timestamp` (unix seconds, ±5 min) and
 * `x-rampfi-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>`.
 * Without a secret (local dev) unsigned callbacks are accepted.
 */
function verifyProviderSignature(req, res, next) {
  const secret = process.env.ONRAMP_WEBHOOK_SECRET;
  if (!secret) return next();
  const ts = req.get('x-rampfi-timestamp');
  const sig = String(req.get('x-rampfi-signature') || '').replace(/^sha256=/, '');
  if (!ts || !sig || !/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return res.status(401).json({ error: 'Missing or stale webhook signature' });
  }
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  return next();
}

/** The sandbox checkout (browser) acts as the payment provider: dev only unless enabled. */
function requireMockProvider(req, res, next) {
  const flag = process.env.ONRAMP_MOCK_PROVIDER;
  const enabled = flag ? flag === 'true' : process.env.NODE_ENV !== 'production';
  if (!enabled) return res.status(404).json({ error: 'Mock payment provider is disabled' });
  return next();
}

async function handlePaymentSuccess(req, res, next) {
  try {
    const { reference, orderId } = req.body || {};
    const ref = reference || orderId;
    if (!ref) return res.status(400).json({ error: 'Missing reference' });

    console.log('[callback/success] Processing payment for reference:', ref);

    // Step 1: Atomically claim the order so concurrent/repeated callbacks can't pay out twice.
    const order = await Order.findOneAndUpdate(
      { reference: ref, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true }
    );
    if (!order) {
      const existing = await Order.findOne({ reference: ref });
      if (!existing) return res.status(404).json({ error: 'Order not found' });
      if (existing.status === 'success') {
        // Idempotent: return the original payout instead of transferring again
        return res.json({
          ok: true,
          alreadyProcessed: true,
          walletAddress: existing.walletAddress,
          reference: existing.reference,
          status: existing.status,
          txSignature: existing.txSignature,
          creditedAmount: existing.creditedAmount,
          token: existing.token,
        });
      }
      return res.status(409).json({ error: `Order is ${existing.status}`, status: existing.status });
    }

    const releaseOrder = async (status = 'pending') => {
      order.status = status;
      await order.save();
    };

    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
      await releaseOrder('failed');
      return res.status(410).json({ error: 'Order expired', status: 'failed' });
    }

    console.log('[callback/success] Order found:', {
      reference: order.reference,
      hasPasskeyData: !!order.passkeyData,
      smartWalletAddress: order.passkeyData?.smartWalletAddress
    });

    // Step 2: Resolve the wallet that receives the tokens.
    // The smart wallet is created client-side by the LazorKit SDK during connect().
    const finalWallet = order.walletAddress || resolveWalletAddress(order.passkeyData);
    if (!finalWallet) {
      await releaseOrder('pending');
      return res.status(400).json({
        error: 'Missing wallet address',
        reason: 'Order has no valid smartWalletAddress. Reconnect your passkey wallet and retry.',
      });
    }
    console.log('[callback/success] Target wallet:', finalWallet);

    // Step 3: Pay out on-chain (rUSDC by default, native SOL for SOL orders)
    order.walletAddress = finalWallet;

    let txSignature = null;
    let creditedAmount = null;

    try {
      const shouldTransfer = Boolean(process.env.TOKEN_MINT) && Boolean(process.env.PRIVATE_KEY);
      if (shouldTransfer) {
        // order.amount is the USD subtotal (fees excluded)
        const usdAmount = Number(order.amount);
        if (!Number.isFinite(usdAmount) || usdAmount <= 0) throw new Error('Invalid order amount');

        if (String(order.token || 'USDC').toUpperCase() === 'SOL') {
          const solPrice = await getSolPriceUsd();
          const maxSol = Number(process.env.ONRAMP_MAX_SOL || 2);
          const solAmount = Math.min(Number((usdAmount / solPrice).toFixed(6)), maxSol);
          console.log('[callback/success] Paying SOL:', { to: finalWallet, usdAmount, solPrice, solAmount });
          const result = await transferSolToUser(finalWallet, solAmount);
          txSignature = result.signature;
          creditedAmount = result.amount;
        } else {
          console.log('[callback/success] Paying rUSDC:', { to: finalWallet, amount: usdAmount, mint: process.env.TOKEN_MINT });
          const result = await transferSplTokenToUser(finalWallet, usdAmount);
          txSignature = result.signature;
          creditedAmount = usdAmount;
        }
        console.log('[callback/success] Payout completed:', txSignature);
      }
    } catch (e) {
      const reason = e?.message || 'Transfer failed';
      console.error('[callback/success] Payout failed:', reason);
      await releaseOrder('pending');
      return res.status(202).json({
        ok: false,
        pending: true,
        reason,
        reference: order.reference
      });
    }

    // Step 4: Update order status
    order.status = 'success';
    if (txSignature) order.txSignature = txSignature;
    if (creditedAmount != null) order.creditedAmount = creditedAmount;
    if (order.expiresAt) order.expiresAt = undefined;

    await order.save();

    console.log('[callback/success] Order completed:', {
      reference: order.reference,
      walletAddress: order.walletAddress,
      txSignature,
      creditedAmount
    });

    return res.json({
      ok: true,
      walletAddress: finalWallet,
      reference: order.reference,
      status: order.status,
      txSignature,
      creditedAmount,
      token: order.token,
    });

  } catch (err) {
    console.error('[callback/success] Error:', err);
    return next(err);
  }
}

async function handlePaymentFailed(req, res, next) {
  try {
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    // Only a pending order can be failed (never a paid one)
    const order = await Order.findOneAndUpdate(
      { reference, status: 'pending' },
      { $set: { status: 'failed' } },
      { new: true }
    );
    if (!order) {
      const existing = await Order.findOne({ reference });
      if (!existing) return res.status(404).json({ error: 'Order not found' });
      return res.status(409).json({ error: `Order is ${existing.status}`, status: existing.status });
    }
    return res.json({ ok: true });
  } catch (err) { return next(err); }
}

// Real provider webhooks (HMAC-signed when ONRAMP_WEBHOOK_SECRET is set)
router.post('/callback/success', verifyProviderSignature, handlePaymentSuccess);
router.post('/callback/failed', verifyProviderSignature, handlePaymentFailed);
// Sandbox checkout page (stands in for the provider on devnet)
router.post('/mock-provider/pay', requireMockProvider, handlePaymentSuccess);
router.post('/mock-provider/cancel', requireMockProvider, handlePaymentFailed);

const fs = require('fs');
const path = require('path');
const https = require('https');
const cacheFilePath = path.join(__dirname, '../utils/exchange-rate-cache.json');

function fetchExchangeRateFromApi(apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          if (response.statusCode === 200) {
            const parsed = JSON.parse(data);
            if (parsed && parsed.result === 'success' && parsed.conversion_rates && parsed.conversion_rates.VND) {
              resolve(parsed.conversion_rates.VND);
            } else {
              reject(new Error('Invalid response data structure'));
            }
          } else {
            reject(new Error(`API status ${response.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

router.get('/exchange-rate', async (req, res, next) => {
  try {
    let cachedData = null;
    let needsUpdate = true;

    if (fs.existsSync(cacheFilePath)) {
      try {
        const rawCache = fs.readFileSync(cacheFilePath, 'utf8');
        cachedData = JSON.parse(rawCache);
        const lastUpdated = new Date(cachedData.timestamp);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (lastUpdated > thirtyDaysAgo && cachedData.rate) {
          needsUpdate = false;
        }
      } catch {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const apiKey = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY || '2412cc7adfb37b20d15d1d86';
      try {
        const rate = await fetchExchangeRateFromApi(apiKey);
        cachedData = {
          rate: Number(rate),
          timestamp: new Date().toISOString()
        };
        const cacheDir = path.dirname(cacheFilePath);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        fs.writeFileSync(cacheFilePath, JSON.stringify(cachedData, null, 2), 'utf8');
        return res.json({ rate: cachedData.rate, source: 'api' });
      } catch (err) {
        if (cachedData && cachedData.rate) {
          return res.json({ rate: cachedData.rate, source: 'cache_fallback' });
        }
        return res.json({ rate: 26000, source: 'fallback' });
      }
    }

    return res.json({ rate: cachedData.rate, source: 'cache' });
  } catch (err) {
    return next(err);
  }
});

router.get('/:reference', async (req, res, next) => {
  try {
    const reference = req.params.reference;
    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    const order = await Order.findOne({ reference });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({
      reference: order.reference,
      status: order.status,
      walletAddress: order.walletAddress || order?.passkeyData?.smartWalletAddress || null,
      amount: order.amount,
      currency: order.currency,
      token: order.token,
      txSignature: order.txSignature || null,
      creditedAmount: order.creditedAmount ?? null,
    });
  } catch (err) { return next(err); }
});

router.get('/balance/:walletAddress', async (req, res, next) => {
  try {
    const walletAddress = req.params.walletAddress;
    if (!walletAddress) return res.status(400).json({ error: 'Missing wallet address' });
    
    const orders = await Order.find({ 
      walletAddress: walletAddress,
      status: 'success'
    });
    
    const balances = {};
    orders.forEach(order => {
      if (order.creditedAmount && order.token) {
        if (!balances[order.token]) {
          balances[order.token] = 0;
        }
        balances[order.token] += order.creditedAmount;
      }
    });
    
    return res.json({
      walletAddress,
      balances,
      totalOrders: orders.length
    });
  } catch (err) { return next(err); }
});

router.post('/check-wallet', async (req, res, next) => {
  try {
    const { passkeyData } = req.body || {};

    if (!passkeyData) {
      return res.status(400).json({ error: 'Missing passkeyData' });
    }

    const smartWalletAddress = resolveWalletAddress(passkeyData);
    const empty = { exists: false, walletAddress: null, orderReference: null, passkeyData: null };
    if (!smartWalletAddress) return res.json(empty);

    // A v2 vault is a System-owned PDA that only shows up on chain once it holds
    // lamports, so also accept the wallet PDA or an earlier successful order.
    const connection = new Connection(getRpcUrl(), 'confirmed');
    const toCheck = [smartWalletAddress, passkeyData.walletPda].filter(isValidPublicKey);
    let onChain = false;
    for (const addr of toCheck) {
      try {
        if (await connection.getAccountInfo(new PublicKey(addr))) { onChain = true; break; }
      } catch {}
    }

    const existingOrder = await Order.findOne({
      walletAddress: smartWalletAddress,
      status: 'success'
    }).sort({ createdAt: -1 });

    if (!onChain && !existingOrder) return res.json(empty);

    return res.json({
      exists: true,
      walletAddress: smartWalletAddress,
      orderReference: existingOrder?.reference || null,
      passkeyData: existingOrder?.passkeyData || passkeyData
    });
  } catch (err) {
    console.error('Check wallet failed:', err);
    return next(err);
  }
});

// POST /api/orders/create-smart-wallet
// Kept for API compatibility. With LazorKit SDK 3.x the wallet is created by the
// SDK during connect(); this endpoint registers/validates the resulting address
// and optionally seeds an empty devnet vault with SMART_WALLET_INIT_LAMPORTS.
router.post('/create-smart-wallet', async (req, res, next) => {
  try {
    const { passkeyData, walletAddress: bodyAddress } = req.body || {};
    const walletAddress = isValidPublicKey(bodyAddress) ? bodyAddress : resolveWalletAddress(passkeyData);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing or invalid smartWalletAddress' });
    }

    const connection = new Connection(getRpcUrl(), 'confirmed');
    const funding = await fundNewWalletIfEmpty(connection, walletAddress);

    return res.json({ ok: true, walletAddress, funded: funding.funded, fundingSignature: funding.signature || null });
  } catch (err) {
    console.error('Register smart wallet failed:', err);
    return next(err);
  }
});

module.exports = router;