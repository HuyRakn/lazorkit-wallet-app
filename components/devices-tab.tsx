'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  QrCode,
  Monitor,
  Tablet,
  ShieldCheck,
  KeyRound,
  Loader2,
  AlertCircle,
  Camera,
  Copy,
  Download,
  Check,
  XCircle,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { QRScannerModal } from './qr-scanner-modal';
import { DeviceApprovalModal } from './device-approval-modal';
import { useWalletStore } from '@/lib/store/wallet';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { OnchainAccessCard } from './onchain-access-card';

export const DevicesTab = () => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingDevice, setPendingDevice] = useState<any>(null);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);
  const [pendingDevices, setPendingDevices] = useState<any[]>([]);

  // Real Sync QR Code generation states
  const [qrCodeURL, setQrCodeURL] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [autoApproveSync, setAutoApproveSync] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'waiting' | 'approved' | 'rejected' | 'expired'>('idle');
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const { pubkey, walletName, setPubkey, setHasWallet, setHasPasskey, setWalletName } = useWalletStore();
  const { toast } = useToast();

  const apiBase = '';
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const promptedApprovalRef = useRef<string | null>(null);

  useEffect(() => {
    if (pubkey) {
      loadConnectedDevices();
      loadPendingDevices();
    }
    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const loadPendingDevices = async () => {
    if (!pubkey) return;
    try {
      const resp = await fetch(`${apiBase}/api/device-import/pending/${pubkey}`);
      if (resp.ok) {
        const data = await resp.json();
        setPendingDevices(data.pendingShares || []);
      } else {
        setPendingDevices([]);
      }
    } catch (error) {
      console.error('Failed to load pending devices:', error);
    }
  };

  const loadConnectedDevices = async () => {
    if (!pubkey) return;
    try {
      const resp = await fetch(`${apiBase}/api/device-import/connected/${pubkey}`);
      if (resp.ok) {
        const data = await resp.json();
        setConnectedDevices(data.connectedDevices || []);
      } else {
        setConnectedDevices([]);
      }
    } catch (error) {
      console.error('Failed to load connected devices:', error);
    }
  };

  // Generate QR for another device (phone / tablet / second browser) to scan and import this wallet
  const generatePairingQR = async () => {
    if (!pubkey || isGenerating) return;
    setIsGenerating(true);
    setPairingStatus('idle');
    setQrCodeURL(null);
    setShareId(null);
    setPairingCode(null);
    setPairingUrl(null);
    promptedApprovalRef.current = null;
    stopPolling();

    try {
      const resp = await fetch(`${apiBase}/api/device-import/generate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sync_from_owner',
          walletAddress: pubkey,
          walletName: walletName || 'RampFi Passkey Vault',
          autoApprove: autoApproveSync,
          frontendOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
          passkeyData: {
            smartWalletAddress: pubkey,
            publicKey: pubkey,
          },
          deviceMetadata: {
            deviceId: `owner_${Date.now()}`,
            userAgent: navigator.userAgent,
            platform: navigator.platform || 'Browser',
            language: navigator.language,
            screen: { w: window.screen?.width || window.innerWidth, h: window.screen?.height || window.innerHeight },
          },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setQrCodeURL(data.qrCode);
        setShareId(data.shareId);
        setPairingCode(data.pairingCode || null);
        setPairingUrl(data.pairingUrl || null);
        setPairingStatus('waiting');
        startPolling(data.shareId);
      } else {
        toast({
          title: 'Generation failed',
          description: 'Failed to generate sync QR code. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Generate sync QR error:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to pairing service.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const startPolling = (sid: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${apiBase}/api/device-import/status/${sid}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'awaiting_approval') {
            loadPendingDevices();
            if (promptedApprovalRef.current !== sid) {
              promptedApprovalRef.current = sid;
              setPendingDevice({
                ...(data.newDeviceData || {}),
                shareId: data.shareId,
                pairingCode: data.pairingCode,
              });
              setShowApprovalModal(true);
            }
          } else if (data.status === 'approved') {
            setPairingStatus('approved');
            setQrCodeURL(null);
            setShareId(null);
            setPairingCode(null);
            setPairingUrl(null);
            stopPolling();
            toast({
              title: 'Device Linked Successfully',
              description: 'The secondary device is now connected to your wallet.',
            });
            loadConnectedDevices();
            loadPendingDevices();
          } else if (data.status === 'rejected') {
            setPairingStatus('rejected');
            setQrCodeURL(null);
            setShareId(null);
            setPairingCode(null);
            setPairingUrl(null);
            stopPolling();
            toast({
              title: 'Device Pairing Rejected',
              description: 'The syncing request was rejected.',
              variant: 'destructive',
            });
          } else if (data.status === 'expired') {
            setPairingStatus('expired');
            setQrCodeURL(null);
            setShareId(null);
            setPairingCode(null);
            setPairingUrl(null);
            stopPolling();
          }
        }
      } catch (error) {
        console.error('Polling device status error:', error);
      }
    }, 1800);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleQRScanned = async (qrData: string) => {
    if (!qrData || typeof qrData !== 'string') return;
    setIsVerifyingCode(true);

    try {
      const resp = await fetch(`${apiBase}/api/device-import/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: qrData.trim(),
          walletAddress: pubkey,
          ownerDeviceId: `owner_${Date.now()}`,
          deviceMetadata: {
            deviceId: `dev_${Date.now()}`,
            userAgent: navigator.userAgent,
            platform: navigator.platform || 'Browser',
            language: navigator.language,
            screen: { w: window.screen?.width || window.innerWidth, h: window.screen?.height || window.innerHeight },
          },
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setQuickCodeInput('');
        setShowQRScanner(false);

        // If the scanned QR was a sync_from_owner QR and auto-approved, update wallet or refresh list
        if (data.mode === 'sync_from_owner' && data.status === 'approved' && data.walletAddress) {
          if (data.walletAddress !== pubkey) {
            localStorage.removeItem('lazorkit-explicit-logout');
            localStorage.setItem('lazorkit-paired-wallet', data.walletAddress);
            setHasPasskey(true);
            setHasWallet(true);
            setPubkey(data.walletAddress);
            if (data.walletName) setWalletName(data.walletName);
          }
          await loadConnectedDevices();
          await loadPendingDevices();
          toast({
            title: 'Device Linked Successfully',
            description: `Paired with wallet ${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}`,
          });
          return;
        }

        // Otherwise show the approval modal for owner confirmation
        setPendingDevice({
          ...(data.deviceShare?.newDeviceData || {}),
          shareId: data.deviceShare?.shareId,
          pairingCode: data.deviceShare?.pairingCode,
        });
        setShowApprovalModal(true);
        await loadPendingDevices();
      } else {
        toast({
          title: 'Pairing failed',
          description: data.error || 'Invalid or expired QR / pairing code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('QR scan processing failed:', error);
      toast({
        title: 'Connection error',
        description: 'Could not reach pairing service.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleApprove = async (sid: string) => {
    try {
      const resp = await fetch(`${apiBase}/api/device-import/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: sid, approved: true, walletAddress: pubkey }),
      });

      if (resp.ok) {
        toast({ title: 'Device Approved', description: 'The device is now connected to your wallet.' });
        await loadPendingDevices();
        await loadConnectedDevices();
      }
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const handleReject = async (sid: string) => {
    try {
      const resp = await fetch(`${apiBase}/api/device-import/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: sid, approved: false }),
      });

      if (resp.ok) {
        toast({ title: 'Device Rejected', description: 'The pairing request was rejected.' });
        await loadPendingDevices();
      }
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  };

  const handleRevoke = async (sid: string) => {
    if (!sid) return;
    try {
      const resp = await fetch(`${apiBase}/api/device-import/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: sid }),
      });

      if (resp.ok) {
        toast({
          title: 'Device Revoked',
          description: 'The device access has been removed.',
        });
        await loadConnectedDevices();
        await loadPendingDevices();
      } else {
        toast({
          title: 'Revocation failed',
          description: 'Failed to revoke device access.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Revocation error:', err);
    }
  };

  const handleDownloadActiveQR = () => {
    if (!qrCodeURL) return;
    const link = document.createElement('a');
    link.download = `rampfi-sync-${pairingCode || 'qr'}.png`;
    link.href = qrCodeURL;
    link.click();
    toast({ title: 'QR Image Downloaded', description: 'You can scan or upload this QR image on your other device.' });
  };

  const unifiedRows = [
    ...pendingDevices.map((d: any) => ({
      id: d._id || d.shareId || Math.random().toString(36).slice(2),
      shareId: d.shareId,
      pairingCode: d.pairingCode,
      platform: d.newDeviceData?.platform || d.platform || 'Mobile Phone',
      browser: d.newDeviceData?.browser || d.browser || 'Safari',
      os: d.newDeviceData?.os || d.os || 'iOS',
      date: d.createdAt ? new Date(d.createdAt) : new Date(),
      status: 'Pending approval' as const,
    })),
    ...connectedDevices.map((d: any) => ({
      id: d._id || d.shareId || Math.random().toString(36).slice(2),
      shareId: d.shareId,
      pairingCode: d.pairingCode,
      platform: d.newDeviceData?.platform || 'Web Browser',
      browser: d.newDeviceData?.browser || 'Chrome',
      os: d.newDeviceData?.os || 'macOS',
      date: d.approvedAt ? new Date(d.approvedAt) : new Date(),
      status: 'Connected' as const,
    })),
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-page-enter">
      {/* Wallet Identity Card */}
      {pubkey && (
        <div className="premium-depth-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{walletName || 'Passkey Vault'}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {pubkey.slice(0, 6)}...{pubkey.slice(-6)}
                  </span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    SECP256R1
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-bold text-primary">DEVNET</span>
            </div>
          </div>

          {/* Security Score */}
          <div className="space-y-2 pt-2 border-t border-border/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Security Score</span>
              <span className="text-[10px] font-bold text-primary font-mono">
                {Math.min(100, Math.max(50, (connectedDevices.length > 0 ? 80 : 50) + (connectedDevices.length >= 2 ? 20 : 0)))}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, Math.max(50, (connectedDevices.length > 0 ? 80 : 50) + (connectedDevices.length >= 2 ? 20 : 0)))}%`,
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Passkey Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connectedDevices.length > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                <span>Linked Devices: {connectedDevices.length + 1}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connectedDevices.length >= 1 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                <span>Multi-Device Sync: {connectedDevices.length >= 1 ? 'Enabled' : 'Single Device'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-wide">Passkey Vault Security</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage hardware devices and link secondary phones or browsers via instant QR & 6-digit pairing codes.
        </p>
      </div>

      {/* On-chain authorities + Quick Pay sessions (LazorKit program accounts) */}
      <OnchainAccessCard />

      {/* Symmetric Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT COLUMN: Authorized Devices & Incoming Requests */}
        <div className="flex flex-col">
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col border border-white/10">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Active Vault Keys & Devices
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Primary session and linked companion devices.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  loadConnectedDevices();
                  loadPendingDevices();
                }}
                className="h-8 w-8 text-muted-foreground hover:text-white"
                title="Refresh devices"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="divide-y divide-white/5 flex-1 overflow-y-auto">
              {/* Always show This Primary Device at top */}
              <div className="flex items-center justify-between p-4 bg-primary/[0.03]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center">
                    <Monitor className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-xs">This Browser Session</p>
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                        CURRENT
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Primary WebAuthn Enclave • Active Now
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Primary
                </span>
              </div>

              {unifiedRows.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-muted-foreground">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Companion Devices Yet</h4>
                    <p className="text-[11px] text-muted-foreground max-w-[280px] mt-1 mx-auto leading-relaxed">
                      Generate a Sync QR code on the right and scan it with your phone camera (or enter the 6-digit code) to link a second device.
                    </p>
                  </div>
                </div>
              ) : (
                unifiedRows.map((row: any) => (
                  <div key={row.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 bg-white/[0.04] border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                        {String(row.platform).toLowerCase().includes('phone') ||
                        String(row.platform).toLowerCase().includes('mobile') ? (
                          <Smartphone className="h-4 w-4 text-primary" />
                        ) : String(row.platform).toLowerCase().includes('tablet') ? (
                          <Tablet className="h-4 w-4 text-primary" />
                        ) : (
                          <Monitor className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-xs truncate">{row.platform}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {row.browser} ({row.os}) {row.pairingCode ? `• #${row.pairingCode}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {row.status === 'Pending approval' ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(row.shareId)}
                            className="h-7 px-2.5 text-[10px] font-extrabold bg-primary text-slate-950 hover:bg-primary/90 rounded-lg"
                          >
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(row.shareId)}
                            className="h-7 px-2 text-[10px] font-bold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="text-right hidden sm:block">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400" />
                              Linked
                            </span>
                            <p className="text-[9px] text-muted-foreground/80 mt-0.5">
                              {row.date ? row.date.toLocaleDateString() : ''}
                            </p>
                          </div>
                          {row.shareId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevoke(row.shareId)}
                              className="h-7 px-2.5 text-[10px] font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 border-rose-500/30 rounded-lg"
                            >
                              Revoke
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Pairing Portal */}
        <div className="flex flex-col">
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col justify-between border border-white/10">
            <div className="p-5 border-b border-white/10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Pairing Portal
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Sync your wallet to a phone camera or authorize a new device via 6-digit code.
              </p>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between gap-5">
              {/* Option A: Scan QR or Enter 6-Digit Code from another device */}
              <div className="space-y-3 pb-5 border-b border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Camera className="h-3.5 w-3.5 text-primary" />
                      Scan QR or Enter 6-Digit Code
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Have a pairing code or QR from another device? Enter it or open the scanner.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowQRScanner(true)}
                    variant="outline"
                    className="border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-extrabold text-xs h-9 px-3.5 rounded-xl shrink-0"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Open Scanner
                  </Button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (quickCodeInput.trim()) handleQRScanned(quickCodeInput.trim());
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={quickCodeInput}
                    onChange={(e) => setQuickCodeInput(e.target.value)}
                    placeholder="Enter 6-digit pairing code (e.g. 482910)..."
                    className="h-9 bg-black/40 border-white/10 font-mono text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={!quickCodeInput.trim() || isVerifyingCode}
                    className="h-9 px-4 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl shrink-0"
                  >
                    {isVerifyingCode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify Code'}
                  </Button>
                </form>
              </div>

              {/* Option B: Display Sync QR Code & 6-Digit Code on screen */}
              <div className="flex flex-col items-center justify-center gap-4 flex-1 py-2">
                {qrCodeURL ? (
                  <div className="w-full flex flex-col items-center justify-center gap-3.5">
                    <div className="p-3 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.6)] border-2 border-primary/40">
                      <img src={qrCodeURL} alt="Sync QR" className="w-44 h-44 object-contain" />
                    </div>

                    {pairingCode && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          6-Digit Pairing Code
                        </span>
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/25">
                          <span className="font-mono text-lg font-black tracking-[0.25em] text-primary">
                            {pairingCode.slice(0, 3)} {pairingCode.slice(3)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(pairingCode);
                              toast({ title: 'Pairing Code Copied', description: `Code ${pairingCode} copied.` });
                            }}
                            className="p-1 rounded-md hover:bg-white/10 text-primary transition"
                            title="Copy 6-digit code"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {pairingUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(pairingUrl);
                            toast({ title: 'Sync Link Copied', description: 'Open this link on your other device to pair.' });
                          }}
                          className="h-8 text-[11px] font-bold border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl"
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          Copy Sync Link
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadActiveQR}
                        className="h-8 text-[11px] font-bold border-white/15 bg-white/5 hover:bg-white/10 text-white rounded-xl"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        Download QR
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={generatePairingQR}
                        className="h-8 text-[11px] font-bold text-muted-foreground hover:text-white rounded-xl"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        New Code
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-primary font-bold">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scan with phone camera or enter code on your second device...</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-4 w-full max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                      <QrCode className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Generate Sync QR & 6-Digit Code
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Scan with your phone&apos;s camera to open the RampFi pairing link directly, or enter the 6-digit code in <strong>Import Existing Wallet</strong>.
                      </p>
                    </div>

                    {/* Instant Sync Toggle */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-left">
                      <div>
                        <span className="text-[11px] font-bold text-white block">Instant Approve on Scan</span>
                        <span className="text-[10px] text-muted-foreground">
                          {autoApproveSync
                            ? 'Phone links immediately when scanning this QR'
                            : 'Ask for manual confirmation on this screen'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoApproveSync((v) => !v)}
                        className={`w-10 h-5.5 rounded-full transition-colors p-0.5 cursor-pointer ${
                          autoApproveSync ? 'bg-primary' : 'bg-white/15'
                        }`}
                      >
                        <div
                          className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-transform ${
                            autoApproveSync ? 'translate-x-4.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <Button
                      onClick={generatePairingQR}
                      disabled={isGenerating}
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-slate-950 font-extrabold text-xs rounded-xl shadow-[0_10px_28px_rgba(22,255,187,0.2)] transition-all"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Sync QR...
                        </>
                      ) : (
                        <>
                          <QrCode className="h-4 w-4 mr-2" />
                          Generate Sync QR
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {pairingStatus === 'expired' && (
                  <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-bold mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>QR expired. Click Generate Sync QR to create a new one.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <QRScannerModal open={showQRScanner} onOpenChange={setShowQRScanner} onQRScanned={handleQRScanned} />

      <DeviceApprovalModal
        open={showApprovalModal}
        onOpenChange={setShowApprovalModal}
        deviceData={pendingDevice}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};
