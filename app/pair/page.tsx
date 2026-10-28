'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Smartphone,
  Monitor,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Blockie } from '@/components/ui/blockie';
import { useWalletStore } from '@/lib/store/wallet';
import { toast } from '@/hooks/use-toast';

function getLocalDeviceMetadata() {
  if (typeof window === 'undefined') {
    return {
      deviceId: `dev_${Date.now()}`,
      userAgent: '',
      platform: 'Browser',
      screen: { w: 1920, h: 1080 },
      language: 'en-US',
    };
  }
  return {
    deviceId:
      localStorage.getItem('rampfi-device-id') ||
      (() => {
        const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('rampfi-device-id', id);
        return id;
      })(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'Browser',
    screen: { w: window.screen?.width || window.innerWidth, h: window.screen?.height || window.innerHeight },
    language: navigator.language || 'en-US',
  };
}

function PairDeviceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareIdParam = searchParams.get('shareId') || searchParams.get('code') || '';
  const codeParam = searchParams.get('code') || '';
  const walletParam = searchParams.get('w') || '';
  const nameParam = searchParams.get('n') || '';
  const autoApproveParam = searchParams.get('a') === '1';

  const { pubkey, setPubkey, setHasWallet, setHasPasskey, setWalletName } = useWalletStore();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedSuccess, setLinkedSuccess] = useState(false);

  const apiBase = '';

  const applyLinkedWallet = (walletAddress: string, walletName?: string) => {
    localStorage.removeItem('lazorkit-explicit-logout');
    localStorage.setItem('lazorkit-paired-wallet', walletAddress);
    setHasPasskey(true);
    setHasWallet(true);
    setPubkey(walletAddress);
    if (walletName) {
      setWalletName(walletName);
    }
    setLinkedSuccess(true);
    toast({
      title: 'Device Linked Successfully',
      description: `Connected to wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    });
    setTimeout(() => {
      router.push('/');
    }, 1200);
  };

  useEffect(() => {
    if (!shareIdParam) {
      setError('Missing pairing code or session ID in URL.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/device-import/status/${encodeURIComponent(shareIdParam)}`);
        if (!resp.ok) {
          // Fallback to URL-embedded wallet parameters if scanned across separate networks
          if (walletParam && !cancelled) {
            setSession({
              shareId: shareIdParam,
              pairingCode: codeParam,
              mode: 'sync_from_owner',
              autoApprove: autoApproveParam,
              status: 'pending',
              walletAddress: walletParam,
              walletName: nameParam || 'RampFi Passkey Vault',
            });
            setLoading(false);
            return;
          }
          const errData = await resp.json().catch(() => ({}));
          if (!cancelled) {
            setError(errData.error || 'Pairing session not found or expired.');
            setLoading(false);
          }
          return;
        }
        const data = await resp.json();
        if (!cancelled) {
          setSession(data);
          setLoading(false);

          // If this is a sync_from_owner session and already approved after we claimed it
          if (data.mode === 'sync_from_owner' && data.status === 'approved' && data.walletAddress && submitting) {
            applyLinkedWallet(data.walletAddress, data.walletName);
          }
        }
      } catch (e) {
        if (walletParam && !cancelled) {
          setSession({
            shareId: shareIdParam,
            pairingCode: codeParam,
            mode: 'sync_from_owner',
            autoApprove: autoApproveParam,
            status: 'pending',
            walletAddress: walletParam,
            walletName: nameParam || 'RampFi Passkey Vault',
          });
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setError('Unable to reach pairing server. Please check your connection.');
          setLoading(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareIdParam, apiBase, submitting]);

  // Claim a 'sync_from_owner' QR code on this device
  const handleClaimSync = async () => {
    if (!session?.shareId || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const resp = await fetch(`${apiBase}/api/device-import/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: typeof window !== 'undefined' ? window.location.href : session.shareId,
          deviceMetadata: getLocalDeviceMetadata(),
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (walletParam) {
          applyLinkedWallet(walletParam, nameParam || 'RampFi Passkey Vault');
          return;
        }
        throw new Error(data.error || 'Failed to pair device');
      }

      if (data.status === 'approved' && data.walletAddress) {
        applyLinkedWallet(data.walletAddress, data.walletName);
      } else {
        setSession((prev: any) => ({ ...prev, status: data.status }));
      }
    } catch (e: any) {
      if (walletParam) {
        applyLinkedWallet(walletParam, nameParam || 'RampFi Passkey Vault');
        return;
      }
      setError(e?.message || 'Failed to claim sync session');
      setSubmitting(false);
    }
  };

  // Approve a 'request_from_new_device' QR code when scanned by an already logged-in owner phone
  const handleOwnerDecision = async (approved: boolean) => {
    if (!session?.shareId || !pubkey) return;
    setSubmitting(true);
    setError(null);

    try {
      // First attach owner wallet if not attached yet
      await fetch(`${apiBase}/api/device-import/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: session.shareId,
          walletAddress: pubkey,
          ownerDeviceId: getLocalDeviceMetadata().deviceId,
        }),
      });

      const resp = await fetch(`${apiBase}/api/device-import/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId: session.shareId,
          approved,
          walletAddress: pubkey,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to update device request');
      }

      toast({
        title: approved ? 'Device Approved' : 'Device Rejected',
        description: approved
          ? 'The new device is now connected to your wallet.'
          : 'The connection request was rejected.',
      });
      router.push('/');
    } catch (e: any) {
      setError(e?.message || 'Failed to process approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#06080f] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#090d16]/95 backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.85)] p-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white">RampFi Device Sync</h1>
              <p className="text-[11px] text-muted-foreground font-mono">
                {session?.pairingCode ? `Code: ${session.pairingCode}` : 'Multi-Device Vault Pairing'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-mono font-bold text-primary uppercase">
            Devnet
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">Verifying pairing session...</p>
          </div>
        ) : error ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-rose-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Pairing Unavailable</h3>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button
              onClick={() => router.push('/')}
              className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
            >
              Return to RampFi
            </Button>
          </div>
        ) : linkedSuccess ? (
          <div className="py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">Wallet Linked Successfully!</h3>
              <p className="text-xs text-muted-foreground">Redirecting to your RampFi Dashboard...</p>
            </div>
          </div>
        ) : session?.mode === 'sync_from_owner' && session?.walletAddress ? (
          /* FLOW A: QR was generated in DevicesTab by the Wallet Owner; this device is claiming/importing the wallet */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shrink-0">
                <Blockie seed={session.walletAddress} size={8} scale={6} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Target Smart Wallet
                </span>
                <h3 className="text-sm font-extrabold text-white truncate">
                  {session.walletName || 'RampFi Passkey Vault'}
                </h3>
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {session.walletAddress.slice(0, 8)}...{session.walletAddress.slice(-8)}
                </p>
              </div>
            </div>

            {session.status === 'awaiting_approval' ? (
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-3">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                    Waiting for Owner Confirmation
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Please tap <strong className="text-white">Approve</strong> on the popup displayed on your primary device to complete linking.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sync Direction</span>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5 text-primary" /> Primary Vault → This Device
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Access Mode</span>
                    <span className="font-mono font-bold text-emerald-400">Instant Sync</span>
                  </div>
                </div>

                <Button
                  onClick={handleClaimSync}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-primary text-slate-950 hover:bg-primary/90 font-extrabold text-xs shadow-[0_10px_28px_rgba(22,255,187,0.25)] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Linking Device...
                    </>
                  ) : (
                    <>
                      Link This Device to Wallet
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* FLOW B: QR was generated by a New Device in ConnectWalletModal; Owner device scanned it to approve */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">New Device Requesting Access</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {session?.newDeviceData?.platform || 'Device'} • {session?.newDeviceData?.browser || 'Browser'} ({session?.newDeviceData?.os || 'OS'})
                  </p>
                </div>
              </div>
            </div>

            {pubkey ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Approve to connect this device to your active wallet{' '}
                  <span className="font-mono font-bold text-white">
                    {pubkey.slice(0, 6)}...{pubkey.slice(-4)}
                  </span>
                  .
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleOwnerDecision(false)}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                  >
                    <XCircle className="h-4 w-4 mr-1.5 text-rose-400" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleOwnerDecision(true)}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl bg-primary text-slate-950 hover:bg-primary/90 font-extrabold text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {submitting ? 'Approving...' : 'Approve Device'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3 text-center">
                <KeyRound className="h-6 w-6 text-amber-400 mx-auto" />
                <p className="text-xs text-amber-200 leading-relaxed">
                  This QR code was generated by a logged-out device waiting to be approved. Please scan it from a device where your wallet is already logged in, or generate a Sync QR from your logged-in device&apos;s <strong>Devices</strong> tab.
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full h-10 rounded-xl bg-primary text-slate-950 font-extrabold text-xs"
                >
                  Go to Home
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PairDevicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#06080f] flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <PairDeviceContent />
    </Suspense>
  );
}
