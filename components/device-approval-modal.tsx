'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ViewportModal } from './ui/viewport-modal';
import { Smartphone, Monitor, Tablet, Check, XCircle, ShieldCheck } from 'lucide-react';

interface DeviceApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceData: any;
  onApprove: (shareId: string) => void | Promise<void>;
  onReject: (shareId: string) => void | Promise<void>;
}

export const DeviceApprovalModal = ({
  open,
  onOpenChange,
  deviceData,
  onApprove,
  onReject,
}: DeviceApprovalModalProps) => {
  const [loading, setLoading] = useState(false);

  if (!open || !deviceData) return null;

  const platformStr = String(deviceData.platform || 'Device');
  const getDeviceIcon = (platform: string) => {
    const lower = platform.toLowerCase();
    if (lower.includes('mobile') || lower.includes('phone') || lower.includes('ios') || lower.includes('android')) {
      return Smartphone;
    } else if (lower.includes('tablet') || lower.includes('ipad')) {
      return Tablet;
    }
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon(platformStr);
  const screenW = deviceData.screen?.w || deviceData.screen?.width || 1920;
  const screenH = deviceData.screen?.h || deviceData.screen?.height || 1080;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(deviceData.shareId);
      onOpenChange(false);
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(deviceData.shareId);
      onOpenChange(false);
    } catch (error) {
      console.error('Rejection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title="Authorize New Device"
      className="max-w-md"
    >
      <div className="p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(22,255,187,0.15)]">
            <DeviceIcon className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-extrabold text-white">Incoming Device Pairing Request</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Confirm that you initiated this connection from your secondary device.
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5 text-xs">
          {deviceData.pairingCode && (
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-muted-foreground">Pairing Code</span>
              <span className="font-mono font-extrabold text-primary tracking-widest">
                {deviceData.pairingCode}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Device Type</span>
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10 font-bold">
              {platformStr}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Browser</span>
            <span className="font-bold text-white">{deviceData.browser || 'Web Browser'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Operating System</span>
            <span className="font-bold text-white">{deviceData.os || 'OS'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Viewport / Screen</span>
            <span className="font-mono text-muted-foreground">
              {screenW} × {screenH}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Locale</span>
            <span className="font-mono text-muted-foreground">{deviceData.language || 'en-US'}</span>
          </div>
        </div>

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            <strong>Security Check:</strong> Only approve devices you personally own. You can revoke access at any time from the Passkey Vault Security tab.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-300 text-white font-bold text-xs"
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-slate-950 font-extrabold text-xs shadow-[0_10px_28px_rgba(22,255,187,0.25)]"
          >
            <Check className="h-4 w-4 mr-1.5 stroke-[2.5]" />
            {loading ? 'Authorizing...' : 'Approve Device'}
          </Button>
        </div>
      </div>
    </ViewportModal>
  );
};
