'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Cpu, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  ChevronRight
} from 'lucide-react';

export default function NftCreatorPage() {
  const router = useRouter();
  const { pubkey, hasWallet } = useWalletStore();
  const lz = useWallet();

  const [nftType, setNftType] = useState<'standard' | 'compressed'>('compressed');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Minting steps
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
      setError('Please connect your LazorKit wallet first');
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
    
    // Reset steps
    setSteps([
      { label: 'Upload metadata to backend', status: 'running' },
      { label: 'Build transaction instructions', status: 'idle' },
      { label: 'Authenticate biometric passkey signature', status: 'idle' },
      { label: 'Broadcast to Solana Devnet & confirm', status: 'idle' }
    ]);

    try {
      const walletPubkey = new PublicKey(activeAddress);
      
      // Step 1: Store metadata
      const mintId = generateMintId(nftType === 'standard' ? 'nft' : 'cnft');
      const metadataUri = await storeNftMetadata(mintId, {
        name: name.trim(),
        description: description.trim()
      });

      updateStep(0, 'success');
      updateStep(1, 'running');

      const instructions: TransactionInstruction[] = [];

      if (nftType === 'standard') {
        // Build Standard 1/1 NFT Mint Instructions
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

        // Create mint account
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

        // Initialize mint
        instructions.push(
          createInitializeMintInstruction(
            mintPubkey,
            0,
            walletPubkey,
            walletPubkey
          )
        );

        // Create ATA
        instructions.push(
          createAssociatedTokenAccountInstruction(
            walletPubkey,
            associatedTokenAddress,
            walletPubkey,
            mintPubkey
          )
        );

        // Mint token
        instructions.push(
          createMintToInstruction(
            mintPubkey,
            associatedTokenAddress,
            walletPubkey,
            1,
            []
          )
        );

        // Metaplex token metadata & master edition
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

        // Step 3: Trigger biometric signature
        if (!lz?.signAndSendTransaction) {
          throw new Error('Biometric signature provider is not initialized on this device.');
        }

        const signature = await lz.signAndSendTransaction(instructions);
        
        updateStep(2, 'success');
        updateStep(3, 'running');

        // Confirm
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
        // Build Compressed NFT (cNFT) Mint Instructions
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

        // Step 3: Trigger biometric signature
        if (!lz?.signAndSendTransaction) {
          throw new Error('Biometric signature provider is not initialized on this device.');
        }

        const signature = await lz.signAndSendTransaction(instructions);

        updateStep(2, 'success');
        updateStep(3, 'running');

        // Extract Leaf Asset ID from transaction logs
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

      // Clear form
      setName('');
      setDescription('');

    } catch (err: any) {
      console.error('Minting error:', err);
      // Mark current running step as failed
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
      setError(err.message || 'Transaction was canceled or failed on Solana blockchain.');
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden flex flex-col">
      {/* Background neon glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/buy')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-black text-lg tracking-tight">Gasless NFT Studio</h2>
            <p className="text-xs text-gray-500">Powered by Metaplex & LazorKit</p>
          </div>
        </div>

        {pubkey && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-gray-300">
              {pubkey.slice(0, 6)}...{pubkey.slice(-4)}
            </span>
          </div>
        )}
      </header>

      {/* Main content grid */}
      <main className="flex-1 container mx-auto max-w-6xl p-6 md:p-10 grid md:grid-cols-5 gap-8 items-start">
        
        {/* Form and info card */}
        <div className="md:col-span-3 space-y-6">
          
          {/* Card Select NFT Type */}
          <div className="bg-white/5 border border-white/15 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => !minting && setNftType('compressed')}
              className={`flex-1 py-3.5 px-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2.5 transition ${nftType === 'compressed' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
            >
              <Cpu className="w-4 h-4" /> Compressed NFT (cNFT)
            </button>
            <button
              onClick={() => !minting && setNftType('standard')}
              className={`flex-1 py-3.5 px-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2.5 transition ${nftType === 'standard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
            >
              <Layers className="w-4 h-4" /> Standard NFT (1/1)
            </button>
          </div>

          {/* Form Card */}
          <Card className="p-6 md:p-8 bg-white/5 border-white/10 backdrop-blur-md space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" /> Mint your NFT
              </h3>
              <p className="text-xs text-gray-400">
                {nftType === 'compressed' 
                  ? 'cNFTs are stored off-chain using state compression, making them ultra-cheap and 100% free with gasless paymasters.' 
                  : 'Standard NFTs are fully deployed on-chain and registered with the Metaplex token metadata program.'
                }
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-300 uppercase tracking-wider">NFT Name</Label>
                <Input
                  type="text"
                  placeholder="e.g. LazorKit Founders Pass"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={minting}
                  maxLength={32}
                  className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-primary h-12"
                />
                <span className="text-[10px] text-gray-500 float-right">{name.length}/32</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Description</Label>
                <textarea
                  placeholder="e.g. This pass grants exclusive early benefits within the LazorKit Web3 ecosystem."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={minting}
                  maxLength={200}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl placeholder:text-gray-500 p-4 min-h-[100px] text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-gray-500 float-right">{description.length}/200</span>
              </div>

              {!pubkey ? (
                <Button 
                  onClick={() => router.push('/buy')}
                  className="w-full h-12 rounded-xl bg-primary font-bold hover:bg-primary/90 mt-2"
                >
                  Connect Wallet First
                </Button>
              ) : (
                <Button
                  onClick={handleMint}
                  disabled={minting || !name.trim() || !description.trim()}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-black tracking-tight text-white mt-2 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {minting ? (
                    <>Creating NFT...</>
                  ) : (
                    <>Mint {nftType === 'compressed' ? 'cNFT' : 'NFT'} (100% Gasless)</>
                  )}
                </Button>
              )}

              {error && (
                <div className="flex items-start gap-2.5 bg-red-950/20 border border-red-500/20 p-4 rounded-xl text-red-300 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Stepper progress (Visible while minting) */}
          {minting && (
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-md space-y-4">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Minting Progress</h4>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      {step.status === 'idle' && <div className="w-4.5 h-4.5 rounded-full border border-gray-600 flex items-center justify-center text-[10px] text-gray-500">○</div>}
                      {step.status === 'running' && <div className="w-4.5 h-4.5 rounded-full border border-primary flex items-center justify-center text-[10px] text-primary animate-pulse font-bold">▶</div>}
                      {step.status === 'success' && <div className="w-4.5 h-4.5 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-[10px] text-primary font-bold">✓</div>}
                      {step.status === 'failed' && <div className="w-4.5 h-4.5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center text-[10px] text-red-500 font-bold">✗</div>}
                      <span className={`${step.status === 'running' ? 'text-white font-medium' : step.status === 'success' ? 'text-gray-300' : 'text-gray-500'}`}>{step.label}</span>
                    </div>
                    {step.status === 'running' && <Clock className="w-3.5 h-3.5 animate-spin text-primary" />}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Successful result card */}
          {result && (
            <Card className="p-6 bg-emerald-950/10 border-emerald-500/20 backdrop-blur-md space-y-5 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">NFT Minted Successfully!</h3>
                <p className="text-xs text-gray-400">Your NFT is now live on Solana Devnet.</p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-xl text-left space-y-2 text-xs max-w-sm mx-auto font-mono text-gray-300">
                <div className="flex justify-between gap-4"><span className="text-gray-400">NFT Name:</span><span className="font-semibold">{result.name}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Symbol:</span><span>{result.type === 'standard' ? REGULAR_NFT_SYMBOL : CNFT_SYMBOL}</span></div>
                {result.type === 'standard' && (
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Mint Address:</span><span className="text-xs font-semibold">{result.mintAddress?.slice(0, 10)}...{result.mintAddress?.slice(-8)}</span></div>
                )}
                {result.type === 'compressed' && (
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Leaf Asset ID:</span><span className="text-xs font-semibold">{result.assetId?.slice(0, 10)}...{result.assetId?.slice(-8)}</span></div>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <a 
                  href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                >
                  View Transaction <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {result.type === 'compressed' && result.assetId && (
                  <a 
                    href={`https://explorer.solana.com/address/${result.assetId}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold border-l border-white/10 pl-3"
                  >
                    View Asset <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </Card>
          )}

        </div>

        {/* 3D Holographic NFT card preview */}
        <div className="md:col-span-2 space-y-6">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Holographic Card Preview</h4>
          
          {/* Card container */}
          <div className="group relative h-96 w-full rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/15 to-pink-500/10 p-[1px] shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:scale-[1.02]">
            {/* Holographic glowing borders */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl opacity-10 group-hover:opacity-20 blur-md transition-all duration-500" />
            
            {/* Inside Card content */}
            <div className="h-full w-full bg-[#0d0d0f]/90 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
              
              {/* Top Details */}
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-gray-400 uppercase tracking-widest font-black">
                  {nftType === 'standard' ? REGULAR_NFT_SYMBOL : CNFT_SYMBOL}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> DEVNET
                </span>
              </div>

              {/* Central Glowing Orb placeholder */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center my-4">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-purple-600 rounded-full opacity-20 blur-xl group-hover:opacity-40 animate-pulse transition duration-500" />
                <div className="w-24 h-24 rounded-full border border-white/15 bg-white/5 flex items-center justify-center relative overflow-hidden backdrop-blur-sm group-hover:rotate-12 transition-all duration-700">
                  <Sparkles className="w-10 h-10 text-primary group-hover:scale-110 transition duration-500" />
                </div>
              </div>

              {/* Bottom Metadata Info */}
              <div className="space-y-1.5">
                <h3 className="text-md font-black tracking-tight truncate text-white leading-none">
                  {name.trim() || 'Untitled Artwork'}
                </h3>
                <p className="text-[11px] text-gray-400 line-clamp-2 min-h-[33px]">
                  {description.trim() || 'This holographic preview updates in real-time as you fill in your NFT name and description.'}
                </p>
                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500">
                  <span>Author: {pubkey ? `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}` : 'Anonymous'}</span>
                  <span className="text-primary font-bold">100% GASLESS</span>
                </div>
              </div>

            </div>
          </div>

          {/* Technology Details Card */}
          <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-md space-y-3.5">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-primary" /> Tech Stack Specs
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex justify-between"><span className="text-gray-500">Solana Network:</span><span>Devnet (Helius RPC)</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Metadata Protocol:</span><span>Metaplex Standard V3</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Biometric Signer:</span><span>WebAuthn Passkey (ED25519)</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Gas Sponsor:</span><span>LazorKit Paymaster (Gasless)</span></li>
            </ul>
          </Card>
        </div>

      </main>
    </div>
  );
}
