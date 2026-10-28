/**
 * Sign-In With Solana for LazorKit passkey wallets.
 *
 * 1. GET  /api/auth/nonce?wallet=<vault>  → { message, nonce, expiresAt }
 * 2. The app signs `message` with `useWallet().signMessage` (passkey prompt).
 * 3. POST /api/auth/verify { wallet, credentialId, message, ...SignMessageResult }
 *    → the signature is checked against the passkey key stored ON CHAIN for that
 *      wallet (`verifyWalletMessage`), never a key from the request, then a JWT
 *      bound to the wallet is issued.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getConnection, isDevCluster, isValidPublicKey } = require('./solana');

const NONCE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL = process.env.SIWS_TOKEN_TTL || '12h';
const DOMAIN = process.env.SIWS_DOMAIN || 'RampFi';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  JWT_SECRET not set: using a random per-process secret (sessions reset on restart)');
}

// wallet -> { nonce, message, expiresAt }
const pending = new Map();

function portalRpId() {
  const portal = process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL || process.env.LAZORKIT_PORTAL_URL || 'https://portal.lazor.sh';
  try {
    return { rpId: new URL(portal).hostname, origin: new URL(portal).origin };
  } catch {
    return { rpId: 'portal.lazor.sh', origin: undefined };
  }
}

function buildMessage(wallet, nonce, issuedAt, uri) {
  return [
    `${DOMAIN} wants you to sign in with your Solana account:`,
    wallet,
    '',
    'Sign in to RampFi. This request will not trigger a transaction or cost any fees.',
    '',
    `URI: ${uri}`,
    `Chain: solana:${isDevCluster() ? 'devnet' : 'mainnet'}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

function createChallenge(wallet, uri = 'https://localhost:3000') {
  if (!isValidPublicKey(wallet)) throw Object.assign(new Error('Invalid wallet'), { status: 400 });
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString();
  const message = buildMessage(wallet, nonce, issuedAt, uri);
  const expiresAt = Date.now() + NONCE_TTL_MS;
  pending.set(wallet, { nonce, message, expiresAt });
  // opportunistic cleanup
  for (const [k, v] of pending) if (v.expiresAt < Date.now()) pending.delete(k);
  return { message, nonce, expiresAt: new Date(expiresAt).toISOString() };
}

async function verifyChallenge(body) {
  const { wallet, credentialId, message, signature, clientDataJsonBase64, authenticatorDataBase64, signedPayload } = body || {};
  if (!isValidPublicKey(wallet)) throw Object.assign(new Error('Invalid wallet'), { status: 400 });
  if (!credentialId || !message || !signature || !clientDataJsonBase64 || !authenticatorDataBase64) {
    throw Object.assign(new Error('Missing signature fields'), { status: 400 });
  }
  const challenge = pending.get(wallet);
  if (!challenge || challenge.expiresAt < Date.now()) {
    throw Object.assign(new Error('Sign-in request expired, try again'), { status: 401 });
  }
  if (challenge.message !== message) {
    throw Object.assign(new Error('Message does not match the issued challenge'), { status: 401 });
  }
  pending.delete(wallet); // one-time nonce

  const { verifyWalletMessage } = require('@lazorkit/wallet');
  const { rpId } = portalRpId();
  let ok = false;
  try {
    ok = await verifyWalletMessage({
      connection: getConnection(),
      cluster: isDevCluster() ? 'devnet' : 'mainnet',
      wallet,
      credentialId,
      rpId,
      message,
      signature,
      clientDataJsonBase64,
      authenticatorDataBase64,
      signedPayload,
    });
  } catch (err) {
    throw Object.assign(new Error(`Could not verify on chain: ${err.message}`), { status: 503 });
  }
  if (!ok) throw Object.assign(new Error('Signature does not match this wallet\'s passkey'), { status: 401 });

  const token = jwt.sign({ sub: wallet, wallet, typ: 'siws' }, jwtSecret, { expiresIn: TOKEN_TTL });
  const { exp } = jwt.decode(token);
  return { token, wallet, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Returns the wallet a SIWS token was issued to, or null. */
function walletFromToken(token) {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    return decoded?.typ === 'siws' && isValidPublicKey(decoded.wallet) ? decoded.wallet : null;
  } catch {
    return null;
  }
}

module.exports = { createChallenge, verifyChallenge, walletFromToken, portalRpId };
