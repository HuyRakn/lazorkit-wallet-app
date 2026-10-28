/**
 * Read a LazorKit wallet's on-chain access list (authorities + sessions).
 *
 *   GET /api/lazorkit/access?walletPda=<wallet PDA>
 *
 * Layouts (LazorKit v2, @lazorkit/sdk-legacy accounts.d.ts):
 *   Authority: [disc=34 u8][type u8][role u8][bump u8][version u8][pad 3][counter u32][pad 4][wallet 32 @16][key… @48]
 *   Session:   [disc=35 u8][bump u8][version u8][pad 5][wallet 32 @8][sessionKey 32 @40][expiresAt u64 @72][actions…]
 */
const express = require('express');
const { PublicKey } = require('@solana/web3.js');
const { getConnection, isValidPublicKey } = require('../utils/solana');

const router = express.Router();

const DISC_AUTHORITY = 34;
const DISC_SESSION = 35;
const ROLE_NAMES = { 0: 'owner', 1: 'admin', 2: 'spender' };
const AUTH_TYPE_ED25519 = 0;

const cache = new Map(); // walletPda -> { at, data }
const CACHE_MS = 5000;

router.get('/access', async (req, res) => {
  try {
    const walletPda = String(req.query.walletPda || '');
    if (!isValidPublicKey(walletPda)) return res.status(400).json({ error: 'Invalid walletPda' });
    const hit = cache.get(walletPda);
    if (hit && Date.now() - hit.at < CACHE_MS && !req.query.fresh) return res.json(hit.data);

    const connection = getConnection();
    const wallet = new PublicKey(walletPda);
    const info = await connection.getAccountInfo(wallet);
    if (!info) return res.status(404).json({ error: 'Wallet account not found on this cluster' });
    const programId = info.owner;
    const walletB64 = wallet.toBuffer().toString('base64');

    const [authAccounts, sessionAccounts, slot] = await Promise.all([
      connection.getProgramAccounts(programId, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0, bytes: Buffer.from([DISC_AUTHORITY]).toString('base64'), encoding: 'base64' } },
          { memcmp: { offset: 16, bytes: walletB64, encoding: 'base64' } },
        ],
      }),
      connection.getProgramAccounts(programId, {
        encoding: 'base64',
        filters: [
          { memcmp: { offset: 0, bytes: Buffer.from([DISC_SESSION]).toString('base64'), encoding: 'base64' } },
          { memcmp: { offset: 8, bytes: walletB64, encoding: 'base64' } },
        ],
      }),
      connection.getSlot('confirmed'),
    ]);

    const authorities = authAccounts.map(({ pubkey, account }) => {
      const d = account.data;
      const type = d[1];
      return {
        pda: pubkey.toBase58(),
        role: d[2],
        roleName: ROLE_NAMES[d[2]] || `role-${d[2]}`,
        kind: type === AUTH_TYPE_ED25519 ? 'device-key' : 'passkey',
        publicKey: type === AUTH_TYPE_ED25519 ? new PublicKey(d.subarray(48, 80)).toBase58() : null,
        counter: d.readUInt32LE(8),
      };
    }).sort((a, b) => a.role - b.role);

    const sessions = sessionAccounts.map(({ pubkey, account }) => {
      const d = account.data;
      const expiresAt = Number(d.readBigUInt64LE(72));
      return {
        pda: pubkey.toBase58(),
        sessionKey: new PublicKey(d.subarray(40, 72)).toBase58(),
        expiresAtSlot: expiresAt,
        expired: expiresAt <= slot,
        slotsLeft: Math.max(0, expiresAt - slot),
        hasLimits: d.length > 80,
      };
    }).sort((a, b) => b.expiresAtSlot - a.expiresAtSlot);

    const data = { walletPda, programId: programId.toBase58(), slot, authorities, sessions };
    cache.set(walletPda, { at: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error('[lazorkit/access]', err);
    res.status(502).json({ error: err.message || 'Could not read wallet access from chain' });
  }
});

module.exports = router;
