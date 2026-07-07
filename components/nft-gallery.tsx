'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/lib/store/wallet';
import { ExternalLink, Image as ImageIcon, RefreshCw, Layers, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NftAsset {
  id: string;
  content: {
    json_uri?: string;
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
    };
    links?: {
      image?: string;
      external_url?: string;
    };
    files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>;
  };
  compression?: {
    compressed: boolean;
    tree?: string;
  };
  grouping?: Array<{ group_key: string; group_value: string }>;
  ownership?: {
    owner: string;
  };
}

interface NftGalleryProps {
  onMintClick?: () => void;
}

export function NftGallery({ onMintClick }: NftGalleryProps) {
  const { pubkey } = useWalletStore();
  const [assets, setAssets] = useState<NftAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NftAsset | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const rpcUrl = process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';

  const fetchNfts = useCallback(async (isSilent = false) => {
    if (!pubkey) return;

    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'rampfi-nft-gallery',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: pubkey,
            page: 1,
            limit: 100,
            displayOptions: {
              showCollectionMetadata: true,
              showUnverifiedCollections: true,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        // If DAS API is not available (e.g., standard Solana RPC), show helpful message
        if (data.error.message?.includes('Method not found')) {
          setError('NFT Gallery requires Helius RPC. Please configure NEXT_PUBLIC_LAZORKIT_RPC_URL with your Helius endpoint.');
          return;
        }
        throw new Error(data.error.message || 'RPC error');
      }

      const items: NftAsset[] = (data.result?.items || []).filter((item: any) => {
        // Filter to only NFTs (not fungible tokens)
        const isNft = item.interface === 'V1_NFT' || 
                      item.interface === 'ProgrammableNFT' ||
                      item.interface === 'V1_PRINT' ||
                      item.compression?.compressed === true;
        return isNft;
      });

      setAssets(items);
      console.log(`🖼️ NFT Gallery: Found ${items.length} NFTs for ${pubkey.slice(0, 8)}...`);
    } catch (err) {
      console.error('NFT Gallery fetch error:', err);
      setError((err as Error).message || 'Failed to load NFTs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pubkey, rpcUrl]);

  useEffect(() => {
    fetchNfts();
  }, [fetchNfts]);

  const getImageUrl = (nft: NftAsset): string | null => {
    // Try various image sources
    if (nft.content?.links?.image) return nft.content.links.image;
    if (nft.content?.files?.[0]?.cdn_uri) return nft.content.files[0].cdn_uri;
    if (nft.content?.files?.[0]?.uri) return nft.content.files[0].uri;
    if (nft.content?.json_uri) return nft.content.json_uri;
    return null;
  };

  const getName = (nft: NftAsset): string => {
    return nft.content?.metadata?.name || 'Unnamed NFT';
  };

  const getCollection = (nft: NftAsset): string | null => {
    const group = nft.grouping?.find(g => g.group_key === 'collection');
    return group?.group_value || null;
  };

  if (!pubkey) {
    return (
      <div className="text-center py-16 space-y-4">
        <Layers className="h-12 w-12 text-muted-foreground/20 mx-auto" />
        <p className="text-sm text-muted-foreground">Connect your wallet to view your NFT collection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">My Collection</span>
          {assets.length > 0 && (
            <span className="text-[9px] font-bold text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded-full">
              {assets.length} item{assets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchNfts(true)}
          disabled={refreshing}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-xl skeleton" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-10 border border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 space-y-2">
          <p className="text-xs text-amber-400 font-semibold">{error}</p>
          <Button size="sm" variant="ghost" onClick={() => fetchNfts()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && assets.length === 0 && (
        <div className="text-center py-16 space-y-5 border border-dashed border-border/60 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-8 w-8 text-primary/40" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">No NFTs Found</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Mint your first NFT or cNFT to see it appear in your collection.
            </p>
          </div>
          {onMintClick && (
            <Button
              onClick={onMintClick}
              className="bg-primary text-primary-foreground font-bold text-xs rounded-xl px-6 hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Mint Your First NFT
            </Button>
          )}
        </div>
      )}

      {/* NFT Grid */}
      {!loading && assets.length > 0 && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.06 } },
          }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {assets.map((nft) => {
            const imageUrl = getImageUrl(nft);
            const name = getName(nft);
            const isCompressed = nft.compression?.compressed === true;

            return (
              <motion.div
                key={nft.id}
                variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
                onClick={() => setSelectedNft(nft)}
                className="group cursor-pointer"
              >
                <div className="glass-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/25 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                  {/* Image */}
                  <div className="aspect-square bg-muted/10 relative overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Compressed badge */}
                    {isCompressed && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-purple-500/80 text-white text-[8px] font-bold backdrop-blur-sm">
                        cNFT
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <p className="text-[11px] font-bold text-foreground truncate">{name}</p>
                    {nft.content?.metadata?.symbol && (
                      <p className="text-[9px] text-muted-foreground font-mono">{nft.content.metadata.symbol}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedNft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedNft(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              className="premium-raised-card p-6 max-w-md w-full space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{getName(selectedNft)}</h3>
                <button onClick={() => setSelectedNft(null)} className="text-muted-foreground hover:text-foreground transition">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              {getImageUrl(selectedNft) && (
                <div className="rounded-xl overflow-hidden border border-border/30">
                  <img
                    src={getImageUrl(selectedNft)!}
                    alt={getName(selectedNft)}
                    className="w-full object-cover"
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-3">
                {selectedNft.content?.metadata?.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedNft.content.metadata.description}
                  </p>
                )}

                <div className="space-y-2">
                  {selectedNft.content?.metadata?.symbol && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Symbol</span>
                      <span className="font-mono font-bold text-foreground">{selectedNft.content.metadata.symbol}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className={`font-bold ${selectedNft.compression?.compressed ? 'text-purple-400' : 'text-primary'}`}>
                      {selectedNft.compression?.compressed ? 'Compressed NFT' : 'Standard NFT'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Asset ID</span>
                    <span className="font-mono text-foreground/70 text-[10px]">
                      {selectedNft.id.slice(0, 8)}...{selectedNft.id.slice(-8)}
                    </span>
                  </div>
                  {getCollection(selectedNft) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Collection</span>
                      <span className="font-mono text-foreground/70 text-[10px]">
                        {getCollection(selectedNft)!.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <a
                  href={`https://explorer.solana.com/address/${selectedNft.id}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold premium-depth-btn-secondary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on Explorer
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
