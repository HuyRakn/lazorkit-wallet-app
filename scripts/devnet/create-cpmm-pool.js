#!/usr/bin/env node
/**
 * One-time setup: create a Raydium CPMM pool (wSOL ↔ rUSDC) on devnet, funded by
 * the treasury (PRIVATE_KEY), and write its id to src/config/devnet-pool.json.
 *
 * Usage:
 *   node scripts/devnet/create-cpmm-pool.js [--sol 10] [--price <usd per SOL>]
 *
 * The initial price defaults to the live SOL/USD price so devnet swaps track mainnet.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const path = require('path');
const BN = require('bn.js');
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const {
  Raydium,
  TxVersion,
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
} = require('@raydium-io/raydium-sdk-v2');
const { getConnection, getAdminKeypair, getUsdcMint, isDevCluster, NATIVE_SOL_MINT } = require('../../src/utils/solana');
const { getSolPriceUsd } = require('../../src/utils/price');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const tokenInfo = (address, symbol, name, decimals) => ({
  chainId: 103,
  address,
  programId: TOKEN_PROGRAM_ID.toBase58(),
  logoURI: '',
  symbol,
  name,
  decimals,
  tags: [],
  extensions: {},
});

(async () => {
  if (!isDevCluster()) throw new Error('Refusing to run: RPC_URL is not devnet/localnet');
  const connection = getConnection();
  const owner = getAdminKeypair();
  const usdcMint = getUsdcMint();

  const solAmount = Number(arg('sol', 10));
  const price = Number(arg('price', 0)) || (await getSolPriceUsd());
  const usdcAmount = Number((solAmount * price).toFixed(6));
  console.log(`Creating CPMM pool: ${solAmount} SOL + ${usdcAmount} rUSDC (price $${price}/SOL)`);
  console.log('Treasury:', owner.publicKey.toBase58());

  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: 'confirmed',
  });

  const feeConfigs = await raydium.api.getCpmmConfigs();
  feeConfigs.forEach((config) => {
    config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58();
  });
  // Lowest-fee tier available
  const feeConfig = [...feeConfigs].sort((a, b) => a.tradeFeeRate - b.tradeFeeRate)[0];
  console.log('Fee tier:', feeConfig.tradeFeeRate / 10000, '%  config', feeConfig.id);

  const mintA = tokenInfo(NATIVE_SOL_MINT, 'WSOL', 'Wrapped SOL', 9);
  const mintB = tokenInfo(usdcMint.toBase58(), 'rUSDC', 'RampFi USD (devnet)', 6);

  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount: new BN(Math.round(solAmount * 1e9).toString()),
    mintBAmount: new BN(Math.round(usdcAmount * 1e6).toString()),
    startTime: new BN(0),
    feeConfig,
    associatedOnly: false,
    ownerInfo: { useSOLBalance: true },
    txVersion: TxVersion.V0,
  });

  const { txId } = await execute({ sendAndConfirm: true });
  const poolId = extInfo.address.poolId.toBase58();
  console.log('✅ Pool created:', poolId);
  console.log('   tx:', `https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  const out = path.resolve(__dirname, '../../src/config/devnet-pool.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    cluster: 'devnet',
    dex: 'raydium-cpmm',
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM.toBase58(),
    poolId,
    mintA: NATIVE_SOL_MINT,
    mintB: usdcMint.toBase58(),
    createdTx: txId,
    initialPriceUsd: price,
    createdAt: new Date().toISOString(),
  }, null, 2) + '\n');
  console.log('Saved', out);
  process.exit(0);
})().catch((e) => {
  console.error('❌ Pool creation failed:', e?.message || e);
  process.exit(1);
});
