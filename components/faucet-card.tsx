'use client';

import { useCallback, useEffect, useState } from 'react';
import { Droplets, Loader2, Clock } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { claimFaucet, getFaucetStatus, type FaucetStatus } from '@/lib/services/backend-api';
import { toast } from '@/hooks/use-toast';

function formatRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * One-tap devnet faucet: SOL (fees/rent) + rUSDC (to try swap/send) from the RampFi treasury.
 */
export const FaucetCard = ({ variant = 'card' }: { variant?: 'card' | 'button' }) => {
  const { pubkey, refreshBalances, addActivity } = useWalletStore();
  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!pubkey) return;
    try {
      setStatus(await getFaucetStatus(pubkey));
    } catch {
      setStatus(null);
    }
  }, [pubkey]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleClaim = async () => {
    if (!pubkey || claiming) return;
    setClaiming(true);
    try {
      const result = await claimFaucet(pubkey);
      const sig = result.usdc.signature || result.sol.signature;
      addActivity?.({
        id: sig || `faucet-${Date.now()}`,
        kind: 'receive',
        ts: new Date().toISOString(),
        summary: `Faucet: +${result.sol.amount} SOL, +${result.usdc.amount} USDC`,
        amount: result.usdc.amount,
        token: 'USDC',
        status: 'Success',
        txSignature: sig,
      });
      toast({
        title: 'Devnet funds received',
        description: `+${result.sol.amount} SOL and +${result.usdc.amount} USDC landed in your wallet.`,
      });
      setTimeout(() => refreshBalances?.().catch(console.error), 1500);
    } catch (e) {
      toast({ title: 'Faucet unavailable', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setClaiming(false);
      loadStatus();
    }
  };

  if (!pubkey || (status && !status.enabled)) return null;

  const disabled = claiming || (status ? !status.canClaim : false);
  const label = claiming
    ? 'Sending…'
    : status?.nextClaimAt
      ? `Next claim in ${formatRemaining(status.nextClaimAt)}`
      : `Get ${status?.amounts.SOL ?? 0.5} SOL + ${status?.amounts.USDC ?? 100} USDC`;

  if (variant === 'button') {
    return (
      <button
        id='faucet-claim-button'
        onClick={handleClaim}
        disabled={disabled}
        title={label}
        className='px-2.5 h-7 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 transition-all bg-sky-500/10 border-sky-400/30 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        {claiming ? <Loader2 className='h-3 w-3 animate-spin' /> : status?.nextClaimAt ? <Clock className='h-3 w-3' /> : <Droplets className='h-3 w-3' />}
        Faucet
      </button>
    );
  }

  return (
    <div className='rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-transparent to-primary/10 p-4 flex items-center justify-between gap-3'>
      <div className='flex items-center gap-3 min-w-0'>
        <div className='w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0'>
          <Droplets className='h-5 w-5 text-sky-300' />
        </div>
        <div className='min-w-0'>
          <div className='text-sm font-extrabold text-white'>Devnet Faucet</div>
          <div className='text-[11px] text-muted-foreground truncate'>
            Free SOL for fees + USDC to try swaps, transfers and NFTs on-chain.
          </div>
        </div>
      </div>
      <button
        id='faucet-claim-card-button'
        onClick={handleClaim}
        disabled={disabled}
        className='shrink-0 px-3 h-9 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-sky-400 text-[#06121a] hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
      >
        {claiming && <Loader2 className='h-3.5 w-3.5 animate-spin' />}
        {label}
      </button>
    </div>
  );
};
