'use client';

import React, { useState } from 'react';
import { NftGallery } from '@/components/nft-gallery';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
// @ts-ignore
import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, getAssociatedTokenAddress, MINT_SIZE } from '@solana/spl-token';
import {
  buildMetaplexInstructions,
  buildCNftMintInstruction,
  extractCNftAssetId,
  storeNftMetadata,
  validateNftMetadata,
  generateMintId,
  DEMO_MERKLE_TREE,
  REGULAR_NFT_SYMBOL,
  CNFT_SYMBOL,
} from '@/lib/utils/nft-utils';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { defaultConnection } from '@/lib/services/jupiter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Layers,
  Cpu,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

export function NftCreatorView() {
  const { pubkey } = useWalletStore();
  const lz = useWallet();

  const [activeStudioTab, setActiveStudioTab] = useState<'mint' | 'collection'>('mint');
  const [nftType, setNftType] = useState<'standard' | 'compressed'>('compressed');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<{ label: string; status: 'idle' | 'running' | 'success' | 'failed' }[]>([
    { label: 'Upload metadata to backend', status: 'idle' },
    { label: 'Build transaction instructions', status: 'idle' },
    { label: 'Authenticate biometric passkey signature', status: 'idle' },
    { label: 'Broadcast to Solana Devnet & confirm', status: 'idle' }
  ]);

  const [result, setResult] = useState<{
    success: boolean;
    type: 'standard' | 'compressed';
    name: string;
    description: string;
    mintAddress?: string;
    assetId?: string;
    signature: string;
  } | null>(null);

  const updateStep = (index: number, status: 'idle' | 'running' | 'success' | 'failed') => {
    setSteps(prev => prev.map((s, idx) => idx === index ? { ...s, status } : s));
  };

  const handleMint = async () => {
    const activeAddress = lz?.address || pubkey;
    if (!activeAddress) {
      setError('Please connect your wallet first');
      return;
    }

    const validation = validateNftMetadata(name, description);
    if (!validation.valid) {
      setError(validation.error || 'Invalid metadata fields');
      return;
    }

    setMinting(true);
    setError(null);
    setResult(null);

    setSteps([
      { label: 'Upload metadata to backend', status: 'running' },
      { label: 'Build transaction instructions', status: 'idle' },
      { label: 'Authenticate biometric passkey signature', status: 'idle' },
      { label: 'Broadcast to Solana Devnet & confirm', status: 'idle' }
    ]);

    try {
      const walletPubkey = new PublicKey(activeAddress);

      const mintId = generateMintId(nftType === 'standard' ? 'nft' : 'cnft');
      const metadataUri = await storeNftMetadata(mintId, {
        name: name.trim(),
        description: description.trim()
      });

      updateStep(0, 'success');
      updateStep(1, 'running');

      const instructions: TransactionInstruction[] = [];

      if (nftType === 'standard') {
        const mintSeed = `nft-${mintId}`;
        const mintPubkey = await PublicKey.createWithSeed(
          walletPubkey,
          mintSeed,
          TOKEN_PROGRAM_ID
        );

        const lamports = await defaultConnection.getMinimumBalanceForRentExemption(MINT_SIZE);
        const associatedTokenAddress = await getAssociatedTokenAddress(
          mintPubkey,
          walletPubkey,
          true
        );

        instructions.push(
          SystemProgram.createAccountWithSeed({
            fromPubkey: walletPubkey,
            basePubkey: walletPubkey,
            seed: mintSeed,
            newAccountPubkey: mintPubkey,
            lamports,
            space: MINT_SIZE,
            programId: TOKEN_PROGRAM_ID,
          })
        );

        instructions.push(
          createInitializeMintInstruction(
            mintPubkey,
            0,
            walletPubkey,
            walletPubkey
          )
        );

        instructions.push(
          createAssociatedTokenAccountInstruction(
            walletPubkey,
            associatedTokenAddress,
            walletPubkey,
            mintPubkey
          )
        );

        instructions.push(
          createMintToInstruction(
            mintPubkey,
            associatedTokenAddress,
            walletPubkey,
            1,
            []
          )
        );

        const metaplexIxs = await buildMetaplexInstructions(
          activeAddress,
          mintPubkey.toBase58(),
          name.trim(),
          metadataUri,
          REGULAR_NFT_SYMBOL
        );
        instructions.push(...metaplexIxs);

        updateStep(1, 'success');
        updateStep(2, 'running');

        if (!lz?.signAndSendTransaction) {
          throw new Error('Biometric signature provider not initialized.');
        }

        const signature = await lz.signAndSendTransaction(instructions);

        updateStep(2, 'success');
        updateStep(3, 'running');

        await defaultConnection.confirmTransaction(signature, 'confirmed');
        updateStep(3, 'success');

        setResult({
          success: true,
          type: 'standard',
          name: name.trim(),
          description: description.trim(),
          mintAddress: mintPubkey.toBase58(),
          signature
        });

      } else {
        const cnftIxs = buildCNftMintInstruction(
          activeAddress,
          DEMO_MERKLE_TREE,
          name.trim(),
          metadataUri,
          CNFT_SYMBOL
        );
        instructions.push(...cnftIxs);

        updateStep(1, 'success');
        updateStep(2, 'running');

        if (!lz?.signAndSendTransaction) {
          throw new Error('Biometric signature provider not initialized.');
        }

        const signature = await lz.signAndSendTransaction(instructions);

        updateStep(2, 'success');
        updateStep(3, 'running');

        const assetId = await extractCNftAssetId(signature);
        updateStep(3, 'success');

        setResult({
          success: true,
          type: 'compressed',
          name: name.trim(),
          description: description.trim(),
          assetId,
          signature
        });
      }

      setName('');
      setDescription('');

    } catch (err: any) {
      console.error('Minting error:', err);
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
      setError(err.message || 'Transaction failed on Solana Devnet.');
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">NFT Creator Studio</h2>
        <p className="text-sm text-muted-foreground">Mint custom and compressed NFTs completely gas-free.</p>
      </div>

      {/* Studio Tab Bar */}
      <div className="flex gap-1 p-1 rounded-xl premium-depth-inset w-full max-w-[400px] mx-auto">
        <button
          onClick={() => setActiveStudioTab('mint')}
          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${activeStudioTab === 'mint'
            ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-primary shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
            }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Mint New
        </button>
        <button
          onClick={() => setActiveStudioTab('collection')}
          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${activeStudioTab === 'collection'
            ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-primary shadow-sm border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
            }`}
        >
          <Layers className="h-3.5 w-3.5" /> My Collection
        </button>
      </div>

      {/* Collection Tab */}
      {activeStudioTab === 'collection' && (
        <NftGallery onMintClick={() => setActiveStudioTab('mint')} />
      )}

      {/* Mint Tab */}
      {activeStudioTab === 'mint' && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left Form */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-muted/40 border border-border p-1 rounded-2xl flex gap-1">
              <button
                onClick={() => !minting && setNftType('compressed')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition ${nftType === 'compressed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Cpu className="w-3.5 h-3.5" /> Compressed NFT (cNFT)
              </button>
              <button
                onClick={() => !minting && setNftType('standard')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition ${nftType === 'standard' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Standard NFT (1/1)
              </button>
            </div>

            <Card className="p-5 bg-card border-border space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">NFT Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. RampFi Founders Pass"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={minting}
                    maxLength={32}
                    className="glass-input h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</Label>
                  <textarea
                    placeholder="e.g. Provides early perks in the RampFi ecosystem."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={minting}
                    maxLength={200}
                    className="w-full glass-input text-foreground rounded-xl placeholder:text-muted-foreground/60 p-3 min-h-[72px] text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Button
                  onClick={handleMint}
                  disabled={minting || !name.trim() || !description.trim() || !pubkey}
                  className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-sm flex items-center justify-center gap-2"
                >
                  {minting ? 'Creating NFT...' : `Mint ${nftType === 'compressed' ? 'cNFT' : 'NFT'} (Gasless)`}
                </Button>

                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 p-3.5 rounded-xl text-destructive text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </Card>

            {minting && (
              <Card className="p-4 bg-muted/20 border-border space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minting Progress</h4>
                <div className="space-y-2">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {step.status === 'idle' && <div className="w-4 h-4 rounded-full border border-border flex items-center justify-center text-[10px] text-muted-foreground">○</div>}
                        {step.status === 'running' && <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center text-[10px] text-primary animate-pulse">▶</div>}
                        {step.status === 'success' && <div className="w-4 h-4 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-[10px] text-primary font-bold">✓</div>}
                        {step.status === 'failed' && <div className="w-4 h-4 rounded-full bg-destructive/20 border border-destructive flex items-center justify-center text-[10px] text-destructive font-bold">✗</div>}
                        <span className={step.status === 'running' ? 'text-foreground font-medium' : 'text-muted-foreground'}>{step.label}</span>
                      </div>
                      {step.status === 'running' && <Clock className="w-3.5 h-3.5 animate-spin text-primary" />}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {result && (
              <Card className="p-5 border-emerald-500/20 bg-emerald-500/5 text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-foreground">NFT Minted!</h3>
                  <p className="text-xs text-muted-foreground">Your gasless asset is now deployed on-chain.</p>
                </div>

                <div className="bg-background/40 border border-border/40 p-3 rounded-lg text-left space-y-1.5 text-xs font-mono text-muted-foreground">
                  <div className="flex justify-between"><span className="text-muted-foreground/60">Name:</span><span className="font-semibold text-foreground">{result.name}</span></div>
                  {result.type === 'standard' ? (
                    <div className="flex justify-between"><span className="text-muted-foreground/60">Mint:</span><span>{result.mintAddress?.slice(0, 10)}...</span></div>
                  ) : (
                    <div className="flex justify-between"><span className="text-muted-foreground/60">Asset ID:</span><span>{result.assetId?.slice(0, 10)}...</span></div>
                  )}
                </div>

                <div className="flex gap-4 justify-center">
                  <a
                    href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                  >
                    Transaction <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </Card>
            )}

            {/* Studio Gasless Relayer Promo Card to balance layout height */}
            <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-slate-950/40 p-6 flex flex-col justify-between h-[236px] shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent z-10" />
              <img
                src="/crypto_trading_art.png"
                alt="Ecosystem Art"
                className="absolute inset-0 w-full h-full object-cover opacity-20 z-0"
              />
              <div className="relative z-20 space-y-2.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded border border-primary/20">
                  Ecosystem sponsored
                </span>
                <h4 className="font-extrabold text-base text-white">Create Without Limits</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  RampFi NFT Creator Studio leverages advanced Solana state compression. Mint up to 1,000,000 cNFTs gas-free, fully sponsored by the RampFi Ecosystem relayer network.
                </p>
              </div>
              <div className="relative z-20 flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Solana Devnet Relayer Live</span>
              </div>
            </div>
          </div>

          {/* Right Preview */}
          <div className="lg:col-span-2 space-y-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preview Card</Label>
            <div className="group relative rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/10 to-pink-500/5 p-[1px] shadow-md transition duration-500 hover:scale-[1.01] h-[560px]">
              <div className="h-full w-full bg-[#0d0d0f]/90 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md border border-border/60">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-border text-[10px] text-muted-foreground font-black">
                    {nftType === 'standard' ? REGULAR_NFT_SYMBOL : CNFT_SYMBOL}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> DEVNET
                  </span>
                </div>

                <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-8">
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-lg" />
                  <div className="w-20 h-20 rounded-full border border-border bg-white/5 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold truncate text-foreground leading-none">
                    {name.trim() || 'Untitled Artwork'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[30px] leading-relaxed">
                    {description.trim() || 'Holographic preview updates as you compose.'}
                  </p>
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[10px] text-muted-foreground/60 font-mono">
                    <span>Author: {pubkey ? `${pubkey.slice(0, 4)}...` : 'Anonymous'}</span>
                    <span className="text-primary font-bold">100% GASLESS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
