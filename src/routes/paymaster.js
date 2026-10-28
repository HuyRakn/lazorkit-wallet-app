/**
 * Paymaster service for gasless transactions on Solana devnet.
 * Implements Kora / LazorKit Paymaster JSON-RPC specification.
 * Sponsoring transactions with the treasury/admin keypair.
 */
const express = require('express');
const { Transaction, VersionedTransaction } = require('@solana/web3.js');
const { getConnection, getAdminKeypair } = require('../utils/solana');

const router = express.Router();

router.post('/', async (req, res) => {
  const { jsonrpc = '2.0', id = 1, method, params = {} } = req.body || {};

  try {
    const admin = getAdminKeypair();
    const connection = getConnection();

    switch (method) {
      case 'getPayerSigner':
      case 'get_payer_signer': {
        return res.json({
          jsonrpc,
          id,
          result: {
            signer_address: admin.publicKey.toBase58(),
          },
        });
      }

      case 'getBlockhash':
      case 'get_blockhash': {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        return res.json({
          jsonrpc,
          id,
          result: {
            blockhash,
          },
        });
      }

      case 'signTransaction':
      case 'sign_transaction': {
        const txB64 = params.transaction;
        if (!txB64) {
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: 'Missing transaction parameter' },
          });
        }

        const buf = Buffer.from(txB64, 'base64');
        let signedB64;

        try {
          // Attempt VersionedTransaction
          const vtx = VersionedTransaction.deserialize(buf);
          vtx.sign([admin]);
          signedB64 = Buffer.from(vtx.serialize()).toString('base64');
        } catch {
          // Fallback to legacy Transaction
          const tx = Transaction.from(buf);
          tx.partialSign(admin);
          signedB64 = tx.serialize({ requireAllSignatures: false }).toString('base64');
        }

        return res.json({
          jsonrpc,
          id,
          result: {
            signed_transaction: signedB64,
          },
        });
      }

      case 'signAndSendTransaction':
      case 'sign_and_send_transaction': {
        const txB64 = params.transaction;
        if (!txB64) {
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: 'Missing transaction parameter' },
          });
        }

        const buf = Buffer.from(txB64, 'base64');
        let raw;

        try {
          const vtx = VersionedTransaction.deserialize(buf);
          vtx.sign([admin]);
          raw = vtx.serialize();
        } catch {
          const tx = Transaction.from(buf);
          tx.partialSign(admin);
          raw = tx.serialize({ requireAllSignatures: false });
        }

        const signature = await connection.sendRawTransaction(raw, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        return res.json({
          jsonrpc,
          id,
          result: {
            signature,
          },
        });
      }

      case 'getConfig':
      case 'get_config': {
        return res.json({
          jsonrpc,
          id,
          result: {
            fee_payers: [admin.publicKey.toBase58()],
            validation_config: {
              max_allowed_lamports: 100000000,
              max_signatures: 10,
              allowed_programs: 'All',
            },
          },
        });
      }

      case 'liveness':
      case 'get_version': {
        return res.json({
          jsonrpc,
          id,
          result: {
            status: 'ok',
            version: '1.0.0',
          },
        });
      }

      default: {
        return res.status(400).json({
          jsonrpc,
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
    }
  } catch (err) {
    console.error(`[paymaster] Error handling ${method}:`, err);
    return res.status(500).json({
      jsonrpc,
      id,
      error: {
        code: -32000,
        message: err.message || 'Paymaster internal error',
      },
    });
  }
});

module.exports = router;
