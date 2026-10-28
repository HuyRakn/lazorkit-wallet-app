'use client';

import { useState } from 'react';
import { Copy, QrCode, Download, Share, DollarSign, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { ViewportModal } from './ui/viewport-modal';
import { QRCode } from '@/lib/utils/qr';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { formatAddress } from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';
import { PaymentRequest } from './payment-request';

interface DepositModalCompactProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DepositModalCompact = ({ open, onOpenChange }: DepositModalCompactProps) => {
  const { pubkey, walletName } = useWalletStore();
  const lz = useWallet();
  const activeAddress = lz.address || pubkey;
  const [tab, setTab] = useState<'address' | 'request'>('address');

  const handleDownloadQR = () => {
    toast({
      title: t('deposit.qrDownloaded'),
      description: t('deposit.qrDownloadedDesc'),
    });
  };

  const handleShare = async () => {
    if (!activeAddress) return;
    try {
      if (navigator.share && typeof navigator.share === 'function') {
        await navigator.share({
          title: t('deposit.shareTitle'),
          text: `${t('deposit.shareText')}\n${activeAddress}\nsolana:${activeAddress}`,
        });
      } else {
        handleCopyAddress();
      }
    } catch {
      handleCopyAddress();
    }
  };

  const handleCopyAddress = () => {
    if (!activeAddress) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(activeAddress);
        toast({
          title: t('deposit.addressCopied'),
          description: t('deposit.addressCopiedDesc'),
        });
      } else {
        toast({
          title: 'Error',
          description: 'Clipboard not available',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy address',
        variant: 'destructive',
      });
    }
  };

  if (!activeAddress) {
    return (
      <ViewportModal
        open={open}
        onOpenChange={onOpenChange}
        title={t('deposit.title')}
        className="max-w-sm"
      >
        <div className="p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
            <QrCode className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">{t('deposit.noWallet')}</h3>
            <p className="text-xs text-muted-foreground">{t('deposit.noWalletDesc')}</p>
          </div>
        </div>
      </ViewportModal>
    );
  }

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('deposit.title')}
      className="max-w-[400px]"
    >
      <div className="p-5 space-y-4">
        {/* Segmented Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl premium-depth-inset text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setTab('address')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'address'
                ? 'bg-gradient-to-r from-primary to-accent text-slate-950 shadow-sm'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Address QR
          </button>
          <button
            type="button"
            onClick={() => setTab('request')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'request'
                ? 'bg-gradient-to-r from-primary to-accent text-slate-950 shadow-sm'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Solana Pay
          </button>
        </div>

        {tab === 'request' ? (
          <PaymentRequest recipient={activeAddress} />
        ) : (
          <>
            {/* Framed QR Code */}
            <div className="space-y-3 flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3 border-2 border-primary/30 shadow-[0_0_30px_rgba(22,255,187,0.12)] inline-block">
                <div className="flex items-center justify-center">
                  <QRCode
                    value={activeAddress}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                    marginSize={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-center w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadQR}
                  className="flex-1 h-9 text-xs font-bold premium-depth-btn-secondary rounded-xl"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Save QR
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="flex-1 h-9 text-xs font-bold premium-depth-btn-secondary rounded-xl"
                >
                  <Share className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Share
                </Button>
              </div>
            </div>

            {/* Deposit Address Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{t('deposit.depositAddress')}</span>
                <span className="text-primary">{walletName || 'Smart Vault PDA'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 premium-depth-inset rounded-xl">
                <p className="text-xs font-mono text-white/90 truncate pl-1">
                  {formatAddress(activeAddress, 10, 10)}
                </p>
                <Button
                  size="sm"
                  onClick={handleCopyAddress}
                  className="h-8 px-3 rounded-lg premium-depth-btn text-[11px] shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                Send SOL or SPL tokens on Solana Devnet to this address.
              </p>
            </div>
          </>
        )}
      </div>
    </ViewportModal>
  );
};
