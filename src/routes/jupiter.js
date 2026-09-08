const express = require('express');

const router = express.Router();

// Map known Solana Devnet mints to Mainnet tradable mints for price/quote routing
const DEVNET_TO_MAINNET_MINTS = {
  'So11111111111111111111111111111111111111112': 'So11111111111111111111111111111111111111112',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Devnet USDC -> Mainnet USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'DezXAZ8z7PnrnRJjz3wX4mP77h2mk7zReoY5V3443K51', // Devnet BONK -> Mainnet BONK
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': '4k3Dyjzv37sKk8AhiHc74E79wDzU15xx4GZ5NXZ474n', // Devnet RAY -> Mainnet RAY
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUPyiwrYdXYwt6kXJ64C64xaB6NPTXj64E24gHw8A9j', // Devnet JUP -> Mainnet JUP
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

// GET /api/jupiter/quote
// Uses api.jup.ag/swap/v1/quote with automatic Devnet->Mainnet mint mapping
router.get('/quote', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippageBps } = req.query;
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const requestedInput = String(inputMint);
    const requestedOutput = String(outputMint);

    const tradableInput = DEVNET_TO_MAINNET_MINTS[requestedInput] || requestedInput;
    const tradableOutput = DEVNET_TO_MAINNET_MINTS[requestedOutput] || requestedOutput;

    const url = `https://api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(
      tradableInput
    )}&outputMint=${encodeURIComponent(tradableOutput)}&amount=${encodeURIComponent(
      String(amount)
    )}&slippageBps=${encodeURIComponent(String(slippageBps || 50))}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'lazorkit-wallet-app/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Upstream error ${resp.status}`, details: text.slice(0, 200) });
    }

    const data = await resp.json();

    // Map mints back to the requested addresses so client recognizes its devnet tokens
    const responseData = {
      ...data,
      inputMint: requestedInput,
      outputMint: requestedOutput,
      _mainnetInput: tradableInput,
      _mainnetOutput: tradableOutput,
    };

    return res.json(responseData);
  } catch (e) {
    return res.status(500).json({ error: 'Proxy error', message: e?.message || String(e) });
  }
});

// POST /api/jupiter/swap
// Proxies swap transaction building to api.jup.ag/swap/v1/swap
router.post('/swap', async (req, res) => {
  try {
    const { quoteResponse, userPublicKey, wrapAndUnwrapSol = true } = req.body || {};
    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({ error: 'Missing quoteResponse or userPublicKey' });
    }

    // Re-map mainnet mints if stored in quoteResponse for Jupiter engine
    const upstreamQuote = { ...quoteResponse };
    if (upstreamQuote._mainnetInput) upstreamQuote.inputMint = upstreamQuote._mainnetInput;
    if (upstreamQuote._mainnetOutput) upstreamQuote.outputMint = upstreamQuote._mainnetOutput;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'lazorkit-wallet-app/1.0',
      },
      body: JSON.stringify({
        quoteResponse: upstreamQuote,
        userPublicKey,
        wrapAndUnwrapSol,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Upstream error ${resp.status}`, details: text.slice(0, 200) });
    }

    const data = await resp.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Swap build error', message: e?.message || String(e) });
  }
});

module.exports = router;


