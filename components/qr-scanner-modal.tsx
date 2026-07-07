'use client';

import { useState, useRef, useEffect } from 'react';
import QrScannerLib from 'qr-scanner';
import { Button } from './ui/button';
import { ViewportModal } from './ui/viewport-modal';
import { Camera, AlertCircle, Upload, Download, Image as ImageIcon } from 'lucide-react';
import QRCode from 'qrcode';

// Ensure the Web Worker is available for live decoding
if (typeof window !== 'undefined' && (QrScannerLib as any).WORKER_PATH == null) {
  (QrScannerLib as any).WORKER_PATH = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';
}

interface QRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQRScanned: (data: string) => void;
}

export const QRScannerModal = ({ open, onOpenChange, onQRScanned }: QRScannerModalProps) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'upload'>('scan');
  const [isProcessing, setIsProcessing] = useState(false);
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
          setError('No camera found on this device');
          return;
        }

        await navigator.mediaDevices.getUserMedia({ video: true });
        if (!isMounted) return;
        setHasPermission(true);
        setError(null);

        if (videoRef.current) {
          try { await scannerRef.current?.stop(); } catch {}
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

          try { (scannerRef.current as any)?.setInversionMode?.('both'); } catch {}
          await scannerRef.current.start();
        }
      } catch (err) {
        console.error('Camera permission denied or scanner failed:', err);
        if (!isMounted) return;
        setHasPermission(false);
        setError('Camera permission is required to scan QR codes');
      }
    };

    setupScanner();

    return () => {
      isMounted = false;
      try { scannerRef.current?.stop(); } catch {}
      scannerRef.current?.destroy?.();
      scannerRef.current = null;
    };
  }, [open, activeTab, onQRScanned]);

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
          const result = await QrScannerLib.scanImage(imageDataUrl);
          
          if (result) {
            onQRScanned(result as string);
            onOpenChange(false);
          } else {
            setError('No QR code found in the image. Please try another image.');
          }
        } catch (scanError) {
          console.error('QR scan error:', scanError);
          setError('Failed to read QR code from image. Please try another image.');
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload error:', error);
      setError('Failed to process the uploaded file.');
      setIsProcessing(false);
    }
  };

  const saveQRImage = async (qrData: string) => {
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#16ffbb',
          light: '#0c0c0e'
        }
      });
      
      const link = document.createElement('a');
      link.download = 'qr-code.png';
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Failed to save QR code:', error);
      setError('Failed to save QR code');
    }
  };

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title="QR Code Scanner"
      className="max-w-md"
    >
      <div className="p-6 space-y-5">
        {/* Tab Navigation with unified glass pill styles */}
        <div className="flex space-x-1.5 bg-slate-900 border border-white/5 rounded-xl p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('scan')}
            className={`flex-1 h-9 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'scan' 
                ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm' 
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 h-9 rounded-lg font-bold text-xs transition-all ${
              activeTab === 'upload' 
                ? 'bg-primary/20 text-primary border border-primary/25 shadow-sm' 
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>

        {/* Dynamic Scan vs Upload area */}
        {activeTab === 'scan' ? (
          <>
            {hasPermission === false ? (
              <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-white/5 p-5 space-y-4">
                <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
                <p className="text-rose-300 text-xs font-mono">{error}</p>
                <Button 
                  onClick={() => onOpenChange(false)}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl"
                >
                  Close
                </Button>
              </div>
            ) : hasPermission === true ? (
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  {/* Neon scan laser effect */}
                  <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_#16ffbb] pointer-events-none animate-laser" />
                  {/* Subtle target box */}
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
                  Point camera at the QR code to scan.
                </p>
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900/40 border border-white/5 rounded-2xl space-y-4">
                <Camera className="h-10 w-10 text-primary mx-auto animate-pulse" />
                <p className="text-muted-foreground text-xs font-mono">Requesting camera permissions...</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-12 bg-slate-900/40 border border-white/5 rounded-2xl space-y-4">
              <ImageIcon className="h-10 w-10 text-primary mx-auto" />
              <div>
                <p className="text-white text-sm font-bold">Select QR Code Image</p>
                <p className="text-muted-foreground text-[10px] mt-1">PNG, JPG, or SVG formats supported</p>
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
                className="bg-primary text-slate-950 hover:bg-primary/90 font-extrabold rounded-xl shadow-lg shadow-primary/10"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950 mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Image
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="text-center text-rose-300 text-xs font-mono bg-rose-950/20 border border-rose-500/20 rounded-xl p-3">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Save QR Button */}
        <div className="pt-4 border-t border-white/5">
          <Button
            onClick={() => {
              const sampleQRData = JSON.stringify({
                type: 'device_import',
                shareId: 'sample_' + Date.now(),
                timestamp: new Date().toISOString()
              });
              saveQRImage(sampleQRData);
            }}
            variant="outline"
            className="w-full border-primary/30 hover:border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 font-bold rounded-xl"
          >
            <Download className="h-4 w-4 mr-2" />
            Save Sample QR Code
          </Button>
        </div>
      </div>
    </ViewportModal>
  );
};
