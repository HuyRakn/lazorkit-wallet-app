'use client';

import { useState, useRef, useEffect } from 'react';
import QrScannerLib from 'qr-scanner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ViewportModal } from './ui/viewport-modal';
import { Camera, AlertCircle, Upload, Image as ImageIcon, KeyRound, ArrowRight } from 'lucide-react';

interface QRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQRScanned: (data: string) => void;
}

export const QRScannerModal = ({ open, onOpenChange, onQRScanned }: QRScannerModalProps) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'upload' | 'code'>('scan');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const setupScanner = async () => {
      if (!open || activeTab !== 'scan') return;
      try {
        hasScannedRef.current = false;

        const hasCamera = await QrScannerLib.hasCamera();
        if (!hasCamera) {
          setHasPermission(false);
          setError('No camera found on this device. Use Upload File or Enter Code instead.');
          return;
        }

        await navigator.mediaDevices.getUserMedia({ video: true });
        if (!isMounted) return;
        setHasPermission(true);
        setError(null);

        if (videoRef.current) {
          try {
            await scannerRef.current?.stop();
          } catch {}
          scannerRef.current?.destroy?.();
          scannerRef.current = new QrScannerLib(
            videoRef.current,
            async (result) => {
              const text = typeof result === 'string' ? result : (result as any)?.data || (result as any)?.text;
              if (!text || text === 'undefined') return;
              if (hasScannedRef.current) return;
              hasScannedRef.current = true;
              try {
                await scannerRef.current?.stop();
              } catch {}
              onOpenChange(false);
              onQRScanned(text);
            },
            {
              highlightScanRegion: true,
              highlightCodeOutline: true,
              maxScansPerSecond: 12,
              preferredCamera: 'environment',
              returnDetailedScanResult: true,
            }
          );

          try {
            (scannerRef.current as any)?.setInversionMode?.('both');
          } catch {}
          await scannerRef.current.start();
        }
      } catch (err) {
        console.error('Camera permission denied or scanner failed:', err);
        if (!isMounted) return;
        setHasPermission(false);
        setError('Camera permission denied. You can upload a QR image or enter the 6-digit pairing code.');
      }
    };

    setupScanner();

    return () => {
      isMounted = false;
      try {
        scannerRef.current?.stop();
      } catch {}
      scannerRef.current?.destroy?.();
      scannerRef.current = null;
    };
  }, [open, activeTab, onQRScanned, onOpenChange]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imageDataUrl = e.target?.result as string;
          const result = await QrScannerLib.scanImage(imageDataUrl, { returnDetailedScanResult: true });
          const decoded = typeof result === 'string' ? result : (result as any)?.data;

          if (decoded) {
            onQRScanned(decoded);
            onOpenChange(false);
          } else {
            setError('No QR code found in the image. Please try another image or enter the 6-digit code.');
          }
        } catch (scanError) {
          console.error('QR scan error:', scanError);
          setError('Could not read QR code from image. Try entering the 6-digit pairing code instead.');
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload error:', error);
      setError('Failed to process the uploaded file.');
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    onQRScanned(trimmed);
    setManualCode('');
    onOpenChange(false);
  };

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title="Scan QR or Enter Pairing Code"
      className="max-w-md"
    >
      <div className="p-6 space-y-5">
        {/* 3-Tab Navigation */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/90 border border-white/10 rounded-xl p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setActiveTab('scan');
            }}
            className={`h-9 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'scan'
                ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Camera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setActiveTab('upload');
            }}
            className={`h-9 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'upload'
                ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload QR
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setActiveTab('code');
            }}
            className={`h-9 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'code'
                ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
            6-Digit Code
          </Button>
        </div>

        {activeTab === 'scan' ? (
          <>
            {hasPermission === false ? (
              <div className="text-center py-8 bg-slate-900/40 rounded-2xl border border-white/10 p-5 space-y-4">
                <AlertCircle className="h-9 w-9 text-amber-400 mx-auto" />
                <p className="text-muted-foreground text-xs leading-relaxed">{error}</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => setActiveTab('upload')}
                    variant="outline"
                    className="border-white/15 text-white text-xs font-bold rounded-xl"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload QR Image
                  </Button>
                  <Button
                    onClick={() => setActiveTab('code')}
                    className="bg-primary text-slate-950 hover:bg-primary/90 text-xs font-extrabold rounded-xl"
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    Enter 6-Digit Code
                  </Button>
                </div>
              </div>
            ) : hasPermission === true ? (
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_#16ffbb] pointer-events-none animate-laser" />
                  <div className="absolute w-44 h-44 border-2 border-primary/30 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />
                  </div>
                </div>
                {error && (
                  <div className="text-center text-rose-300 text-xs font-mono bg-rose-950/20 border border-rose-500/20 rounded-xl p-3">
                    {error}
                  </div>
                )}
                <p className="text-center text-xs text-muted-foreground font-mono">
                  Point your camera at the RampFi QR code.
                </p>
              </div>
            ) : (
              <div className="text-center py-14 bg-slate-900/40 border border-white/5 rounded-2xl space-y-3">
                <Camera className="h-9 w-9 text-primary mx-auto animate-pulse" />
                <p className="text-muted-foreground text-xs font-mono">Initializing camera...</p>
              </div>
            )}
          </>
        ) : activeTab === 'upload' ? (
          <div className="space-y-4">
            <div className="text-center py-10 bg-slate-900/40 border border-dashed border-white/15 rounded-2xl space-y-4 px-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">Upload QR Code Image</p>
                <p className="text-muted-foreground text-[11px] mt-1">
                  Select a downloaded QR image or screenshot (PNG, JPG, WEBP)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary text-slate-950 hover:bg-primary/90 font-extrabold rounded-xl px-6"
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? 'Reading QR Code...' : 'Choose QR Image'}
              </Button>
            </div>
            {error && (
              <div className="text-center text-rose-300 text-xs font-mono bg-rose-950/20 border border-rose-500/20 rounded-xl p-3">
                {error}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="p-5 bg-slate-900/40 border border-white/10 rounded-2xl space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                6-Digit Pairing Code or Pairing Link
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Enter the 6-digit numeric code (e.g. <span className="font-mono text-primary">482910</span>) or paste the pairing link shown beneath the QR code on your other device.
              </p>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 482910 or https://.../pair?..."
                className="h-11 bg-black/50 border-white/15 font-mono text-sm text-center tracking-wider"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full h-11 bg-primary text-slate-950 hover:bg-primary/90 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                Connect with Code
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </ViewportModal>
  );
};
