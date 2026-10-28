/**
 * Native Solana Devnet Staking Service using StakeProgram.
 *
 * Designed for Smart Wallets / PDAs:
 * - Uses PublicKey.createWithSeed so the vault PDA can sign without ephemeral keypairs.
 * - Allows creating, delegating, deactivating, and withdrawing stake accounts.
 */
import {
  Connection,
  PublicKey,
  StakeProgram,
  TransactionInstruction,
} from '@solana/web3.js';

export interface ValidatorInfo {
  votePubkey: string;
  activatedStakeSol: number;
  commission: number;
  name?: string;
}

export interface UserStakeAccount {
  pubkey: string;
  totalSol: number;
  stakedSol: number;
  state: 'active' | 'activating' | 'deactivating' | 'inactive';
  voter: string | null;
  activationEpoch: number | null;
  deactivationEpoch: number | null;
}

/**
 * Fetch top active validators on devnet.
 */
export async function getDevnetValidators(connection: Connection): Promise<ValidatorInfo[]> {
  const votes = await connection.getVoteAccounts();
  return votes.current
    .map((v) => ({
      votePubkey: v.votePubkey,
      activatedStakeSol: Math.round(v.activatedStake / 1e9),
      commission: v.commission,
    }))
    .sort((a, b) => b.activatedStakeSol - a.activatedStakeSol)
    .slice(0, 10);
}

/**
 * Query all stake accounts owned/withdrawable by the given wallet on devnet.
 * Uses StakeProgram memcmp filter at offset 44 (Authorized.withdrawer pubkey).
 */
export async function getUserStakeAccounts(
  connection: Connection,
  walletAddress: string
): Promise<UserStakeAccount[]> {
  try {
    const epochInfo = await connection.getEpochInfo();
    const currentEpoch = epochInfo.epoch;

    const accounts = await connection.getParsedProgramAccounts(StakeProgram.programId, {
      filters: [
        {
          memcmp: {
            offset: 44,
            bytes: walletAddress,
          },
        },
      ],
    });

    return accounts.map(({ pubkey, account }) => {
      const parsed = (account.data as any)?.parsed;
      const info = parsed?.info;
      const delegation = info?.stake?.delegation;

      let state: UserStakeAccount['state'] = 'inactive';
      let voter: string | null = null;
      let activationEpoch: number | null = null;
      let deactivationEpoch: number | null = null;
      let stakedSol = 0;

      if (delegation) {
        voter = delegation.voter;
        activationEpoch = Number(delegation.activationEpoch);
        deactivationEpoch = Number(delegation.deactivationEpoch);
        stakedSol = Number(delegation.stake) / 1e9;

        if (deactivationEpoch <= currentEpoch) {
          state = 'inactive';
        } else if (activationEpoch === currentEpoch) {
          state = 'activating';
        } else if (deactivationEpoch > currentEpoch && deactivationEpoch !== 18446744073709551615) {
          state = 'deactivating';
        } else {
          state = 'active';
        }
      }

      return {
        pubkey: pubkey.toBase58(),
        totalSol: account.lamports / 1e9,
        stakedSol,
        state,
        voter,
        activationEpoch,
        deactivationEpoch,
      };
    });
  } catch (err) {
    console.error('[staking] failed to load user stake accounts:', err);
    return [];
  }
}

/**
 * Build instructions to create a seed-based stake account and delegate it in a single transaction.
 */
export async function buildCreateAndDelegateStake(
  connection: Connection,
  walletPubkey: PublicKey,
  votePubkey: PublicKey,
  solAmount: number
): Promise<{ instructions: TransactionInstruction[]; stakePubkey: PublicKey; seed: string }> {
  const seed = `stk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const stakePubkey = await PublicKey.createWithSeed(walletPubkey, seed, StakeProgram.programId);

  const rentExempt = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
  const stakeLamports = Math.round(solAmount * 1e9);

  const createTx = StakeProgram.createAccountWithSeed({
    fromPubkey: walletPubkey,
    stakePubkey,
    basePubkey: walletPubkey,
    seed,
    authorized: {
      staker: walletPubkey,
      withdrawer: walletPubkey,
    },
    lamports: rentExempt + stakeLamports,
  });

  const delegateTx = StakeProgram.delegate({
    stakePubkey,
    authorizedPubkey: walletPubkey,
    votePubkey,
  });

  return {
    instructions: [...createTx.instructions, ...delegateTx.instructions],
    stakePubkey,
    seed,
  };
}

/**
 * Build instructions to deactivate (unstake) a stake account.
 */
export function buildDeactivateStake(
  walletPubkey: PublicKey,
  stakePubkey: PublicKey
): TransactionInstruction[] {
  return StakeProgram.deactivate({
    stakePubkey,
    authorizedPubkey: walletPubkey,
  }).instructions;
}

/**
 * Build instructions to withdraw lamports from an inactive stake account back to the wallet.
 */
export function buildWithdrawStake(
  walletPubkey: PublicKey,
  stakePubkey: PublicKey,
  totalLamports: number
): TransactionInstruction[] {
  return StakeProgram.withdraw({
    stakePubkey,
    authorizedPubkey: walletPubkey,
    toPubkey: walletPubkey,
    lamports: totalLamports,
  }).instructions;
}
