'use client';

import { useState } from 'react';
import { Send, Clipboard, QrCode, ArrowRight, Wallet, ExternalLink, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { ViewportModal } from './ui/viewport-modal';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SimpleSelect } from './ui/simple-select';
import { useWalletStore, TokenSym } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, APP_USDC_MINT, defaultConnection } from '@/lib/services/jupiter';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { formatTokenAmount } from '@/lib/utils/format';
import { isValidSolanaAddress } from '@/lib/utils/address';
import { toast } from '@/hooks/use-toast';
import { QRScannerModal } from './qr-scanner-modal';
import { parsePaymentInput, withReferences } from '@/lib/solana-pay';
import {
  getAuthorityMarker,
  getSessionMarker,
  isLimitError,
  isStaleKeyError,
  pickQuickSigner,
  sendWithQuickSigner,
  type QuickSigner,
} from '@/lib/lazorkit/quick-access';

/** Rent for a new associated token account, paid by the sender's vault. */
const ATA_RENT_SOL = 0.00204;

interface SendModalViewportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendModalViewport = ({ open, onOpenChange }: SendModalViewportProps) => {
  const { tokens, pubkey, addActivity, refreshBalances } = useWalletStore();
  const lz = useWallet();
  const [selectedToken, setSelectedToken] = useState<TokenSym>('SOL');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [quickPay, setQuickPay] = useState(true);
  const [signedWith, setSignedWith] = useState<QuickSigner | 'passkey'>('passkey');
  const [showScanner, setShowScanner] = useState(false);
  const [references, setReferences] = useState<string[]>([]);
  const [paymentNote, setPaymentNote] = useState<string>('');

  const walletPda = lz.wallet?.smartWallet ?? null;
  const hasQuickKey = open && !!(getSessionMarker(walletPda) || getAuthorityMarker(walletPda));

  const selectedTokenData = tokens.find((t) => t.symbol === selectedToken);
  const amountNum = parseFloat(amount) || 0;
  const quickSignerPreview = hasQuickKey && amountNum > 0
    ? pickQuickSigner(walletPda, { token: selectedToken, amount: amountNum })
    : null;

