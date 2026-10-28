'use client';

import { useEffect } from 'react';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { useWalletStore } from '@/lib/store/wallet';

/**
 * WalletSync bridges LazorKit SDK session state → Zustand store.
 * 
 * IMPORTANT: We must NOT auto-restore the session if the user explicitly
 * logged out. The `hasExplicitlyLoggedOut` flag in the store prevents
 * WalletSync from overriding a deliberate logout with SDK's cached session.
 */
export function WalletSync() {
  const sdk = useWallet();
  const { setHasPasskey, setHasWallet, setPubkey } = useWalletStore();
  const pubkey = useWalletStore((s) => s.pubkey);
  const { isConnected, address, disconnect } = sdk;

  useEffect(() => {
    // Guard: If user explicitly logged out, do NOT auto-restore from SDK.
    // Check localStorage for the explicit logout flag.
    if (typeof window !== 'undefined') {
      const loggedOutFlag = localStorage.getItem('lazorkit-explicit-logout');
      if (loggedOutFlag === 'true') {
        // User explicitly logged out — disconnect SDK if it's still connected
        if (isConnected) {
          disconnect().catch(console.error);
        }
        return;
      }

      // If this device was linked via QR pairing to a specific wallet address,
      // do not let a different cached SDK session overwrite the paired wallet.
      const pairedWallet = localStorage.getItem('lazorkit-paired-wallet');
      if (pairedWallet && pubkey === pairedWallet && address && address !== pairedWallet) {
        return;
      }
    }

    // Only sync from SDK if it has a valid connected session. Keep the store on the
    // SDK's fund-holding address (the vault for LazorKit v2 wallets).
    if (isConnected && address && address !== pubkey) {
      setHasPasskey(true);
      setHasWallet(true);
      setPubkey(address);
    }
  }, [isConnected, address, pubkey, disconnect, setHasPasskey, setHasWallet, setPubkey]);

  return null;
}

export default WalletSync;
