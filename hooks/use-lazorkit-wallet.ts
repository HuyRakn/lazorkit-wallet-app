'use client';

import { useMemo } from 'react';
import { useWallet as useLazorWallet } from '@lazorkit/wallet';
import type { WalletInfo } from '@lazorkit/wallet';
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { defaultConnection } from '@/lib/services/jupiter';

/** Solana packet limit for one serialized transaction. */
const PACKET_LIMIT = 1232;
/**
 * Bytes LazorKit adds around the app's instructions in a direct send: the
 * secp256r1 verify instruction (passkey pubkey, signature, authenticatorData,
 * clientDataJSON ≈ 300+), the execute instruction header, wallet/vault/authority/
 * payer accounts and the fee payer signature.
 */
const LAZORKIT_WRAP_OVERHEAD = 640;
const DUMMY_PAYER = new PublicKey('11111111111111111111111111111112');

/** Rough size of the app's instructions once compiled (with the given lookup tables). */
export function estimateInstructionsSize(
  instructions: TransactionInstruction[],
  tables: AddressLookupTableAccount[] = [],
): number {
  try {
    const message = new TransactionMessage({
      payerKey: DUMMY_PAYER,
      recentBlockhash: '11111111111111111111111111111111',
      instructions,
    }).compileToV0Message(tables);
    return message.serialize().length;
  } catch {
    return 0; // can't tell: let the direct send decide
  }
}

/** True when a direct LazorKit send would likely exceed the packet limit. */
export function needsDeferredExecution(
  instructions: TransactionInstruction[],
  tables: AddressLookupTableAccount[] = [],
): boolean {
  return estimateInstructionsSize(instructions, tables) + LAZORKIT_WRAP_OVERHEAD > PACKET_LIMIT;
}

const isTxSizeError = (err: unknown) =>
  /too large|encoding overruns|exceeds.*(size|limit)|1232|transaction size/i.test(
    String((err as Error)?.message ?? err),
  );

/** Resolve on-chain address lookup tables (skips any that don't exist). */
export async function resolveLookupTables(addresses: string[] = []): Promise<AddressLookupTableAccount[]> {
  const results = await Promise.all(
    addresses.map((a) => defaultConnection.getAddressLookupTable(new PublicKey(a)).catch(() => null)),
  );
  return results
    .map((r) => r?.value ?? null)
    .filter((t): t is AddressLookupTableAccount => t !== null);
}

type LazorWallet = ReturnType<typeof useLazorWallet>;
type SendPayload = Parameters<LazorWallet['signAndSendTransaction']>[0];
type TransactionOptions = NonNullable<SendPayload['transactionOptions']>;

/** Connected wallet info, enriched with the address names the app uses. */
export type ConnectedWallet = WalletInfo & {
  /** Fund-holding address (v2 vault PDA, or the v1 smart wallet). Show/receive on this. */
  smartWalletAddress: string;
  /** LazorKit wallet (config) PDA. */
  walletPda: string;
};

export type AppWallet = Omit<LazorWallet, 'signAndSendTransaction'> & {
  /** Fund-holding address of the connected wallet, or null. */
  address: string | null;
  connectPasskey: () => Promise<ConnectedWallet>;
  /** Alias kept for older call sites. */
  createPasskeyOnly: () => Promise<ConnectedWallet>;
  signAndSendTransaction: (
    payload: TransactionInstruction[] | VersionedTransaction | SendPayload,
    options?: TransactionOptions,
  ) => Promise<string>;
};

/** The address users hold funds on: the vault for LazorKit v2, the smart wallet for v1. */
export function getWalletAddress(info?: Pick<WalletInfo, 'vaultPda' | 'smartWallet'> | null): string | null {
  return info?.vaultPda || info?.smartWallet || null;
}

/**
 * LazorKit adds its own compute budget, so drop any from a pre-built transaction
 * and hand the remaining instructions (plus lookup tables) to the SDK.
 */
async function decompileVersionedTransaction(tx: VersionedTransaction) {
  const lookups = tx.message.addressTableLookups ?? [];
  const tables = (
    await Promise.all(lookups.map((l) => defaultConnection.getAddressLookupTable(l.accountKey)))
  )
    .map((r) => r.value)
    .filter((t): t is AddressLookupTableAccount => t !== null);

  const message = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: tables });
  const instructions = message.instructions.filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId),
  );
  return { instructions, tables };
}

// Wrap SDK hook to keep a single import path across the app
export function useWallet(): AppWallet {
  const sdk = useLazorWallet();

  return useMemo(() => {
    const connectPasskey = async (): Promise<ConnectedWallet> => {
      const info = await sdk.connect();
      return {
        ...info,
        smartWalletAddress: getWalletAddress(info) as string,
        walletPda: info.smartWallet,
      };
    };

    /**
     * Direct send when it fits one packet; otherwise LazorKit's deferred flow
     * (TX1 Authorize with the passkey, TX2 Execute with the instructions).
     * A direct send rejected for size also falls back to the deferred flow.
     */
    const sendInstructions = async (instructions: TransactionInstruction[], options?: TransactionOptions) => {
      const tables = options?.addressLookupTableAccounts ?? [];
      const canDefer = typeof sdk.authorizeAndExecute === 'function';

      if (canDefer && needsDeferredExecution(instructions, tables)) {
        return sdk.authorizeAndExecute({ instructions, transactionOptions: options });
      }
      try {
        return await sdk.signAndSendTransaction({ instructions, transactionOptions: options });
      } catch (err) {
        if (canDefer && isTxSizeError(err)) {
          console.warn('[lazorkit] Transaction too large for a direct send, using deferred execution');
          return sdk.authorizeAndExecute({ instructions, transactionOptions: options });
        }
        throw err;
      }
    };

    const signAndSendTransaction: AppWallet['signAndSendTransaction'] = async (payload, options) => {
      if (!sdk.signAndSendTransaction) {
        throw new Error('Transaction signing is not initialized.');
      }

      // Bare instruction list
      if (Array.isArray(payload)) {
        return sendInstructions(payload, options);
      }

      // Pre-built transaction (e.g. Jupiter swap): re-wrap its instructions for the smart wallet
      if (payload instanceof VersionedTransaction) {
        const { instructions, tables } = await decompileVersionedTransaction(payload);
        return sendInstructions(instructions, {
          ...options,
          ...(tables.length ? { addressLookupTableAccounts: tables } : {}),
        });
      }

      return sendInstructions(payload.instructions, payload.transactionOptions);
    };

    const address = sdk.vaultPubkey?.toBase58() ?? sdk.smartWalletPubkey?.toBase58() ?? null;

    return {
      ...sdk,
      address,
      connectPasskey,
      createPasskeyOnly: connectPasskey,
      signAndSendTransaction,
    };
  }, [sdk]);
}