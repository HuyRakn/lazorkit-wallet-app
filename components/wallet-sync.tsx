'use client';

import { useEffect, useRef } from 'react';
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
  const { setHasPasskey, setHasWallet, setPubkey, hasWallet } = useWalletStore();
  const hasInitialSynced = useRef(false);

  useEffect(() => {
    // Guard: If user explicitly logged out, do NOT auto-restore from SDK.
    // Check localStorage for the explicit logout flag.
    if (typeof window !== 'undefined') {
      const loggedOutFlag = localStorage.getItem('lazorkit-explicit-logout');
      if (loggedOutFlag === 'true') {
        // User explicitly logged out — disconnect SDK if it's still connected
        if (sdk && sdk.disconnect && (sdk.connected || sdk.isConnected)) {
          sdk.disconnect().catch(console.error);
        }
        return;
      }
    }

    // Only sync from SDK if it has a valid connected session
    const isConnected = sdk?.connected || sdk?.isConnected;
    const walletAddress = sdk?.smartWallet || sdk?.smartWalletPubkey?.toString();
    
    if (sdk && isConnected && walletAddress && !hasInitialSynced.current) {
      hasInitialSynced.current = true;
      setHasPasskey(true);
      setHasWallet(true);
      setPubkey(walletAddress);
    }
  }, [sdk?.connected, sdk?.isConnected, sdk?.smartWallet, sdk?.smartWalletPubkey, setHasPasskey, setHasWallet, setPubkey]);

  return null;
}

export default WalletSync;
