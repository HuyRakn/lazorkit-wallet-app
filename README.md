# RampFi 🚀

**One-Tap Fiat-to-Crypto Onramp. Powered by Biometrics.**

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge\&logo=solana)](https://solana.com)

> **Eliminating the 30-minute crypto onboarding friction. From zero to Bitcoin in 30 seconds.**

RampFi is a next-generation **Seedless Solana Wallet** and **Onramp Solution** built with React Native. We leverage **Account Abstraction** and **Passkeys (WebAuthn)** to replace brittle seed phrases with secure, device-bound biometrics (FaceID/TouchID).

---

## 📹 Demo & Pitch

| 🚀 **Pitching Video (1 min)**                                             | 🛠️ **Technical Demo (Product Walkthrough)**                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Loom Pitch](https://www.loom.com/share/7ba499e7075548ef8dc9490160849e4c) | [Live Demo](https://www.loom.com/share/93775583f22e42fb8b390c73380a8bfd) |
| *The vision behind RampFi*                                                | *Live functionality: Login, Swap, Onramp*                                |

---

## 🎯 The Problem

**Current crypto onboarding is fundamentally broken:**

* **High Friction:** Centralized Exchanges (CEX) require KYC and complex bank linking, taking **hours**.
* **Security Risks:** Self-custody wallets demand managing 12–24 word seed phrases, alienating **99% of Web2 users**.
* **Market Loss:** ~70% of potential users drop off during the setup phase.

---

## ✨ The Solution: RampFi

We reduce the onboarding time from **30 minutes to 30 seconds**.

* 🔐 **Invisible Wallet Creation:** No seed phrases. Wallets are generated instantly using FaceID/TouchID via the LazorKit SDK.
* 👤 **Non-Custodial Security:** Private keys are stored in the device's Secure Enclave, ensuring hardware-grade security without sacrificing UX.
* ⚡ **Instant Fiat Onramp:** Integrated flows to buy BTC/SOL/USDC via card payments immediately after biometric login.
* 🔄 **Zero-Friction Swaps:** Powered by **Jupiter Aggregator** for best-price execution and minimal slippage.

---

## 🏗️ Technical Architecture

RampFi is not just a UI wrapper; it is a sophisticated implementation of **Account Abstraction** on Solana.

### Core Stack

* **Frontend:** React Native (Expo), TypeScript, TailwindCSS
* **Blockchain:** Solana (Devnet/Mainnet)
* **Identity:** **LazorKit SDK** (WebAuthn/FIDO2 standard)
* **DeFi Integration:** Jupiter Swap API V6
* **State Management:** Zustand with encrypted persistence

### Key Innovations

#### 1. Biometric Account Abstraction & Curve Mismatch

Standard WebAuthn credentials (Passkeys) use the **secp256r1 (P-256)** curve, while Solana natively uses **Ed25519**.

* **Our Approach:** We deploy a **Smart Wallet PDA** (Program Derived Address) that acts as the user's identity.
* **Verification:** We utilize the **SIMD-0075 precompile** to cheaply verify the P-256 biometric signatures directly on-chain, bridging the cryptographic gap without centralized relays.

#### 2. Session Keys for Banking-Grade UX

To avoid prompting FaceID for every micro-interaction (e.g., approving a swap or token allowance):

* The master Passkey authorizes an ephemeral **Session Key** (Ed25519) stored in the device's secure storage.
* This Session Key signs background transactions for a limited duration or scope, enabling a seamless **1-Tap UX** comparable to Web2 fintech apps.

---

## 🔮 Future Roadmap: Trustless ZK On-Ramp (R&D)

We are actively researching and developing a decentralized fiat-to-crypto bridge using **ZKP2P** technology to remove centralized payment processors entirely.

### ZKP2P Mechanism

* **Trustless Verification:** Zero-Knowledge Proofs (Circom circuits) verify **DKIM signatures** in payment confirmation emails (Wise, Venmo, banking apps).
* **Privacy-Preserving:** Uses **ZK-Regex** to extract payment amount and recipient hash without revealing personal data.
* **Smart Contract Escrow:** On-chain assets are released automatically when the ZK proof confirms the off-chain fiat transfer.

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* Watchman (for React Native)
* Expo Go (for mobile testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/HuyRakn/lazorkit-wallet-app.git
cd lazorkit-wallet-app

# Install dependencies
npm install

# Setup Environment Variables
cp .env.example .env.local
```

### Configuration (`.env.local`)

```env
NEXT_PUBLIC_LAZORKIT_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com
# Toggle for Mainnet/Devnet
NEXT_PUBLIC_ENABLE_MAINNET=false
```

---

## 🏆 Hackathon Context

This project demonstrates the power of the **LazorKit SDK** in solving Solana's UX trilemma.

* **Theme:** Mass Adoption & Onboarding
* **Impact:** Unlocking 35M+ potential users blocked by seed phrase complexity

---

<div align="center">
  <p>Made with ❤️ by the RampFi Team</p>
</div>
