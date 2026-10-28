#!/usr/bin/env node
/**
 * One-time setup: create an Address Lookup Table holding every static account of a
 * swap through the RampFi CPMM pool (program, pool, config, vaults, mints, token
 * programs…). Passkey (LazorKit) transactions wrap the swap in a WebAuthn-verified
 * execute, so shrinking the inner accounts to 1-byte ALT indices keeps the whole
 * transaction under the 1232-byte packet limit.
 *
 * Usage: node scripts/devnet/create-swap-alt.js   (needs the backend's .env.local)
 * Writes `lookupTable` into src/config/devnet-pool.json.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const path = require('path');
const BN = require('bn.js');
const {
  AddressLookupTableProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionMessage,
  VersionedTransaction,
} = require('@solana/web3.js');
const { Raydium, TxVersion, CurveCalculator } = require('@raydium-io/raydium-sdk-v2');
const { getConnection, getAdminKeypair, isDevCluster, NATIVE_SOL_MINT } = require('../../src/utils/solana');

const CONFIG_FILE = path.resolve(__dirname, '../../src/config/devnet-pool.json');

async function swapKeysFor(connection, poolId, owner, inputMint) {
  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
  });
  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId);
  const baseIn = inputMint === poolInfo.mintA.address;
  const amount = new BN(1000);
  const swapResult = CurveCalculator.swapBaseInput(
    amount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo.tradeFeeRate,
    rpcData.configInfo.creatorFeeRate,
    rpcData.configInfo.protocolFeeRate,
    rpcData.configInfo.fundFeeRate,
    rpcData.feeOn ?? false,
  );
  const { builder } = await raydium.cpmm.swap({
    poolInfo, poolKeys, inputAmount: amount, swapResult, slippage: 0.01, baseIn, txVersion: TxVersion.LEGACY,
  });
  const keys = new Set();
  for (const ix of builder.allInstructions) {
    keys.add(ix.programId.toBase58());
    ix.keys.forEach((k) => keys.add(k.pubkey.toBase58()));
  }
  return { keys, poolInfo };
}

async function send(connection, payer, instructions) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

(async () => {
  if (!isDevCluster()) throw new Error('Refusing to run: RPC_URL is not devnet/localnet');
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const connection = getConnection();
  const admin = getAdminKeypair();

  // Accounts present for two unrelated owners, in both directions, are the static ones.
  // The token-input build needs an owner that holds that token: use the treasury.
  const o1 = Keypair.generate().publicKey;
  const o2 = admin.publicKey;
  const { keys: k1, poolInfo } = await swapKeysFor(connection, cfg.poolId, o1, NATIVE_SOL_MINT);
  const otherMint = poolInfo.mintA.address === NATIVE_SOL_MINT ? poolInfo.mintB.address : poolInfo.mintA.address;
  const { keys: k2 } = await swapKeysFor(connection, cfg.poolId, o2, otherMint);
  const statics = [...k1].filter((k) => k2.has(k));
  statics.push(
    SystemProgram.programId.toBase58(),
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // ATA program (output account creation)
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
    SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(), // read by LazorKit's passkey verification
  );
  const addresses = [...new Set(statics)].map((k) => new PublicKey(k));
  console.log(`Static swap accounts (${addresses.length}):`, addresses.map((a) => a.toBase58()));

  const slot = await connection.getSlot('finalized');
  const [createIx, lookupTable] = AddressLookupTableProgram.createLookupTable({
    authority: admin.publicKey,
    payer: admin.publicKey,
    recentSlot: slot,
  });
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    lookupTable,
    authority: admin.publicKey,
    payer: admin.publicKey,
    addresses,
  });
  const sig = await send(connection, admin, [createIx, extendIx]);
  console.log('Lookup table', lookupTable.toBase58(), 'tx', sig);

  const next = {
    ...cfg,
    mintA: poolInfo.mintA.address,
    mintB: poolInfo.mintB.address,
    lookupTable: lookupTable.toBase58(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log('Saved to', path.relative(process.cwd(), CONFIG_FILE));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
