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
  Hexagon,
  PlusCircle,
  ShieldCheck,
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
          <PlusCircle className="h-3.5 w-3.5" /> Mint New
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
          <div className="lg:col-span-2 space-y-3">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Live Asset Preview</Label>
            <div className="group relative rounded-2xl bg-gradient-to-br from-primary/20 via-accent/15 to-emerald-500/10 p-[1px] shadow-xl transition duration-500 hover:border-primary/40">
              <div className="w-full bg-[#090d16]/95 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-xl border border-white/10 space-y-6">
                <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

                <div className="flex justify-between items-center relative z-10">
                  <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/25 text-[10px] text-primary font-mono font-extrabold tracking-wider uppercase">
                    {nftType === 'standard' ? REGULAR_NFT_SYMBOL : CNFT_SYMBOL} • {nftType === 'standard' ? 'Metaplex 1/1' : 'Bubblegum cNFT'}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> DEVNET
                  </span>
                </div>

                {/* Geometric Artwork Stage */}
                <div className="relative w-full aspect-[4/3] rounded-xl border border-white/10 bg-gradient-to-br from-[#0c1322] via-[#090d16] to-[#0a191e] flex flex-col items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(22,255,187,0.12),transparent_65%)]" />
                  <div className="relative w-20 h-20 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center shadow-[0_0_30px_rgba(22,255,187,0.15)] group-hover:scale-105 transition-transform duration-500">
                    {nftType === 'compressed' ? (
                      <Cpu className="w-9 h-9 text-primary" />
                    ) : (
                      <Hexagon className="w-9 h-9 text-primary" />
                    )}
                  </div>
                  <span className="mt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                    {nftType === 'compressed' ? 'Merkle Tree State Compression' : 'SPL Master Edition'}
                  </span>
                </div>

                {/* Metadata & Attributes */}
                <div className="space-y-3 relative z-10">
                  <div>
                    <h3 className="text-base font-extrabold truncate text-white leading-tight">
                      {name.trim() || 'Untitled Digital Asset'}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[34px] leading-relaxed mt-1">
                      {description.trim() || 'On-chain metadata preview updates in real time as you configure your asset.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Storage Standard</span>
                      <span className="text-xs font-bold text-white font-mono">
                        {nftType === 'compressed' ? 'Concurrent Merkle' : 'Token Metadata'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Network Fee</span>
                      <span className="text-xs font-bold text-primary font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> 0.00 SOL
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-white/10 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                    <span>Creator: {pubkey ? `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}` : 'Unconnected'}</span>
                    <span className="text-primary font-bold">PAYMASTER SPONSORED</span>
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
