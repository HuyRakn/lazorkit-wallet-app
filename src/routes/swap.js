/**
 * Real on-chain swaps on devnet through the RampFi Raydium CPMM pool (wSOL ↔ rUSDC).
 *
 *   GET  /api/swap/pool                       → pool reserves, price, fee
 *   GET  /api/swap/quote?inputMint&amount&slippageBps
 *   POST /api/swap/build { owner, inputMint, amount, slippageBps }
 *        → serialized instructions the passkey wallet (vault PDA) signs via LazorKit
 *
 * `amount` is always in raw base units of the input mint.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const BN = require('bn.js');
const { PublicKey } = require('@solana/web3.js');
const { Raydium, TxVersion, CurveCalculator } = require('@raydium-io/raydium-sdk-v2');
const { getConnection, isValidPublicKey, NATIVE_SOL_MINT } = require('../utils/solana');

const router = express.Router();

function loadPoolConfig() {
  const file = path.resolve(__dirname, '../config/devnet-pool.json');
  const fromFile = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const poolId = process.env.RAYDIUM_CPMM_POOL_ID || fromFile.poolId;
  return poolId ? { ...fromFile, poolId } : null;
}

// Cache pool state briefly so quotes don't hammer the RPC
const POOL_CACHE_MS = 4000;
let poolCache = { at: 0, data: null };
let readonlyRaydium = null;

async function getRaydium(owner) {
  return Raydium.load({
    owner,
    connection: getConnection(),
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: 'confirmed',
  });
}

async function getPoolState() {
  const cfg = loadPoolConfig();
  if (!cfg) throw Object.assign(new Error('Swap pool not configured. Run scripts/devnet/create-cpmm-pool.js'), { status: 503 });
  if (poolCache.data && Date.now() - poolCache.at < POOL_CACHE_MS) return poolCache.data;
  if (!readonlyRaydium) readonlyRaydium = await getRaydium(new PublicKey(NATIVE_SOL_MINT));
  const { poolInfo, poolKeys, rpcData } = await readonlyRaydium.cpmm.getPoolInfoFromRpc(cfg.poolId);
  const data = { cfg, poolInfo, poolKeys, rpcData };
  poolCache = { at: Date.now(), data };
  return data;
}

function computeQuote(state, inputMint, amountRaw, slippageBps) {
  const { poolInfo, rpcData } = state;
  const mintA = poolInfo.mintA.address;
  const mintB = poolInfo.mintB.address;
  if (inputMint !== mintA && inputMint !== mintB) {
    throw Object.assign(new Error(`Pool only supports ${mintA} and ${mintB}`), { status: 400 });
  }
  const baseIn = inputMint === mintA;
  const inputReserve = baseIn ? rpcData.baseReserve : rpcData.quoteReserve;
  const outputReserve = baseIn ? rpcData.quoteReserve : rpcData.baseReserve;
  const cfg = rpcData.configInfo;
  const swapResult = CurveCalculator.swapBaseInput(
    new BN(amountRaw),
    inputReserve,
    outputReserve,
    cfg.tradeFeeRate,
    cfg.creatorFeeRate,
    cfg.protocolFeeRate,
    cfg.fundFeeRate,
    rpcData.feeOn ?? false,
  );
  const inDecimals = baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals;
  const outDecimals = baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals;
  const outRaw = swapResult.outputAmount;
  const minOutRaw = outRaw.muln(10000 - slippageBps).divn(10000);

  // Spot vs execution price → price impact
  const spot = Number(outputReserve.toString()) / 10 ** outDecimals / (Number(inputReserve.toString()) / 10 ** inDecimals);
  const exec = Number(outRaw.toString()) / 10 ** outDecimals / (Number(amountRaw) / 10 ** inDecimals);
  const priceImpactPct = spot > 0 ? Math.max(0, (1 - exec / spot) * 100) : 0;

  return {
    swapResult,
    baseIn,
    quote: {
      dex: 'raydium-cpmm',
      poolId: state.cfg.poolId,
      inputMint,
      outputMint: baseIn ? mintB : mintA,
      inAmount: String(amountRaw),
      outAmount: outRaw.toString(),
      minOutAmount: minOutRaw.toString(),
      otherAmountThreshold: minOutRaw.toString(),
      slippageBps,
      inDecimals,
      outDecimals,
      feeAmount: swapResult.tradeFee.toString(),
      feeRatePct: Number(cfg.tradeFeeRate.toString()) / 10000,
      priceImpactPct,
      swapMode: 'ExactIn',
    },
  };
}

function parseParams(src) {
  const inputMint = String(src.inputMint || '');
  const amount = String(src.amount || '');
  const slippageBps = Math.min(Math.max(parseInt(src.slippageBps ?? '50', 10) || 50, 1), 5000);
  if (!isValidPublicKey(inputMint)) throw Object.assign(new Error('Invalid inputMint'), { status: 400 });
  if (!/^\d+$/.test(amount) || amount === '0') throw Object.assign(new Error('Invalid amount (raw units)'), { status: 400 });
  return { inputMint, amount, slippageBps };
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[swap]', err);
    res.status(status).json({ error: err.message || 'Swap service error' });
  }
};

router.get('/pool', handle(async (_req, res) => {
  const { cfg, poolInfo, rpcData } = await getPoolState();
  const a = poolInfo.mintA;
  const b = poolInfo.mintB;
  const reserveA = Number(rpcData.baseReserve.toString()) / 10 ** a.decimals;
  const reserveB = Number(rpcData.quoteReserve.toString()) / 10 ** b.decimals;
  const solIsA = a.address === NATIVE_SOL_MINT;
  const solReserve = solIsA ? reserveA : reserveB;
  const usdcReserve = solIsA ? reserveB : reserveA;
  res.json({
    dex: 'raydium-cpmm',
    cluster: 'devnet',
    poolId: cfg.poolId,
    programId: cfg.programId,
    mintA: a.address,
    mintB: b.address,
    reserves: { SOL: solReserve, USDC: usdcReserve },
    priceUsdPerSol: solReserve > 0 ? usdcReserve / solReserve : null,
    feeRatePct: Number(rpcData.configInfo.tradeFeeRate.toString()) / 10000,
    lookupTable: cfg.lookupTable || null,
  });
}));

router.get('/quote', handle(async (req, res) => {
  const { inputMint, amount, slippageBps } = parseParams(req.query);
  const state = await getPoolState();
  res.json(computeQuote(state, inputMint, amount, slippageBps).quote);
}));

router.post('/build', handle(async (req, res) => {
  const { owner } = req.body || {};
  if (!isValidPublicKey(owner)) throw Object.assign(new Error('Invalid owner'), { status: 400 });
  const { inputMint, amount, slippageBps } = parseParams(req.body || {});

  poolCache.at = 0; // build against fresh reserves
  const state = await getPoolState();
  const { swapResult, baseIn, quote } = computeQuote(state, inputMint, amount, slippageBps);

  const raydium = await getRaydium(new PublicKey(owner));
  const { builder } = await raydium.cpmm.swap({
    poolInfo: state.poolInfo,
    poolKeys: state.poolKeys,
    inputAmount: new BN(amount),
    swapResult,
    slippage: slippageBps / 10000,
    baseIn,
    txVersion: TxVersion.LEGACY,
  });

  if (builder.signers?.length) {
    throw new Error('Swap requires extra signers, which passkey wallets cannot provide');
  }

  const instructions = builder.allInstructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: Buffer.from(ix.data).toString('base64'),
  }));

  res.json({ quote, instructions, lookupTables: state.cfg.lookupTable ? [state.cfg.lookupTable] : [] });
}));

module.exports = router;
