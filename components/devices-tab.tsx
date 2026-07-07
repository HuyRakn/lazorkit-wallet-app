'use client';

import { useState, useEffect, useRef } from 'react';
import { Smartphone, QrCode, Monitor, Tablet, ShieldCheck, KeyRound, Loader2, RefreshCw, AlertCircle, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { QRScannerModal } from './qr-scanner-modal';
import { DeviceApprovalModal } from './device-approval-modal';
import { useWalletStore } from '@/lib/store/wallet';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export const DevicesTab = () => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingDevice, setPendingDevice] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [pendingDevices, setPendingDevices] = useState([]);

  // Real Sync QR Code generation states
  const [qrCodeURL, setQrCodeURL] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'waiting' | 'approved' | 'rejected' | 'expired'>('idle');

  const { pubkey } = useWalletStore();
  const { toast } = useToast();
  
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load active devices
  useEffect(() => {
    if (pubkey) {
      loadConnectedDevices();
      loadPendingDevices();
    }
    return () => {
      stopPolling();
    };
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

  // Generate QR for another device to scan and import this wallet
  const generatePairingQR = async () => {
    if (!pubkey || isGenerating) return;
    setIsGenerating(true);
    setPairingStatus('idle');
    setQrCodeURL(null);
    setShareId(null);
    stopPolling();

    try {
      const resp = await fetch(`${apiBase}/api/device-import/generate-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passkeyData: {
            smartWalletAddress: pubkey,
            publicKey: pubkey
          },
          deviceMetadata: {
            deviceId: `device_${Date.now()}`,
            userAgent: navigator.userAgent,
            platform: navigator.platform || 'Browser',
            language: navigator.language,
            screen: { width: window.innerWidth, height: window.innerHeight }
          }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        setQrCodeURL(data.qrCode);
        setShareId(data.shareId);
        setPairingStatus('waiting');
        
        // Start polling status
        startPolling(data.shareId);
      } else {
        toast({
          title: 'Generation failed',
          description: 'Failed to generate sync QR code. Please try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Generate sync QR error:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to pairing service.',
        variant: 'destructive'
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
          if (data.status === 'approved') {
            setPairingStatus('approved');
            setQrCodeURL(null);
            setShareId(null);
            stopPolling();
            toast({
              title: 'Device Linked Successfully',
              description: 'The new device has been connected to your MPC wallet.'
            });
            loadConnectedDevices();
            loadPendingDevices();
          } else if (data.status === 'rejected') {
            setPairingStatus('rejected');
            setQrCodeURL(null);
            setShareId(null);
            stopPolling();
            toast({
              title: 'Device Pairing Rejected',
              description: 'The syncing request was rejected by the scanning device.',
              variant: 'destructive'
            });
          } else if (data.status === 'expired') {
            setPairingStatus('expired');
            setQrCodeURL(null);
            setShareId(null);
            stopPolling();
          }
        }
      } catch (error) {
        console.error('Polling device status error:', error);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleQRScanned = async (qrData: string) => {
    if (!pubkey || !qrData || typeof qrData !== 'string') return;

    try {
      const resp = await fetch(`${apiBase}/api/device-import/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData,
          walletAddress: pubkey,
          ownerDeviceId: `device_${Date.now()}`
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        setPendingDevice({
          ...data.deviceShare.newDeviceData,
          shareId: data.deviceShare.shareId
        });
        setShowQRScanner(false);
        setShowApprovalModal(true);
      } else {
        const error = await resp.json();
        toast({
          title: 'Pairing failed',
          description: error.error || 'Failed to process QR code',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('QR scan processing failed:', error);
    }
  };

  const handleApprove = async (shareId: string) => {
    try {
      const resp = await fetch(`${apiBase}/api/device-import/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, approved: true })
      });

      if (resp.ok) {
        toast({ title: 'Device approved', description: 'The device has been connected.' });
        await loadPendingDevices();
        await loadConnectedDevices();
      }
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const handleReject = async (shareId: string) => {
    try {
      const resp = await fetch(`${apiBase}/api/device-import/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, approved: false })
      });

      if (resp.ok) {
        toast({ title: 'Device rejected', description: 'The device request has been rejected.' });
        await loadPendingDevices();
      }
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!shareId) return;
    try {
      const resp = await fetch(`${apiBase}/api/device-import/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId })
      });

      if (resp.ok) {
        toast({
          title: 'Device Revoked',
          description: 'The key share has been deleted from the database.',
        });
        await loadConnectedDevices();
        await loadPendingDevices();
      } else {
        toast({
          title: 'Revocation failed',
          description: 'Failed to revoke device access.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Revocation error:', err);
      toast({
        title: 'Error',
        description: 'Failed to connect to security service.',
        variant: 'destructive'
      });
    }
  };

  const unifiedRows = [
    ...connectedDevices.map((d: any) => ({
      id: d._id || d.shareId || Math.random().toString(36).slice(2),
      shareId: d.shareId,
      platform: d.newDeviceData?.platform || 'Web Browser',
      browser: d.newDeviceData?.browser || 'Chrome',
      os: d.newDeviceData?.os || 'macOS',
      date: d.approvedAt ? new Date(d.approvedAt) : new Date(),
      status: 'Connected' as const,
    })),
    ...pendingDevices.map((d: any) => ({
      id: d._id || d.shareId || Math.random().toString(36).slice(2),
      shareId: d.shareId,
      platform: d.platform || 'Mobile device',
      browser: d.browser || 'Safari',
      os: d.os || 'iOS',
      date: new Date(d.createdAt),
      status: 'Pending approval' as const,
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
                <h3 className="text-sm font-bold text-white">Passkey Vault</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {pubkey.slice(0, 6)}...{pubkey.slice(-6)}
                  </span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
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
              <span className="text-[10px] font-bold text-primary">
                {Math.min(100, Math.max(33, (connectedDevices.length > 0 ? 66 : 33) + (connectedDevices.length >= 2 ? 34 : 0)))}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(33, (connectedDevices.length > 0 ? 66 : 33) + (connectedDevices.length >= 2 ? 34 : 0)))}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
            <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Passkey Active</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${connectedDevices.length > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                <span>Multi-Device: {connectedDevices.length > 0 ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${connectedDevices.length >= 2 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                <span>Backup: {connectedDevices.length >= 2 ? 'Active' : 'Not Set'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-wide">Passkey Vault Security</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage hardware devices authorized to sign transactions for your multi-party computation (MPC) smart account.
        </p>
      </div>

      {/* Symmetric Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        
        {/* LEFT COLUMN: Authorized Devices & Incoming Requests */}
        <div className="space-y-6 flex flex-col justify-start">
          
          {/* Active Device List Card */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col">
            <div className="p-5 border-b border-border/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                Active Vault Keys
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Devices permitted to initialize signatures.
              </p>
            </div>
            <div className="p-0 divide-y divide-border/10 flex-1 overflow-y-auto">
              {unifiedRows.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center text-muted-foreground">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Single Key Active</h4>
                    <p className="text-[11px] text-muted-foreground max-w-[280px] mt-1 mx-auto leading-relaxed">
                      Only this browser contains the private key share. Pair a smartphone to setup an off-device backup.
                    </p>
                  </div>
                </div>
              ) : (
                unifiedRows.map((row: any) => (
                  <div key={row.id} className="flex items-center justify-between p-4 hover:bg-white/[0.01] transition-all">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shadow-md">
                        {row.platform.toLowerCase().includes('phone') ? (
                          <Smartphone className="h-4.5 w-4.5 text-primary" />
                        ) : row.platform.toLowerCase().includes('tablet') ? (
                          <Tablet className="h-4.5 w-4.5 text-primary" />
                        ) : (
                          <Monitor className="h-4.5 w-4.5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{row.platform}</p>
                        <p className="text-[10px] text-muted-foreground">{row.browser} ({row.os})</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          row.status === 'Connected'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${row.status === 'Connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                          {row.status}
                        </span>
                        <p className="text-[9px] text-muted-foreground/80 mt-1">{row.date ? row.date.toLocaleDateString() : ''}</p>
                      </div>

                      {row.status === 'Connected' && row.shareId && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (confirm('Are you absolutely sure you want to revoke this device\'s signing key?')) {
                              handleRevoke(row.shareId);
                            }
                          }}
                          className="px-3 py-1.5 text-[10px] font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 rounded-lg shadow-sm hover:shadow-red-500/20 transition-colors duration-200 cursor-pointer"
                        >
                          Revoke Access
                        </motion.button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Pairing Portal (Scan Phone QR / Display Laptop Sync QR) */}
        <div className="space-y-6 flex flex-col justify-start">
          
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col justify-between">
            <div className="p-5 border-b border-border/10 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="h-4.5 w-4.5 text-primary" />
                Pairing Portal
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Authorize a new device using secure QR codes.
              </p>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between gap-6">
              
              {/* Option A: Device Camera Scan */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-border/10">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    Scan Phone QR
                  </h4>
                  <p className="text-[10px] text-muted-foreground max-w-[320px] leading-normal">
                    Use this computer's camera to scan a setup QR code generated on your second device.
                  </p>
                </div>
                <Button
                  onClick={() => setShowQRScanner(true)}
                  className="bg-primary hover:bg-primary/95 text-white font-extrabold text-xs px-4 py-2 rounded-xl shrink-0 w-full md:w-auto transition-all"
                >
                  Open Scanner
                </Button>
              </div>

              {/* Option B: Display pairing QR code on screen */}
              <div className="flex flex-col items-center justify-center gap-4 flex-1 py-4">
                {qrCodeURL ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-black rounded-xl border border-white/10 shadow-lg">
                      <img src={qrCodeURL} alt="Sync QR" className="w-40 h-40 object-contain rounded" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-primary font-bold">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Waiting for phone scan...</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-6">
                    <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center text-muted-foreground mx-auto">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Display Laptop Sync QR</h4>
                      <p className="text-[10px] text-muted-foreground max-w-[260px] mx-auto leading-normal">
                        Show a temporary pairing code on this screen. Open RampFi on your phone to scan it.
                      </p>
                    </div>
                    <Button
                      onClick={generatePairingQR}
                      disabled={isGenerating}
                      className="bg-card/50 hover:bg-card text-white border border-border/40 hover:border-primary/45 font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Sync QR'}
                    </Button>
                  </div>
                )}

                {pairingStatus === 'expired' && (
                  <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>QR expired. Please generate a new code.</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>

      <QRScannerModal
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onQRScanned={handleQRScanned}
      />

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
