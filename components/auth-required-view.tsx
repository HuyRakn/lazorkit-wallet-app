'use client';

import React from 'react';
import { ShieldAlert, ArrowRight, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthRequiredViewProps {
  onConnectClick: () => void;
  title?: string;
  description?: string;
}

export function AuthRequiredView({
  onConnectClick,
  title = 'Wallet Connection Required',
  description = 'Connect your Solana devnet wallet using biometric passkeys to access this feature.',
}: AuthRequiredViewProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 min-h-[400px] max-w-md mx-auto space-y-6 select-none">
      {/* Dynamic Glowing Icon */}
      <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg animate-pulse" />
        <Fingerprint className="h-7 w-7 text-primary" />
      </div>

      {/* Text Details */}
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[320px]">
          {description}
        </p>
      </div>

      {/* Connect Button */}
      <Button
        onClick={onConnectClick}
        className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 shadow-sm shadow-primary/15 button-press"
      >
        <span>Connect Passkey</span>
        <ArrowRight className="h-4 w-4" />
      </Button>

      {/* Extra Trust/Security Info */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-medium">
        <ShieldAlert className="h-3.5 w-3.5 text-primary/80" />
        <span>100% Secure, biometric authentication.</span>
      </div>
    </div>
  );
}
