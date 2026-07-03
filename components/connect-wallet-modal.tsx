'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { Sparkles, Shield, QrCode } from 'lucide-react';

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletModal({ open, onOpenChange }: ConnectWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQRData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const { setHasPasskey, setHasWallet, setPubkey } = useWalletStore();
  const wallet = useWallet();

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!wallet?.connectPasskey) {
        throw new Error('Passkey login not available');
      }
      const passkeyData = await wallet.connectPasskey();
      if (!passkeyData) throw new Error('Failed to login with passkey');

      setHasPasskey?.(true);

      // Create smart wallet on backend
      const resp = await fetch(`${apiBase}/api/orders/create-smart-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyData }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create smart wallet');
      }
      const data = await resp.json();
      const addr = data?.walletAddress;
      if (!addr) throw new Error('No wallet address returned');

      setHasWallet?.(true);
      setPubkey?.(addr);
      onOpenChange(false);
    } catch (e: any) {
      console.error('Login failed:', e);
      alert(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!wallet?.connectPasskey) {
        throw new Error('Passkey login not available');
      }
      const passkeyData = await wallet.connectPasskey();
      if (!passkeyData) throw new Error('Failed to login with passkey');

      setHasPasskey?.(true);

      const deviceMetadata = {
        deviceId: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        platform: typeof navigator !== 'undefined' ? navigator.platform : '',
        screen: {
          w: typeof window !== 'undefined' ? window.screen.width : 1920,
          h: typeof window !== 'undefined' ? window.screen.height : 1080,
        },
        language: typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US',
      };

      const resp = await fetch(`${apiBase}/api/device-import/generate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passkeyData,
          deviceMetadata,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to generate QR code');
      }
      const data = await resp.json();

      localStorage.setItem('device-import-shareId', data.shareId);
      localStorage.setItem('device-import-passkeyData', JSON.stringify(passkeyData));

      setShowQRModal(true);
      setQRData(data);
      startPolling(data.shareId);
    } catch (e: any) {
      console.error('Import failed:', e);
      alert(e?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (shareId: string) => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${apiBase}/api/device-import/status/${shareId}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'approved') {
            const passkeyDataStr = localStorage.getItem('device-import-passkeyData');
            if (passkeyDataStr && passkeyDataStr !== 'undefined') {
              localStorage.removeItem('device-import-passkeyData');
            }
            setHasWallet?.(true);
            setPubkey?.(data.walletAddress);
            localStorage.removeItem('device-import-shareId');
            clearInterval(interval);
            setPollingInterval(null);
            setShowQRModal(false);
            onOpenChange(false);
          } else if (data.status === 'rejected' || data.status === 'expired') {
            clearInterval(interval);
            setPollingInterval(null);
            setShowQRModal(false);
            alert('Device connection was rejected or expired');
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000);

    setPollingInterval(interval);
  };

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return (
    <>
      <Dialog open={open && !showQRModal} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border border-border/80 max-w-sm w-full p-6 text-center rounded-2xl">
          <DialogHeader className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
              <Sparkles className="h-5.5 w-5.5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Connect to Ramp<span className="text-primary">Fi</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Access your Solana devnet wallet gaslessly using secure biometric passkeys.
            </p>
          </DialogHeader>

          <div className="space-y-3 pt-6">
            <Button
              className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition flex items-center justify-center gap-2 button-press shadow-sm"
              onClick={handleLogin}
              disabled={loading}
            >
              <Shield className="h-4 w-4" />
              {loading ? 'Connecting...' : 'Connect with Passkey'}
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 border-border/60 text-foreground hover:bg-muted/30 font-semibold rounded-xl transition flex items-center justify-center gap-2 button-press"
              onClick={handleImport}
              disabled={loading}
            >
              <QrCode className="h-4 w-4" />
              Import Existing Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code dialog */}
      <Dialog open={open && showQRModal} onOpenChange={(v) => {
        if (!v) {
          setShowQRModal(false);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      }}>
        <DialogContent className="glass-card border border-border/85 max-w-sm w-full p-6 text-center rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Connect Device</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Scan this QR code with your logged-in device to approve this session.
            </p>
          </DialogHeader>

          {qrData && (
            <div className="my-5 flex flex-col items-center justify-center">
              <div className="relative p-1 bg-white rounded-lg">
                <img
                  src={qrData.qrCode}
                  alt="Import QR"
                  className="w-48 h-48"
                />
              </div>
              <span className="text-[10px] text-muted-foreground/80 mt-3.5 bg-muted/40 px-2 py-1 rounded">
                Expires in {qrData.expiresAt ? Math.ceil((new Date(qrData.expiresAt).getTime() - Date.now()) / 60000) : 0} minutes
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              setShowQRModal(false);
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
            }}
            className="w-full h-10 border-t border-border/20 text-muted-foreground hover:text-foreground text-xs font-semibold"
          >
            Cancel import
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
