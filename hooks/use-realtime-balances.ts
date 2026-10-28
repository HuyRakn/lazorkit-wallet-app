'use client';

import { useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { defaultConnection } from '@/lib/services/jupiter';
import { useWalletStore } from '@/lib/store/wallet';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const DEBOUNCE_MS = 1200;
const FALLBACK_POLL_MS = 45_000;

/**
 * Live balances: subscribes (websocket) to the wallet's SOL account and every SPL
 * token account it owns, and refreshes balances + history when any of them change.
 * A slow poll covers dropped sockets; it pauses while the tab is hidden.
 */
export function useRealtimeBalances(address?: string | null) {
  const refreshBalances = useWalletStore((s) => s.refreshBalances);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!address) return;
    let owner: PublicKey;
    try {
      owner = new PublicKey(address);
    } catch {
      return;
    }

    let disposed = false;
    const accountSubs: number[] = [];
    let programSub: number | null = null;

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!disposed) refreshBalances().catch(() => {});
      }, DEBOUNCE_MS);
    };

    // SOL balance of the wallet
    try {
      accountSubs.push(defaultConnection.onAccountChange(owner, scheduleRefresh, { commitment: 'confirmed' }));
    } catch (err) {
      console.warn('[realtime] subscribe failed', err);
    }

    // Every SPL token account owned by the wallet (existing and newly created)
    try {
      programSub = defaultConnection.onProgramAccountChange(TOKEN_PROGRAM, scheduleRefresh, {
        commitment: 'confirmed',
        filters: [{ dataSize: 165 }, { memcmp: { offset: 32, bytes: owner.toBase58() } }],
      });
    } catch {
      // Program subscriptions can be disabled on some RPCs: watch known accounts instead
      defaultConnection
        .getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM })
        .then(({ value }) => {
          if (disposed) return;
          value.forEach((acc) =>
            accountSubs.push(defaultConnection.onAccountChange(acc.pubkey, scheduleRefresh, { commitment: 'confirmed' })),
          );
        })
        .catch(() => {});
    }

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refreshBalances().catch(() => {});
    }, FALLBACK_POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && scheduleRefresh();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      accountSubs.forEach((id) => {
        defaultConnection.removeAccountChangeListener(id).catch(() => {});
      });
      if (programSub !== null) defaultConnection.removeProgramAccountChangeListener(programSub).catch(() => {});
    };
  }, [address, refreshBalances]);
}
