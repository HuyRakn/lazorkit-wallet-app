/**
 * NFT Utilities for Metaplex Integration
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createMetadataAccountV3,
  createMasterEditionV3,
  mplTokenMetadata,
  findMetadataPda,
  findMasterEditionPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { mplBubblegum, mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import {
  publicKey as umiPublicKey,
  signerIdentity,
  Signer,
  none,
} from '@metaplex-foundation/umi';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { defaultConnection } from '@/lib/services/jupiter';

// Constants
export const NFT_NAME_MAX_LENGTH = 32;
export const NFT_DESCRIPTION_MAX_LENGTH = 200;
export const REGULAR_NFT_SYMBOL = 'LKST';
export const CNFT_SYMBOL = 'cLKST';

// Pre-created merkle tree on devnet for cNFT demo
export const DEMO_MERKLE_TREE = 'HiTxt5DJMYSpwZ7i3Kx5qzYsuAfEWMZMnyGCNokC7Y2u';

/**
 * Create a dummy signer for building Umi instructions
 * LazorKit handles the actual signing via passkey
 */
export function createDummySigner(walletAddress: string): Signer {
  return {
    publicKey: umiPublicKey(walletAddress),
    signMessage: async () => new Uint8Array(64),
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
}

/**
 * Build Metaplex metadata and master edition instructions for a regular NFT
 */
export async function buildMetaplexInstructions(
  walletAddress: string,
  mintAddress: string,
  nftName: string,
  metadataUri: string,
  symbol: string = REGULAR_NFT_SYMBOL
): Promise<TransactionInstruction[]> {
  const rpcUrl = defaultConnection.rpcEndpoint;
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());

  const mintPublicKey = umiPublicKey(mintAddress);
  const walletPublicKey = umiPublicKey(walletAddress);
  const dummySigner = createDummySigner(walletAddress);

  umi.use(signerIdentity(dummySigner));

  const instructions: TransactionInstruction[] = [];

  // Derive PDAs
  const metadata = findMetadataPda(umi, { mint: mintPublicKey });
  const masterEdition = findMasterEditionPda(umi, { mint: mintPublicKey });

  // Build CreateMetadataAccountV3 instruction
  const createMetadataBuilder = createMetadataAccountV3(umi, {
    metadata,
    mint: mintPublicKey,
    mintAuthority: dummySigner,
    payer: dummySigner,
    updateAuthority: walletPublicKey,
    data: {
      name: nftName,
      symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      creators: [
        {
          address: walletPublicKey,
          verified: false,
          share: 100,
        },
      ],
      collection: null,
      uses: null,
    },
    isMutable: true,
    collectionDetails: null,
  });

  const metadataIxs = createMetadataBuilder.getInstructions();
  for (const ix of metadataIxs) {
    instructions.push(toWeb3JsInstruction(ix));
  }

  // Build CreateMasterEditionV3 instruction
  const createMasterEditionBuilder = createMasterEditionV3(umi, {
    edition: masterEdition,
    mint: mintPublicKey,
    updateAuthority: dummySigner,
    mintAuthority: dummySigner,
    payer: dummySigner,
    metadata,
    maxSupply: 0, // 0 means no prints allowed (true 1/1)
  });

  const masterEditionIxs = createMasterEditionBuilder.getInstructions();
  for (const ix of masterEditionIxs) {
    instructions.push(toWeb3JsInstruction(ix));
  }

  return instructions;
}

/**
 * Build Bubblegum mint instruction for a compressed NFT
 */
export function buildCNftMintInstruction(
  walletAddress: string,
  merkleTreeAddress: string,
  nftName: string,
  metadataUri: string,
  symbol: string = CNFT_SYMBOL
): TransactionInstruction[] {
  const rpcUrl = defaultConnection.rpcEndpoint;
  const umi = createUmi(rpcUrl).use(mplBubblegum());
  const dummySigner = createDummySigner(walletAddress);

  umi.use(signerIdentity(dummySigner));

  const mintBuilder = mintV1(umi, {
    leafOwner: umiPublicKey(walletAddress),
    merkleTree: umiPublicKey(merkleTreeAddress),
    metadata: {
      name: nftName,
      symbol,
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      collection: none(),
      creators: [
        {
          address: umiPublicKey(walletAddress),
          verified: false,
          share: 100,
        },
      ],
    },
  });

  const mintIxs = mintBuilder.getInstructions();
  const instructions: TransactionInstruction[] = [];

  for (const ix of mintIxs) {
    instructions.push(toWeb3JsInstruction(ix));
  }

  return instructions;
}

/**
 * Extract Asset ID from transaction logs
 * The Bubblegum program logs: "Leaf asset ID: <asset_id>"
 */
export async function extractCNftAssetId(signature: string): Promise<string> {
  // Wait for transaction to be confirmed and logs available
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const tx = await defaultConnection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (tx?.meta?.logMessages) {
      for (const log of tx.meta.logMessages) {
        const match = log.match(/Leaf asset ID: ([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (match) {
          return match[1];
        }
      }
    }
  } catch (err) {
    console.error('Failed to extract asset ID:', err);
  }

  return 'Unknown (check transaction logs)';
}

/**
 * Store NFT metadata on the API and get the metadata URI
 */
export async function storeNftMetadata(
  mintId: string,
  metadata: { name: string; description: string }
): Promise<string> {
  const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  const response = await fetch(`${backendBase}/api/nft-metadata/${mintId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: metadata.name.trim(),
      description: metadata.description.trim(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to store metadata');
  }

  const { metadataUri } = await response.json();
  return metadataUri;
}

/**
 * Generate a unique mint ID
 */
export function generateMintId(prefix: string = 'nft'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate NFT name and description length
 */
export function validateNftMetadata(name: string, description: string) {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Name is required' };
  }
  if (name.length > NFT_NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be ${NFT_NAME_MAX_LENGTH} characters or less` };
  }
  if (!description || description.trim() === '') {
    return { valid: false, error: 'Description is required' };
  }
  if (description.length > NFT_DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: `Description must be ${NFT_DESCRIPTION_MAX_LENGTH} characters or less` };
  }
  return { valid: true };
}

/**
 * Adds smart wallet to instructions for LazorKit validation
 */
export function addSmartWalletToInstructions(
  instructions: TransactionInstruction[],
  smartWalletAddress: string
): void {
  const walletPubkey = new PublicKey(smartWalletAddress);

  instructions.forEach((ix) => {
    const hasSmartWallet = ix.keys.some(k => k.pubkey.toBase58() === smartWalletAddress);
    if (!hasSmartWallet) {
      ix.keys.push({ pubkey: walletPubkey, isSigner: false, isWritable: false });
    }
  });
}
