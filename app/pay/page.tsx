'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, Wallet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCode } from '@/lib/utils/qr';
import { defaultConnection, APP_USDC_MINT } from '@/lib/services/jupiter';
import { explorerTxUrl, explorerAddressUrl } from '@/lib/utils/explorer';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import {
  checkPayment,
  encodeTransferRequest,
  withReferences,
  type PaymentFound,
  type TransferRequest,
} from '@/lib/solana-pay';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';

function PayContent() {
  const params = useSearchParams();
  const lz = useWallet();

  const recipient = params.get('recipient') || '';
  const amountStr = params.get('amount') || '';
  const amount = parseFloat(amountStr) || 0;
  const splTokenParam = params.get('spl-token') || '';
  const reference = params.getAll('reference');
  const label = params.get('label') || 'RampFi Merchant';
  const message = params.get('message') || '';

  const isUSDC = splTokenParam === APP_USDC_MINT;
  const tokenSymbol = isUSDC ? 'rUSDC' : 'SOL';

  const req = useMemo<TransferRequest | null>(() => {
    if (!recipient) return null;
    return {
      recipient,
      amount: amount > 0 ? amount : undefined,
      splToken: splTokenParam || undefined,
      reference: reference.length ? reference : undefined,
      label,
      message: message || undefined,
    };
  }, [recipient, amount, splTokenParam, reference, label, message]);

  const solanaUrl = useMemo(() => (req ? encodeTransferRequest(req) : ''), [req]);

  const [paid, setPaid] = useState<PaymentFound | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Poll reference for completion
  useEffect(() => {
    if (!req || !req.reference?.length || paid) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const found = await checkPayment(defaultConnection, req);
        if (!cancelled && found) {
          setPaid(found);
          toast({
            title: found.valid ? '✅ Payment Received' : 'Partial Payment',
            description: `${found.received} ${tokenSymbol} confirmed on Solana Devnet.`,
          });
        }
      } catch (err) {
        console.warn('[pay] poll error:', err);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [req, paid, tokenSymbol]);

  // Pay directly if user has RampFi wallet connected
  const handleRampFiPay = async () => {
    if (!lz.address || !lz.signAndSendTransaction) {
      try {
        await lz.connectPasskey();
      } catch {
        return;
      }
    }
    if (!recipient || amount <= 0) return;

    setIsPaying(true);
    try {
      const ownerPk = new PublicKey(lz.address!);
      const recipientPk = new PublicKey(recipient);
      const instructions: TransactionInstruction[] = [];

      if (!isUSDC) {
        const lamports = Math.round(amount * 1e9);
        let ix = SystemProgram.transfer({ fromPubkey: ownerPk, toPubkey: recipientPk, lamports });
        if (reference.length) ix = withReferences(ix, reference);
        instructions.push(ix);
      } else {
        const mintPk = new PublicKey(APP_USDC_MINT);
        const fromAta = await (splToken as any).getAssociatedTokenAddress(mintPk, ownerPk, true);
        let toAta;
        try {
          toAta = await (splToken as any).getAssociatedTokenAddress(mintPk, recipientPk, false);
        } catch {
          toAta = await (splToken as any).getAssociatedTokenAddress(mintPk, recipientPk, true);
        }
        const toAtaInfo = await defaultConnection.getAccountInfo(toAta);
        if (!toAtaInfo) {
          instructions.push(
            (splToken as any).createAssociatedTokenAccountInstruction(ownerPk, toAta, recipientPk, mintPk)
          );
        }
        let transferIx = (splToken as any).createTransferCheckedInstruction(
          fromAta,
          mintPk,
          toAta,
          ownerPk,
          Math.round(amount * 1e6),
          6
        );
        if (reference.length) transferIx = withReferences(transferIx, reference);
        instructions.push(transferIx);
      }

      const sig = await lz.signAndSendTransaction(instructions);
      setPaid({ signature: sig, received: amount, valid: true });
      toast({ title: 'Payment Sent!', description: `Tx: ${sig.slice(0, 8)}...` });
    } catch (err: any) {
      console.error('Payment error:', err);
      toast({ title: 'Payment Failed', description: err?.message || 'Transaction rejected', variant: 'destructive' });
    } finally {
      setIsPaying(false);
    }
  };

  if (!recipient) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Invalid payment link: missing recipient address.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="glass-card rounded-2xl p-6 text-center space-y-5 border border-border/20 shadow-2xl">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solana Pay Request</span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-foreground">{label}</h1>
          {message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
        </div>

        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-xs text-muted-foreground uppercase font-bold">Total Due</span>
          <div className="text-3xl font-black text-foreground mt-0.5">
            {amount > 0 ? `${amount} ${tokenSymbol}` : `Any Amount (${tokenSymbol})`}
          </div>
        </div>

        {paid ? (
          <div className="space-y-4 py-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Payment Received</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {paid.received} {tokenSymbol} confirmed on Solana Devnet.
              </p>
            </div>
            <a
              href={explorerTxUrl(paid.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline"
            >
              View on Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-white p-3 border border-primary/30 shadow-md">
                <QRCode value={solanaUrl} size={220} level="M" includeMargin marginSize={2} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Scan with Phantom, Solflare, Backpack, or RampFi.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/20">
              <Button
                onClick={handleRampFiPay}
                disabled={isPaying}
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl gap-2"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing Payment...
                  </>
                ) : lz.address ? (
                  <>
                    <Wallet className="h-4 w-4" /> Pay with Connected Passkey <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" /> Connect Passkey to Pay
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        <div className="pt-2 text-[10px] text-muted-foreground">
          Recipient:{' '}
          <a
            href={explorerAddressUrl(recipient)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-primary hover:underline"
          >
            {recipient.slice(0, 6)}...{recipient.slice(-6)}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading payment details...</div>}>
        <PayContent />
      </Suspense>
    </main>
  );
}
