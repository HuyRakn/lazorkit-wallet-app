'use client';

import { useEffect } from 'react';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { useWalletStore } from '@/lib/store/wallet';

export function WalletSync() {
  const sdk = useWallet();
  const { setHasPasskey, setHasWallet, setPubkey } = useWalletStore();

  useEffect(() => {
    if (sdk && sdk.connected && sdk.smartWallet) {
      setHasPasskey(true);
      setHasWallet(true);
      setPubkey(sdk.smartWallet);
    }
  }, [sdk.connected, sdk.smartWallet, setHasPasskey, setHasWallet, setPubkey]);

  return null;
}

export default WalletSync;
