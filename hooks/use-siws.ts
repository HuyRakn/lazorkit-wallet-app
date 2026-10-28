'use client';

import { useCallback } from 'react';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { API_BASE } from '@/lib/services/backend-api';

const storageKey = (wallet: string) => `rampfi-siws:${wallet}`;

interface StoredSession {
  token: string;
  expiresAt: string;
}

function readSession(wallet: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    // refresh a minute early
    return new Date(s.expiresAt).getTime() - 60_000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/**
 * Sign-In With Solana for the passkey wallet. `signIn()` asks the passkey to sign a
 * one-time message; the backend checks it against the wallet's on-chain authority and
 * returns a JWT. `authedFetch()` signs in on demand (once per ~12h) and retries once
 * if the backend rejects an expired session.
 */
export function useSiws() {
  const lz = useWallet();
  const wallet = lz.address;

  const signIn = useCallback(async (): Promise<string> => {
    if (!wallet || !lz.wallet?.credentialId) throw new Error('Connect your passkey wallet first.');
    const nonceRes = await fetch(`${API_BASE}/api/auth/nonce?wallet=${wallet}`);
    const challenge = await nonceRes.json();
    if (!nonceRes.ok) throw new Error(challenge.error || 'Could not start sign-in');

    const signed = await lz.signMessage(challenge.message);
    const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        credentialId: lz.wallet.credentialId,
        message: challenge.message,
        ...signed,
      }),
    });
    const session = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(session.error || 'Sign-in failed');
    localStorage.setItem(storageKey(wallet), JSON.stringify({ token: session.token, expiresAt: session.expiresAt }));
    return session.token as string;
  }, [wallet, lz]);

  const getToken = useCallback(async () => {
    if (!wallet) throw new Error('Connect your passkey wallet first.');
    return readSession(wallet)?.token ?? signIn();
  }, [wallet, signIn]);

  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const send = (token: string) => {
        const headers = new Headers(init.headers);
        if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, { ...init, headers });
      };
      let res = await send(await getToken());
      if (res.status === 401 && wallet) {
        localStorage.removeItem(storageKey(wallet));
        res = await send(await signIn());
      }
      return res;
    },
    [getToken, signIn, wallet],
  );

  const isSignedIn = !!wallet && typeof window !== 'undefined' && !!readSession(wallet);

  return { signIn, authedFetch, isSignedIn, wallet };
}
