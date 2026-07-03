'use client';

import { useState } from 'react';
import { Send, Clipboard, QrCode, ArrowRight, Wallet, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { ViewportModal } from './ui/viewport-modal';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SimpleSelect } from './ui/simple-select';
import { useWalletStore, TokenSym } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, defaultConnection } from '@/lib/services/jupiter';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { formatTokenAmount } from '@/lib/utils/format';
import { isValidSolanaAddress } from '@/lib/utils/address';
import { toast } from '@/hooks/use-toast';

interface SendModalViewportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendModalViewport = ({ open, onOpenChange }: SendModalViewportProps) => {
  const { tokens, pubkey, addActivity, refreshBalances } = useWalletStore();
  const lz = useWallet() as any;
  const [selectedToken, setSelectedToken] = useState<TokenSym>('SOL');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const selectedTokenData = tokens.find((t) => t.symbol === selectedToken);
  const amountNum = parseFloat(amount) || 0;

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

      let sig: string;
      if (selectedToken === 'SOL') {
        const lamports = Math.round(amountNum * 1e9);
        const transferIx = SystemProgram.transfer({ fromPubkey: ownerPk, toPubkey: recipientPk, lamports });
        sig = await lz.signAndSendTransaction([transferIx]);
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

        // Create instructions array
        const instructions = [];

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
        }

        // Add transfer instruction
        const transferIx = typeof (splToken as any).createTransferInstruction === 'function'
          ? (splToken as any).createTransferInstruction(fromAta, toAta, ownerPk, rawAmount)
          : (splToken as any).createTransferCheckedInstruction(fromAta, mintPk, toAta, ownerPk, rawAmount, decimals);
        instructions.push(transferIx);

        // Send all instructions in one transaction
        sig = await lz.signAndSendTransaction(instructions);
      }

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
        description: `${amountNum} ${selectedToken} sent successfully on Solana Devnet`,
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
    onOpenChange(false);
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
      
      setRecipient(text);
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
      className="max-w-md"
    >
      <div className="p-4 space-y-4">
        {/* Token Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Select Token
          </Label>
          <SimpleSelect
            value={selectedToken}
            onValueChange={(value: string) => setSelectedToken(value as TokenSym)}
            options={tokenOptions}
            placeholder="Select Token"
            className="h-10"
          />
          {selectedTokenData && (
            <div className="p-2 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Available Balance
                </span>
                <span className="font-medium">
                  {formatTokenAmount(selectedTokenData.amount, selectedTokenData.symbol)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Recipient Address
          </Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Solana address"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setError('');
                }}
                className={`flex-1 h-10 ${error ? 'border-destructive' : ''}`}
              />
              <Button variant="outline" size="sm" onClick={handlePaste} title="Paste" className="h-10 w-10 p-0">
                <Clipboard className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled title="Scan QR" className="h-10 w-10 p-0">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <span className="w-1 h-1 bg-destructive rounded-full"></span>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
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
              className={`flex-1 h-10 ${error ? 'border-destructive' : ''}`}
            />
            <Button variant="outline" onClick={handleMaxClick} className="h-10 px-3">
              Max
            </Button>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Transaction Details
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Network Fee
              </span>
              <span className="text-xs font-medium text-emerald-400">Gasless (Sponsored)</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
              <span className="text-xs text-muted-foreground">
                Total Amount
              </span>
              <span className="text-xs font-medium">
                {amountNum > 0 ? `${amountNum} ${selectedToken}` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-10"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className="flex-1 h-10"
            disabled={isProcessing || !!error}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-sm">Signing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm">Confirm Send</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </ViewportModal>
  );
};
