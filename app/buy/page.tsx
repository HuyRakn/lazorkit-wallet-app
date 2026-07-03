'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/lib/store/wallet';

export default function BuyPageRedirect() {
  const router = useRouter();
  const { setActiveSection } = useWalletStore();

  useEffect(() => {
    // Set active section on home page to 'buy' and redirect to root
    setActiveSection('buy');
    router.replace('/');
  }, [router, setActiveSection]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Redirecting to RampFi Workspace...</p>
      </div>
    </div>
  );
}
