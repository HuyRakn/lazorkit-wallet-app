const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEFAULT_DEVNET_USDC_MINT = 'RSLc86ULA3mxeapSrAZ9qo3jFUjZNaqrzpXkMGH5BYo';

let cachedConnection = null;
let cachedRpcUrl = null;

function getRpcUrl() {
  const raw = process.env.RPC_URL || process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
  if (raw.includes('47712b7a-ea63-49b8-9685-dff77d9eb55a')) {
    return 'https://api.devnet.solana.com';
  }
  return raw;
}

function getConnection() {
  const url = getRpcUrl();
  if (!cachedConnection || cachedRpcUrl !== url) {
    cachedConnection = new Connection(url, 'confirmed');
    cachedRpcUrl = url;
  }
  return cachedConnection;
}

function getAdminKeypair() {
  const secret = process.env.PRIVATE_KEY;
  if (!secret) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function getUsdcMint() {
  return process.env.TOKEN_MINT || DEFAULT_DEVNET_USDC_MINT;
}

function isDevCluster() {
  return /devnet|localhost|127\.0\.0\.1/i.test(getRpcUrl());
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

module.exports = {
  NATIVE_SOL_MINT,
  DEFAULT_DEVNET_USDC_MINT,
  getRpcUrl,
  getConnection,
  getAdminKeypair,
  getUsdcMint,
  isDevCluster,
  isValidPublicKey,
};

