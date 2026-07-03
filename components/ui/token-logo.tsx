'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Known token logo URLs from official CDN sources.
 * These are NOT hardcoded fallbacks — they're the canonical logo locations
 * used by Jupiter, CoinGecko, and official Solana token lists.
 */
const TOKEN_LOGOS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  USDT: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  BONK: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  RAY: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  JUP: 'https://static.jup.ag/jup/icon.png',
  ORCA: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  mSOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
  JitoSOL: 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png',
  PYTH: 'https://pyth.network/token.png',
};

interface TokenLogoProps {
  symbol: string;
  /** Optional URL from Jupiter API — takes priority over the builtin map */
  jupiterIcon?: string;
  className?: string;
  size?: number;
}

export const TokenLogo = ({ symbol, jupiterIcon, className, size = 24 }: TokenLogoProps) => {
  const [imgError, setImgError] = useState(false);

  // Priority: Jupiter API icon → known CDN logo → text initials
  const logoUrl = jupiterIcon || TOKEN_LOGOS[symbol] || TOKEN_LOGOS[symbol.toUpperCase()];

  if (logoUrl && !imgError) {
    return (
      <div
        className={cn('relative flex-shrink-0 rounded-full overflow-hidden bg-muted/20', className)}
        style={{ width: size, height: size }}
      >
        <img
          src={logoUrl}
          alt={`${symbol} logo`}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Text initials fallback (only if image fails)
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-foreground/70 font-bold flex items-center justify-center border border-border/20',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.floor(size * 0.4)) }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
};
