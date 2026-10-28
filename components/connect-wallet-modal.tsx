'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { Shield, QrCode, KeyRound, Copy, Loader2, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import QrScannerLib from 'qr-scanner';

interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletModal({ open, onOpenChange }: ConnectWalletModalProps) {
  const [loading, setLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [importTab, setImportTab] = useState<'enter_code' | 'show_qr'>('enter_code');
  const [qrData, setQRData] = useState<any>(null);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [claimingSync, setClaimingSync] = useState(false);
  const [waitingOwnerApproval, setWaitingOwnerApproval] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { setHasPasskey, setHasWallet, setPubkey, setWalletName } = useWalletStore();
  const wallet = useWallet();

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
  const deviceImportBase = '/api/device-import';

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const finalizeWalletImport = (walletAddress: string, walletName?: string) => {
    stopPolling();
    localStorage.removeItem('lazorkit-explicit-logout');
    localStorage.setItem('lazorkit-paired-wallet', walletAddress);
    localStorage.removeItem('device-import-shareId');

    setShowQRModal(false);
    onOpenChange(false);

    setHasPasskey?.(true);
    setHasWallet?.(true);
    setPubkey?.(walletAddress);
    if (walletName) {
      setWalletName?.(walletName);
    }

    toast({
      title: 'Wallet Imported Successfully',
      description: `Connected to ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    });
  };

  const getDeviceMetadata = () => ({
    deviceId: `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    screen: {
      w: typeof window !== 'undefined' ? window.screen.width : 1920,
      h: typeof window !== 'undefined' ? window.screen.height : 1080,
    },
    language: typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US',
  });

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!wallet?.connectPasskey) {
        throw new Error('Passkey login not available');
      }
      const passkeyData = await wallet.connectPasskey();
      if (!passkeyData) throw new Error('Failed to login with passkey');

      localStorage.removeItem('lazorkit-explicit-logout');
      localStorage.removeItem('lazorkit-paired-wallet');

      setHasPasskey?.(true);

      const addr = passkeyData.smartWalletAddress;
      if (!addr) throw new Error('No wallet address returned');

      fetch(`${apiBase}/api/orders/create-smart-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkeyData }),
      }).catch((err) => console.warn('Wallet registration skipped:', err));

      onOpenChange(false);
      setHasWallet?.(true);
      setPubkey?.(addr);
    } catch (e: any) {
      console.error('Login failed:', e);
      toast({
        title: 'Passkey Login Failed',
        description: e?.message || 'Could not authenticate passkey',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate QR for this new device WITHOUT requiring connectPasskey() first
  const generateNewDeviceQR = async () => {
    setLoading(true);
    setImportError(null);
    stopPolling();

    try {
      const deviceMetadata = getDeviceMetadata();
      const resp = await fetch(`${deviceImportBase}/generate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'request_from_new_device',
          frontendOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
          deviceMetadata,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to generate pairing QR code');
      }
      const data = await resp.json();
      localStorage.setItem('device-import-shareId', data.shareId);
      setQRData(data);
      startPolling(data.shareId);
    } catch (e: any) {
      console.error('Import QR generation failed:', e);
      setImportError(e?.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImportModal = () => {
    setImportError(null);
    setWaitingOwnerApproval(false);
    setSyncCodeInput('');
    setShowQRModal(true);
    setImportTab('enter_code');
  };

  const handleSwitchToShowQR = () => {
    setImportTab('show_qr');
    if (!qrData) {
      generateNewDeviceQR();
    }
  };

  // Claim a Sync QR or 6-Digit Code generated from DevicesTab on the logged-in device
  const handleClaimOwnerSyncCode = async (codeOrPayload: string) => {
    const cleaned = codeOrPayload.trim();
    if (!cleaned || claimingSync) return;

    setClaimingSync(true);
    setImportError(null);
    stopPolling();

    try {
      const resp = await fetch(`${deviceImportBase}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: cleaned,
          deviceMetadata: getDeviceMetadata(),
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Invalid or expired pairing code');
      }

      if (data.status === 'approved' && data.walletAddress) {
        finalizeWalletImport(data.walletAddress, data.walletName);
      } else if (data.deviceShare?.shareId) {
        setWaitingOwnerApproval(true);
        startPolling(data.deviceShare.shareId);
      }
    } catch (e: any) {
      setImportError(e?.message || 'Could not link with pairing code');
    } finally {
      setClaimingSync(false);
    }
  };

  const handleUploadSyncQRImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setClaimingSync(true);

    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const dataUrl = ev.target?.result as string;
          const result = await QrScannerLib.scanImage(dataUrl, { returnDetailedScanResult: true });
          const text = typeof result === 'string' ? result : (result as any)?.data;
          if (text) {
            await handleClaimOwnerSyncCode(text);
          } else {
            setImportError('No QR code detected in the uploaded image.');
          }
        } catch {
          setImportError('Could not decode QR image. Try entering the 6-digit code instead.');
        } finally {
          setClaimingSync(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setImportError('Failed to read image file.');
      setClaimingSync(false);
    }
  };

  const startPolling = (sid: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${deviceImportBase}/status/${encodeURIComponent(sid)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'approved' && data.walletAddress) {
            finalizeWalletImport(data.walletAddress, data.walletName);
          } else if (data.status === 'rejected' || data.status === 'expired') {
            stopPolling();
            setWaitingOwnerApproval(false);
            setImportError(
              data.status === 'rejected'
                ? 'Connection request was rejected by the wallet owner.'
                : 'Pairing session expired. Please generate a new code.'
            );
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1800);
  };

  return (
    <>
      <Dialog open={open && !showQRModal} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border border-white/[0.08] bg-[#07080a]/95 backdrop-blur-2xl max-w-sm w-full p-6 text-center rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <DialogHeader className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#16ffbb]/10 border border-[#16ffbb]/20 flex items-center justify-center shadow-lg shadow-[#16ffbb]/5 p-2 bg-[#07080a]">
              <img src="/logo.png" alt="RampFi Logo" className="w-full h-full object-contain" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Connect to Ramp<span className="text-[#16ffbb]">Fi</span>
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground max-w-[280px]">
              Access your Solana devnet wallet gaslessly using secure biometric passkeys or multi-device QR sync.
            </p>

            {/* Features Highlight list */}
            <div className="w-full py-3.5 px-3 space-y-3.5 text-left bg-white/[0.02] border border-white/[0.05] rounded-2xl mt-4">
              <div className="flex items-start gap-2.5">
                <div className="w-5.5 h-5.5 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 shrink-0">
                  <Shield className="h-3 w-3 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Biometric Passkey</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Secure hardware authentication using FaceID or TouchID.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5.5 h-5.5 rounded-full bg-[#16ffbb]/10 flex items-center justify-center mt-0.5 shrink-0">
                  <span className="text-[10px] font-black text-[#16ffbb]">$</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Sponsored Gasless Trading</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Zero network gas fees on all swaps and transfers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5.5 h-5.5 rounded-full bg-sky-500/10 flex items-center justify-center mt-0.5 shrink-0">
                  <QrCode className="h-3 w-3 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Instant Multi-Device Sync</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Pair your phone or second browser via QR or 6-digit code.
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            <Button
              className="w-full h-11 bg-[#16ffbb] text-black hover:bg-[#16ffbb]/90 font-bold rounded-xl transition flex items-center justify-center gap-2 button-press shadow-[0_0_20px_rgba(22,255,187,0.2)] hover:shadow-[0_0_30px_rgba(22,255,187,0.35)]"
              onClick={handleLogin}
              disabled={loading}
            >
              <Shield className="h-4 w-4" />
              {loading ? 'Connecting...' : 'Connect with Passkey'}
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 border-white/20 hover:border-white/40 text-white hover:bg-white/[0.04] bg-white/[0.01] font-semibold rounded-xl transition flex items-center justify-center gap-2 button-press"
              onClick={handleOpenImportModal}
              disabled={loading}
            >
              <QrCode className="h-4 w-4 text-primary" />
              Import Existing Wallet (QR / Code)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Device Pairing / Import Modal */}
      <Dialog
        open={open && showQRModal}
        onOpenChange={(v) => {
          if (!v) {
            setShowQRModal(false);
            stopPolling();
          }
        }}
      >
        <DialogContent className="glass-card border border-white/[0.12] bg-[#090d16]/95 backdrop-blur-2xl max-w-md w-full p-6 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowQRModal(false);
                  stopPolling();
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <DialogTitle className="text-base font-extrabold text-white">Link Existing Wallet</DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pl-8">
              Pair with a logged-in device using a 6-digit sync code or QR code.
            </p>
          </DialogHeader>

          {/* 2-Tab Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/10 mt-3">
            <button
              type="button"
              onClick={() => {
                setImportError(null);
                setImportTab('enter_code');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                importTab === 'enter_code'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Enter Sync Code
            </button>
            <button
              type="button"
              onClick={handleSwitchToShowQR}
              className={`py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                importTab === 'show_qr'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              Show This Device QR
            </button>
          </div>

          {importTab === 'enter_code' ? (
            <div className="space-y-4 pt-3">
              {waitingOwnerApproval ? (
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 text-center space-y-3">
                  <Loader2 className="h-7 w-7 text-primary animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Waiting for Primary Device Approval
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Click <strong className="text-white">Approve Device</strong> on the popup shown on your logged-in device.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-white block">
                        1. Enter 6-Digit Code from Logged-In Device
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        On your logged-in device, open <strong>Devices → Generate Sync QR</strong> and enter the 6-digit code below:
                      </p>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleClaimOwnerSyncCode(syncCodeInput);
                      }}
                      className="space-y-2.5"
                    >
                      <Input
                        value={syncCodeInput}
                        onChange={(e) => setSyncCodeInput(e.target.value)}
                        placeholder="e.g. 482910 or paste sync link"
                        className="h-11 bg-black/50 border-white/15 font-mono text-center text-base tracking-widest text-primary font-extrabold"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        disabled={!syncCodeInput.trim() || claimingSync}
                        className="w-full h-11 bg-primary text-slate-950 hover:bg-primary/90 font-extrabold text-xs rounded-xl"
                      >
                        {claimingSync ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Linking Wallet...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            Link Wallet with Code
                          </>
                        )}
                      </Button>
                    </form>
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-white/10 w-full" />
                    <span className="bg-[#090d16] px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      OR
                    </span>
                    <div className="border-t border-white/10 w-full" />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                    <div>
                      <span className="text-xs font-bold text-white block">Upload Sync QR Image</span>
                      <span className="text-[10px] text-muted-foreground">
                        Upload the QR image downloaded from your logged-in device
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadSyncQRImage}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={claimingSync}
                      className="border-white/15 text-white hover:bg-white/10 text-xs font-bold rounded-xl shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      Upload QR
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="my-3 flex flex-col items-center justify-center space-y-3">
              {loading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="h-7 w-7 text-primary animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground font-mono">Generating pairing QR...</p>
                </div>
              ) : qrData ? (
                <>
                  <div className="p-3 bg-white rounded-2xl border-2 border-primary/40 shadow-xl">
                    <img src={qrData.qrCode} alt="Import QR" className="w-44 h-44 object-contain" />
                  </div>

                  {qrData.pairingCode && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Or enter this 6-digit code on your logged-in device
                      </span>
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/25">
                        <span className="font-mono text-lg font-black tracking-[0.25em] text-primary">
                          {qrData.pairingCode.slice(0, 3)} {qrData.pairingCode.slice(3)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(qrData.pairingCode);
                            toast({ title: 'Code Copied', description: `Code ${qrData.pairingCode} copied.` });
                          }}
                          className="p-1 rounded-md hover:bg-white/10 text-primary"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                    On your logged-in device, open <strong>Devices → Pairing Portal</strong> and scan this QR or type the 6-digit code.
                  </p>
                </>
              ) : null}
            </div>
          )}

          {importError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center font-medium">
              {importError}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
