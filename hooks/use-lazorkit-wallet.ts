'use client';

import { useMemo } from 'react';
import { useWallet as useLazorWallet } from '@lazorkit/wallet';

// Wrap SDK hook to keep a single import path across the app
export function useWallet(): any {
  // LazorKit SDK already memoizes internal state; we keep a thin wrapper
  const sdk = useLazorWallet();

  return useMemo(() => {
    const connectPasskeyFn = async () => {
      const walletInfo = await sdk.connect({ feeMode: 'paymaster' });
      let smartWalletId = undefined;
      if (typeof window !== 'undefined') {
        smartWalletId = localStorage.getItem('lazorkit-smart-wallet-id-devnet') || 
                        localStorage.getItem('lazorkit-smart-wallet-id-mainnet');
      }
      return {
        ...walletInfo,
        smartWalletAddress: walletInfo.smartWallet,
        smartWalletId: smartWalletId || (walletInfo as any).smartWalletId || (walletInfo as any).walletId,
      };
    };

    const signAndSendTransactionFn = async (payload: any, options?: any) => {
      if (!sdk.signAndSendTransaction) {
        throw new Error('Transaction signing is not initialized.');
      }
      
      // If payload is a direct array of instructions, wrap it as expected by the SDK
      if (Array.isArray(payload)) {
        return sdk.signAndSendTransaction({
          instructions: payload,
          transactionOptions: options
        });
      }
      
      return sdk.signAndSendTransaction(payload);
    };

    return {
      ...sdk,
      // Map SDK README naming to our app naming for compatibility
      connectPasskey: connectPasskeyFn,
      createSmartWallet: (sdk as any)?.createSmartWallet,
      signAndSendTransaction: signAndSendTransactionFn,
      // Backward-compatible aliases expected by our app in some places
      createPasskeyOnly: connectPasskeyFn,
      createSmartWalletOnly: (sdk as any)?.createSmartWallet,
    };
  }, [sdk]);
}