const {
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
  transfer,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} = require('@solana/spl-token');
const { getConnection, getAdminKeypair, getUsdcMint } = require('./solana');

/**
 * Transfer native SOL from the admin treasury wallet to a recipient on-chain.
 * @param {string} recipientAddress
 * @param {number} solAmount
 * @returns {Promise<{signature: string, amount: number, lamports: number}>}
 */
async function transferSolToUser(recipientAddress, solAmount) {
  const connection = getConnection();
  const adminKeypair = getAdminKeypair();
  const recipientPubkey = new PublicKey(recipientAddress);
  const lamports = Math.round(Number(solAmount) * LAMPORTS_PER_SOL);

  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error(`Invalid SOL transfer amount: ${solAmount}`);
  }

  const adminBalance = await connection.getBalance(adminKeypair.publicKey, 'confirmed');
  if (adminBalance < lamports + 10000) {
    throw new Error(
      `Insufficient treasury SOL balance (${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL)`
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: adminKeypair.publicKey,
      toPubkey: recipientPubkey,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [adminKeypair], {
    commitment: 'confirmed',
  });

  return {
    signature,
    amount: solAmount,
    lamports,
  };
}

/**
 * Transfer SPL tokens from admin wallet to recipient
 * @param {string} recipientAddress - Recipient's wallet address
 * @param {number} amount - Amount to transfer (in token units, not raw)
 * @param {string} tokenMint - Token mint address (optional, uses env var if not provided)
 * @param {number} decimals - Token decimals (optional, uses env var if not provided)
 * @returns {Promise<{signature: string, amount: number, decimals: number}>}
 */
async function transferSplTokenToUser(
  recipientAddress,
  amount,
  tokenMint = getUsdcMint(),
  decimals = process.env.TOKEN_DECIMALS ? parseInt(process.env.TOKEN_DECIMALS, 10) : 6
) {
  const connection = getConnection();
  const adminKeypair = getAdminKeypair();
  const adminPubkey = adminKeypair.publicKey;
  const recipientPubkey = new PublicKey(recipientAddress);
  const tokenMintPubkey = new PublicKey(tokenMint);

  // Get or create admin's token account
  const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    adminKeypair,
    tokenMintPubkey,
    adminPubkey
  );

  const adminAccountInfo = await getAccount(connection, adminTokenAccount.address);

  // Get or create recipient's token account (allowOwnerOffCurve = true for smart wallet PDAs)
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    adminKeypair,
    tokenMintPubkey,
    recipientPubkey,
    true
  );

  let resolvedDecimals = decimals;
  if (resolvedDecimals === undefined || Number.isNaN(resolvedDecimals)) {
    const mintInfo = await connection.getParsedAccountInfo(tokenMintPubkey);
    resolvedDecimals = mintInfo.value?.data?.parsed?.info?.decimals ?? 6;
  }

  const rawAmount = Math.floor(Number(amount) * Math.pow(10, resolvedDecimals));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw new Error(`Invalid SPL transfer amount: ${amount}`);
  }

  if (adminAccountInfo.amount < BigInt(rawAmount)) {
    throw new Error(
      `Insufficient token balance. Admin has ${adminAccountInfo.amount.toString()}, trying to transfer ${rawAmount}`
    );
  }

  const signature = await transfer(
    connection,
    adminKeypair,
    adminTokenAccount.address,
    recipientTokenAccount.address,
    adminPubkey,
    rawAmount
  );

  return {
    signature,
    amount,
    decimals: resolvedDecimals,
  };
}

module.exports = {
  transferSolToUser,
  transferSplTokenToUser,
};

