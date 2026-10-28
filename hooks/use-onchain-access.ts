'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLE_SPENDER } from '@lazorkit/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { getWalletAccess, type WalletAccess } from '@/lib/services/backend-api';
import {
  QUICK_PAY_EXPIRY_SLOTS,
  QUICK_PAY_LIMITS,
  TRUSTED_BROWSER_LIMITS,
  clearAuthorityMarker,
  clearSessionMarker,
  getAuthorityMarker,
  getSessionMarker,
  setAuthorityMarker,
  setSessionMarker,
  slotsToMs,
  toSpendingLimits,
  trustedBrowserPolicy,
  type AuthorityMarker,
  type SessionMarker,
} from '@/lib/lazorkit/quick-access';

/**
 * On-chain access list of the connected LazorKit wallet (authorities +
 * sessions, read from chain by the backend) and the actions that change it.
 * Every action is one passkey approval.
 */
export function useOnchainAccess() {
  const lz = useWallet();
  const walletPda = lz.wallet?.smartWallet ?? null;
  const isV2 = lz.wallet?.protocolVersion !== 1;

  const [access, setAccess] = useState<WalletAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sessionMarker, setSessionMarkerState] = useState<SessionMarker | null>(null);
  const [authorityMarker, setAuthorityMarkerState] = useState<AuthorityMarker | null>(null);

  const syncMarkers = useCallback(
    (data: WalletAccess | null) => {
      if (!walletPda) return;
      let s = getSessionMarker(walletPda);
      let a = getAuthorityMarker(walletPda);
      // Drop markers whose account is gone (revoked elsewhere, expired, removed)
      if (data) {
        if (s && !data.sessions.some((x) => x.pda === s!.sessionPda && !x.expired)) {
          clearSessionMarker(walletPda);
          s = null;
        }
        if (a && !data.authorities.some((x) => x.pda === a!.authorityPda)) {
          clearAuthorityMarker(walletPda);
          a = null;
        }
      }
      setSessionMarkerState(s);
      setAuthorityMarkerState(a);
    },
    [walletPda],
  );

  const refresh = useCallback(
    async (fresh = false) => {
      if (!walletPda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getWalletAccess(walletPda, fresh);
        setAccess(data);
        syncMarkers(data);
      } catch (e) {
        setError((e as Error).message);
        syncMarkers(null);
      } finally {
        setLoading(false);
      }
    },
    [walletPda, syncMarkers],
  );

  useEffect(() => {
    setAccess(null);
    if (walletPda) refresh();
  }, [walletPda, refresh]);

  // The chain needs a moment before the backend's gPA sees a new account
  const refreshSoon = () => setTimeout(() => refresh(true), 2500);

  const run = async <T,>(label: string, fn: () => Promise<T>) => {
    setBusy(label);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  };

  const trustThisBrowser = () =>
    run('trust', async () => {
      if (!walletPda) throw new Error('Connect your wallet first');
      const res = await lz.addAuthority({ role: ROLE_SPENDER, policy: trustedBrowserPolicy() });
      setAuthorityMarker(walletPda, {
        authorityPda: res.authorityPda,
        publicKey: res.authorityPublicKey,
        limits: TRUSTED_BROWSER_LIMITS,
      });
      syncMarkers(null);
      refreshSoon();
      return res;
    });

  const removeAuthority = (authorityPda: string) =>
    run(`remove:${authorityPda}`, async () => {
      if (!walletPda) throw new Error('Connect your wallet first');
      await lz.removeAuthority(authorityPda);
      if (getAuthorityMarker(walletPda)?.authorityPda === authorityPda) clearAuthorityMarker(walletPda);
      syncMarkers(null);
      refreshSoon();
    });

  const enableQuickPay = () =>
    run('session', async () => {
      if (!walletPda) throw new Error('Connect your wallet first');
      const res = await lz.createSession({
        expiresInSlots: BigInt(QUICK_PAY_EXPIRY_SLOTS),
        spendingLimits: toSpendingLimits(QUICK_PAY_LIMITS),
      });
      setSessionMarker(walletPda, {
        sessionPda: res.sessionPda,
        sessionKey: res.sessionPublicKey,
        expiresAt: Date.now() + slotsToMs(QUICK_PAY_EXPIRY_SLOTS),
        limits: QUICK_PAY_LIMITS,
      });
      syncMarkers(null);
      refreshSoon();
      return res;
    });

  const revokeSession = (sessionPda: string) =>
    run(`revoke:${sessionPda}`, async () => {
      if (!walletPda) throw new Error('Connect your wallet first');
      await lz.revokeSession({ sessionPda });
      if (getSessionMarker(walletPda)?.sessionPda === sessionPda) clearSessionMarker(walletPda);
      syncMarkers(null);
      refreshSoon();
    });

  return {
    walletPda,
    isV2,
    access,
    loading,
    error,
    busy,
    sessionMarker,
    authorityMarker,
    refresh,
    trustThisBrowser,
    removeAuthority,
    enableQuickPay,
    revokeSession,
  };
}