  const validateForm = () => {
    if (!recipient.trim()) {
      setError('Please enter a recipient address');
      return false;
    }

    if (!isValidSolanaAddress(recipient)) {
      setError('Invalid Solana address format');
      return false;
    }

    if (!amount || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (!selectedTokenData || amountNum > selectedTokenData.amount) {
      setError('Insufficient balance for this transfer');
      return false;
    }

    setError('');
    return true;
  };

  const handleSend = async () => {
    if (!validateForm()) return;
    if (!pubkey) {
      toast({ title: 'Error', description: 'Wallet not connected', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setTxSignature(null);
    try {
      const activeAddress = (lz as any)?.address || pubkey;
      if (!activeAddress) throw new Error('Wallet not ready');
      const ownerPk = new PublicKey(activeAddress);
      const recipientPk = new PublicKey(recipient);

      if (!lz?.signAndSendTransaction) throw new Error('Biometric signature provider not initialized.');

      const instructions: TransactionInstruction[] = [];
      let rentSol = 0;
      if (selectedToken === 'SOL') {
        const lamports = Math.round(amountNum * 1e9);
        let transferIx = SystemProgram.transfer({ fromPubkey: ownerPk, toPubkey: recipientPk, lamports });
        if (references.length > 0) transferIx = withReferences(transferIx, references);
        instructions.push(transferIx);
      } else {
        const mintStr = (TOKEN_ADDRESSES as Record<string, string>)[selectedToken];
        if (!mintStr) throw new Error('Unknown token mint');
        const decimals = TOKEN_DECIMALS[selectedToken as keyof typeof TOKEN_DECIMALS] ?? 6;
        const rawAmount = Math.round(amountNum * Math.pow(10, decimals));
        const mintPk = new PublicKey(mintStr);

        const fromAta = await (splToken as any).getAssociatedTokenAddress(mintPk, ownerPk, true);
        let toAta;
        try {
          toAta = await (splToken as any).getAssociatedTokenAddress(mintPk, recipientPk, false);
        } catch (err: any) {
          if (err?.name === 'TokenOwnerOffCurveError' || /OffCurve/i.test(String(err?.message))) {
            toAta = await (splToken as any).getAssociatedTokenAddress(mintPk, recipientPk, true);
          } else {
            throw err;
          }
        }

        // Check if recipient ATA exists, if not add create ATA instruction
        const toAtaInfo = await defaultConnection.getAccountInfo(toAta);
        if (!toAtaInfo) {
          const createAtaIx = (splToken as any).createAssociatedTokenAccountInstruction(
            ownerPk,
            toAta,
            recipientPk,
            mintPk
          );
          instructions.push(createAtaIx);
          rentSol = ATA_RENT_SOL;
        }

        // Add transfer instruction
        let transferIx = typeof (splToken as any).createTransferInstruction === 'function'
          ? (splToken as any).createTransferInstruction(fromAta, toAta, ownerPk, rawAmount)
          : (splToken as any).createTransferCheckedInstruction(fromAta, mintPk, toAta, ownerPk, rawAmount, decimals);
        if (references.length > 0) transferIx = withReferences(transferIx, references);
        instructions.push(transferIx);
      }

      // Quick Pay: a session / trusted-browser key signs without Face ID when the
      // spend fits its on-chain limits. Anything else goes through the passkey.
      const quickSigner = quickPay && walletPda
        ? pickQuickSigner(walletPda, { token: selectedToken, amount: amountNum, rentSol })
        : null;

      let sig: string | null = null;
      let usedSigner: QuickSigner | 'passkey' = 'passkey';
      if (quickSigner && walletPda) {
        try {
          sig = await sendWithQuickSigner(lz, quickSigner, walletPda, instructions);
          usedSigner = quickSigner;
        } catch (err) {
          if (!isStaleKeyError(err) && !isLimitError(err)) throw err;
          console.warn('[quick-pay] falling back to passkey:', err);
          toast({
            title: 'Quick Pay unavailable',
            description: isLimitError(err)
              ? 'This payment is over the Quick Pay limit. Confirm with your passkey instead.'
              : 'The Quick Pay key is no longer valid on this browser. Confirm with your passkey instead.',
          });
        }
      }
      if (!sig) sig = await lz.signAndSendTransaction(instructions);

      setSignedWith(usedSigner);
      setTxSignature(sig);

      addActivity?.({
        id: Date.now().toString(),
        kind: 'send',
        ts: new Date().toISOString(),
        summary: `Sent ${amountNum} ${selectedToken} to ${recipient.slice(0, 4)}...${recipient.slice(-4)}`,
        amount: amountNum,
        token: selectedToken,
        counterparty: recipient,
        status: 'Success',
        tx: sig,
      } as any);

      toast({
        title: '✅ Transfer Confirmed',
        description: `${amountNum} ${selectedToken} sent on Solana Devnet${usedSigner === 'passkey' ? '' : ' with Quick Pay (no Face ID)'}`,
      });

      // Refresh balances after transfer
      setTimeout(() => refreshBalances?.().catch(console.error), 3000);

    } catch (e: any) {
      console.error('Send failed:', e);
      toast({ title: 'Transfer Failed', description: e?.message || 'Transaction failed on Solana Devnet', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setRecipient('');
    setAmount('');
    setError('');
    setTxSignature(null);
    setReferences([]);
    setPaymentNote('');
    setShowScanner(false);
    onOpenChange(false);
  };

  const applyPaymentInput = (raw: string) => {
    const parsed = parsePaymentInput(raw);
    if (parsed) {
      setRecipient(parsed.recipient);
      if (parsed.amount) setAmount(parsed.amount.toString());
      if (parsed.splToken && parsed.splToken === APP_USDC_MINT) {
        setSelectedToken('USDC');
      } else if (!parsed.splToken) {
        setSelectedToken('SOL');
      }
      if (parsed.reference) setReferences(parsed.reference);
      if (parsed.label || parsed.message) {
        setPaymentNote(parsed.label ? `${parsed.label}: ${parsed.message || ''}` : (parsed.message || ''));
      }
      setError('');
      toast({
        title: 'Solana Pay request loaded',
        description: parsed.label || `To: ${parsed.recipient.slice(0, 4)}...${parsed.recipient.slice(-4)}`,
      });
      return true;
    }
    return false;
  };

  const handleMaxClick = () => {
    if (selectedTokenData) {
      setAmount(selectedTokenData.amount.toString());
      setError('');
    }
  };

  const handlePaste = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API not available');
      }
      
      const text = await navigator.clipboard.readText();
      
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid clipboard content');
      }
      
      if (!applyPaymentInput(text)) {
        setRecipient(text.trim());
      }
      setError('');
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      toast({
        title: 'Paste Error',
        description: 'Failed to read from clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  };

  const handleQRScanned = (data: string) => {
    if (!applyPaymentInput(data)) {
      setRecipient(data.trim());
      toast({ title: 'Address scanned', description: data.slice(0, 8) + '...' });
    }
  };

  const availableTokens = tokens.filter((t) => t.amount > 0);

  const tokenOptions = availableTokens.map((token) => ({
    value: token.symbol,
    label: `${token.symbol} - ${formatTokenAmount(token.amount, token.symbol)}`,
  }));

  // Success state after transaction
  if (txSignature) {
    return (
      <ViewportModal
        open={open}
        onOpenChange={handleClose}
        title="Transfer Complete"
        className="max-w-md"
      >
        <div className="p-6 space-y-5 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-foreground">Transfer Successful</h3>
            <p className="text-xs text-muted-foreground mt-1">Your gasless transaction has been confirmed on Solana Devnet.</p>
          </div>

          <div className="bg-background/40 border border-border/40 p-4 rounded-xl text-left space-y-2 text-xs font-mono text-muted-foreground">
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">Amount:</span>
              <span className="font-semibold text-foreground">{amountNum} {selectedToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">To:</span>
              <span>{recipient.slice(0, 6)}...{recipient.slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">Gas Fee:</span>
              <span className="text-emerald-400 font-bold">$0.00 (Sponsored)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground/60">Signed with:</span>
              <span className={signedWith === 'passkey' ? '' : 'text-amber-400 font-bold'}>
                {signedWith === 'passkey' ? 'Passkey' : signedWith === 'session' ? 'Quick Pay session' : 'Trusted browser key'}
              </span>
            </div>
          </div>

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
          >
            View on Solana Explorer <ExternalLink className="w-3 h-3" />
          </a>

          <Button
            onClick={handleClose}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl"
          >
            Done
          </Button>
        </div>
      </ViewportModal>
    );
  }

  return (
    <ViewportModal
      open={open}
      onOpenChange={handleClose}
      title="Send Tokens"
      className="max-w-[420px]"
    >
      <div className="p-5 space-y-4">
        {/* Token Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              Asset
            </Label>
            {selectedTokenData && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Available:{' '}
                <strong className="text-white">
                  {formatTokenAmount(selectedTokenData.amount, selectedTokenData.symbol)}
                </strong>
              </span>
            )}
          </div>
          <SimpleSelect
            value={selectedToken}
            onValueChange={(value: string) => setSelectedToken(value as TokenSym)}
            options={tokenOptions}
            placeholder="Select Token"
            className="h-11 rounded-xl"
          />
        </div>

        {/* Recipient Address */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recipient Address
          </Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Solana wallet or vault address..."
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setError('');
                }}
                className={`flex-1 h-11 rounded-xl premium-depth-inset border-white/10 font-mono text-xs ${
                  error ? 'border-destructive' : ''
                }`}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePaste}
                title="Paste"
                className="h-11 w-11 p-0 rounded-xl premium-depth-btn-secondary shrink-0"
              >
                <Clipboard className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScanner(true)}
                title="Scan QR / Solana Pay"
                className="h-11 w-11 p-0 rounded-xl premium-depth-btn-secondary shrink-0"
              >
                <QrCode className="h-4 w-4 text-primary" />
              </Button>
            </div>
            {paymentNote && (
              <p className="text-[11px] text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-xl font-medium">
                {paymentNote}
              </p>
            )}
            {references.length > 0 && (
              <p className="text-[9px] font-mono text-muted-foreground">
                Ref: {references[0].slice(0, 8)}…{references[0].slice(-8)} (Solana Pay tracked)
              </p>
            )}
            {error && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full shrink-0" />
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Amount
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              className={`flex-1 h-11 rounded-xl premium-depth-inset border-white/10 font-mono text-sm font-bold ${
                error ? 'border-destructive' : ''
              }`}
            />
            <Button
              variant="outline"
              onClick={handleMaxClick}
              className="h-11 px-4 rounded-xl premium-depth-btn-secondary text-xs font-extrabold text-primary"
            >
              MAX
            </Button>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="p-3 rounded-xl premium-depth-inset space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Network Gas</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Sponsored ($0.00)
            </span>
          </div>
          {hasQuickKey && (
            <label
              htmlFor="quick-pay-toggle"
              className="flex justify-between items-center p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg cursor-pointer"
            >
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Quick Pay (no Face ID)
                {quickPay && amountNum > 0 && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {quickSignerPreview ? '· within limit' : '· over limit'}
                  </span>
                )}
              </span>
              <input
                id="quick-pay-toggle"
                type="checkbox"
                checked={quickPay}
                onChange={(e) => setQuickPay(e.target.checked)}
                className="h-4 w-4 accent-amber-400"
              />
            </label>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-white/5">
            <span className="text-muted-foreground">Total Deducted</span>
            <span className="font-mono font-extrabold text-white">
              {amountNum > 0 ? `${amountNum} ${selectedToken}` : '—'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-11 rounded-xl premium-depth-btn-secondary text-xs font-bold"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className="flex-1 h-11 rounded-xl premium-depth-btn text-xs font-extrabold uppercase tracking-wider"
            disabled={isProcessing || !!error}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Signing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>Confirm Send</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            )}
          </Button>
        </div>
      </div>
      <QRScannerModal open={showScanner} onOpenChange={setShowScanner} onQRScanned={handleQRScanned} />
    </ViewportModal>
  );
};
