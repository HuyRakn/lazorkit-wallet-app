'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, ChevronDown, RefreshCcw, Search, X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { TokenLogo } from './ui/token-logo';
import { ViewportModal } from './ui/viewport-modal';
import { useWalletStore, TokenSym } from '@/lib/store/wallet';
import { useWallet, resolveLookupTables } from '@/hooks/use-lazorkit-wallet';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { SwapReviewModal } from './swap-review-modal';
import { toast } from '@/hooks/use-toast';
import { JupiterToken, TOKEN_ADDRESSES, getSymbolDecimals, DEVNET_TRADABLE_TOKENS, defaultConnection } from '@/lib/services/jupiter';
import { getDevnetSwapQuote, buildDevnetSwap, type DevnetSwapQuote, type SerializedInstruction } from '@/lib/services/backend-api';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

const toInstruction = (ix: SerializedInstruction) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: Buffer.from(ix.data, 'base64'),
  });

interface SwapFormProps {
  onPreview?: (data: SwapData) => void;
  tokenData?: Map<string, JupiterToken>;
  className?: string;
  initialFromToken?: TokenSym;
  initialToToken?: TokenSym;
  onSwitchToBuy?: (params: { fiat: 'USD' | 'VND' }) => void;
  onTokenChange?: (token: string) => void;
}

interface SwapData {
  fromToken: TokenSym;
  toToken: TokenSym;
  amount: number;
  slippage: number;
  quote?: DevnetSwapQuote;
  estimatedReceive?: number;
}



export const SwapForm = ({
  onPreview,
  tokenData,
  initialFromToken,
  initialToToken,
  onSwitchToBuy,
  onTokenChange,
}: SwapFormProps) => {
  const { tokens, pubkey, addActivity, refreshBalances } = useWalletStore();
  const lz = useWallet();
  const [fromToken, setFromToken] = useState<TokenSym>(initialFromToken || 'USDC');
  const [toToken, setToToken] = useState<TokenSym>(initialToToken || 'SOL');

  useEffect(() => {
    if (onTokenChange) {
      onTokenChange(toToken);
    }
  }, [toToken, onTokenChange]);

  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState<'from' | 'to' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [quote, setQuote] = useState<SwapData['quote'] | undefined>(undefined);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteCountdown, setQuoteCountdown] = useState(30);
  const [swapDone, setSwapDone] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showTokenSelect) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showTokenSelect]);

  // Sync with provided initial tokens if props change
  useEffect(() => {
    if (initialFromToken) setFromToken(initialFromToken);
  }, [initialFromToken]);

  useEffect(() => {
    if (initialToToken) setToToken(initialToToken);
  }, [initialToToken]);

  const fromTokenData = tokens.find((t) => t.symbol === fromToken);
  const toTokenData = tokens.find((t) => t.symbol === toToken);
  const amountNum = parseFloat(amount) || 0;

  const fromBalanceAmount = fromTokenData?.amount || 0;

  // Auto-refresh countdown for quote expiry
  useEffect(() => {
    if (!quote || !amountNum) { setQuoteCountdown(30); return; }
    setQuoteCountdown(30);
    const iv = setInterval(() => {
      setQuoteCountdown(prev => {
        if (prev <= 1) { setQuoteCountdown(30); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [quote, amountNum]);

  const fromMint = (TOKEN_ADDRESSES as Record<string, string>)[fromToken];
  const fromDecimals = getSymbolDecimals(fromToken, tokenData?.get(fromToken));
  const toRaw = (n: number) => Math.round(n * Math.pow(10, fromDecimals)).toString();

  // Fetch an on-chain quote from the RampFi Raydium CPMM devnet pool
  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      if (!amountNum || fromToken === toToken || !fromMint || amountNum <= 0 || !isFinite(amountNum)) {
        setQuote(undefined);
        return;
      }

      setLoadingQuote(true);
      try {
        const q = await getDevnetSwapQuote(fromMint, toRaw(amountNum), slippage * 100);
        if (!cancelled) setQuote(q);
      } catch (error) {
        console.error('Error fetching devnet pool quote:', error);
        if (!cancelled) setQuote(undefined);
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 400); // Debounce
    // Re-quote every 30s against fresh pool reserves
    const refreshId = setInterval(fetchQuote, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearInterval(refreshId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum, fromToken, toToken, slippage, fromMint, fromDecimals]);

  // Get token icon — delegates to TokenLogo with optional Jupiter API icon
  const getTokenIcon = (symbol: string, size: number = 20) => {
    const jupIcon = tokenData?.get(symbol)?.icon;
    return <TokenLogo symbol={symbol} jupiterIcon={jupIcon} size={size} />;
  };

  // Get price from Jupiter data or fallback to local data
  const getTokenPrice = (symbol: string) => {
    const jupiterToken = tokenData?.get(symbol);
    if (jupiterToken?.usdPrice) {
      return jupiterToken.usdPrice;
    }
    const localToken = tokens.find((t) => t.symbol === symbol);
    return localToken?.priceUsd || 0;
  };

  // Calculate estimated receive amount
  const fromPrice = getTokenPrice(fromToken);
  const toPrice = getTokenPrice(toToken);
  
  // Use Jupiter quote if available, otherwise fallback to simple calculation
  const estimatedReceive = (() => {
    if (quote) {
      const out = parseFloat(quote.outAmount || '0');
      return out / Math.pow(10, quote.outDecimals);
    }
    if (!toPrice) return 0;
    return amountNum * (fromPrice / toPrice) * (1 - slippage / 100);
  })();
  
  const amountUsd = amountNum * fromPrice;

  const validateForm = () => {
    if (!amount || amountNum <= 0) {
      setError(t('notifications.enterValidAmount'));
      return false;
    }

    if (fromToken === toToken) {
      setError(t('swap.sameToken'));
      return false;
    }

    if (amountNum > fromBalanceAmount) {
      setError(t('swap.insufficientBalance'));
      return false;
    }

    setError('');
    return true;
  };

  const handlePreview = () => {
    if (!validateForm()) return;

    const data: SwapData = {
      fromToken,
      toToken,
      amount: amountNum,
      slippage,
      quote,
      estimatedReceive,
    };

    onPreview?.(data);
    setReviewOpen(true);
  };

  const handleMaxClick = () => {
    // Use an approximate, trimmed representation to avoid overly long decimals
    const approx = Math.round(fromBalanceAmount * 1e6) / 1e6;
    setAmount(approx.toString());
    setError('');
  };

  const handleHalfClick = () => {
    const half = fromBalanceAmount / 2;
    const approx = Math.round(half * 1e6) / 1e6;
    setAmount(approx.toString());
    setError('');
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmount('');
    setError('');
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    setAmount(value);
    setError('');
  };

  // Format display value with commas
  const formatDisplayValue = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Format balance with 2 decimals and token symbol
  const formatBalance = (amount: number, symbol: TokenSym) => {
    if (amount === 0) return `0.00 ${symbol}`;
    if (amount < 0.01) return `<0.01 ${symbol}`;
    return `${amount.toFixed(2)} ${symbol}`;
  };

  // Get available tokens that we have data for
  // Only tokens with real devnet liquidity (RampFi Raydium CPMM pool: SOL ↔ rUSDC)
  const availableTokens = [...DEVNET_TRADABLE_TOKENS] as TokenSym[];
  const fiatOptions: Array<'USD' | 'VND'> = ['USD', 'VND'];

  // Filter tokens based on search
  const filteredTokens = availableTokens.filter(token => 
    token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tokenData?.get(token)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className='space-y-4'>
        {/* Header with Pool Status & Slippage */}
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20'>
            <span className='w-1.5 h-1.5 rounded-full bg-primary animate-pulse' />
            <span className='font-bold text-[11px] text-primary tracking-wide'>Raydium CPMM</span>
            <span className='text-[10px] text-muted-foreground font-mono border-l border-white/10 pl-1.5'>0% Gas</span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono font-bold text-muted-foreground'>
              Max Slippage {slippage}%
            </span>
          </div>
        </div>

        {/* Two Adjacent Input Sections with Overlapping Swap Button */}
        <div className='relative rounded-2xl overflow-hidden border border-white/10 premium-depth-inset bg-black/20'>
          {/* Selling Section */}
          <div className='p-5 pb-6 bg-white/[0.01]/10 hover:bg-white/[0.02] transition-colors border-b border-white/10'>
            <div className='flex items-start justify-between'>
              {/* Left side - Label and selector */}
              <div>
                <div className='text-xs text-muted-foreground mb-2'>
                  {t('swap.from')}
                </div>
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl premium-depth-btn-secondary border border-white/10'
                >
                  <div className='flex items-center'>
                    {getTokenIcon(fromToken)}
                  </div>
                  <span className='font-bold text-xs text-white'>{fromToken}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              {/* Right side - Balance, buttons and input */}
              <div className='flex-1 ml-3 text-right'>
                <div className='flex items-center justify-end gap-1.5 mb-1 h-4'>
                  <span className='text-[10px] text-muted-foreground font-medium whitespace-nowrap'>
                    {formatBalance(fromBalanceAmount, fromToken)}
                  </span>
                  {fromBalanceAmount > 0 && (
                    <>
                      <button
                        onClick={handleHalfClick}
                        className='px-2 py-0.5 text-[9px] font-black rounded bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition'
                      >
                        HALF
                      </button>
                      <button
                        onClick={handleMaxClick}
                        className='px-2 py-0.5 text-[9px] font-black rounded bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition'
                      >
                        MAX
                      </button>
                    </>
                  )}
                </div>
                <Input
                  type='text'
                  inputMode='decimal'
                  placeholder='0.00'
                  value={formatDisplayValue(amount)}
                  onChange={(e) =>
                    handleAmountChange(e.target.value.replace(/,/g, ''))
                  }
                  className='text-xl sm:text-2xl font-black bg-transparent border-0 p-0 h-auto text-right focus-visible:ring-0 placeholder:text-muted-foreground/20 text-white mobile-input'
                />
                <div className='text-xs text-muted-foreground mt-0.5 font-medium'>
                  {formatCurrency(amountUsd, 'USD')}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Swap Button - Cosmic 3D Depth Overlap */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 450, damping: 22 }}
              onClick={handleSwapTokens}
              className="p-3 rounded-full bg-background border-2 border-white/10 text-white shadow-lg hover:border-primary cursor-pointer active:scale-95 flex items-center justify-center"
            >
              <ArrowUpDown className="h-4.5 w-4.5 text-primary" />
            </motion.button>
          </div>

          {/* Buying Section */}
          <div className='p-5 pt-6 pb-6 bg-white/[0.03] hover:bg-white/[0.04] transition-colors'>
            <div className='flex items-start justify-between'>
              {/* Left side - Label and selector */}
              <div>
                <div className='text-xs text-muted-foreground mb-2'>{t('swap.to')}</div>
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl premium-depth-btn-secondary border border-white/10'
                >
                  <div className='flex items-center'>
                    {getTokenIcon(toToken)}
                  </div>
                  <span className='font-bold text-xs text-white'>{toToken}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              {/* Right side - Balance and output */}
              <div className='flex-1 ml-3 text-right'>
                <div className='h-4 mb-1'>
                  {toTokenData && (
                    <span className='text-[10px] text-muted-foreground font-medium whitespace-nowrap'>
                      {formatBalance(toTokenData.amount, toToken)}
                    </span>
                  )}
                </div>
                <div className='text-xl sm:text-2xl font-semibold text-white/50 transition-all duration-300'>
                  {loadingQuote ? (
                    <div className='flex items-center gap-2 justify-end animate-pulse'>
                      <RefreshCcw className='h-4 w-4 animate-spin' />
                      <span className='mobile-text-sm'>Loading...</span>
                    </div>
                  ) : estimatedReceive > 0 ? (
                    <span className='animate-fade-in text-white'>{formatDisplayValue(estimatedReceive.toFixed(6))}</span>
                  ) : (
                    '0.00'
                  )}
                </div>
                <div className='text-xs text-muted-foreground mt-0.5'>
                  {formatCurrency(estimatedReceive * toPrice, 'USD')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Info Bar */}
        {quote && amountNum > 0 && (
          <div className='mt-3 p-3 rounded-xl bg-background/20 border border-border/10 space-y-1.5'>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Rate</span>
              <span className='font-mono text-white'>1 {fromToken} = {(estimatedReceive / amountNum).toFixed(6)} {toToken}</span>
            </div>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Price Impact</span>
              <span className={`font-semibold ${quote.priceImpactPct > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {quote.priceImpactPct < 0.01 ? '<0.01' : quote.priceImpactPct.toFixed(2)}%
              </span>
            </div>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Route</span>
              <span className='text-white'>Raydium CPMM (devnet)</span>
            </div>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Gas Fee</span>
              <span className='text-emerald-400 font-semibold'>Sponsored (Free)</span>
            </div>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Quote Refresh</span>
              <span className='font-mono text-muted-foreground/60'>{quoteCountdown}s</span>
            </div>
          </div>
        )}

        {/* Slippage Settings */}
        <div className='mt-3.5 mb-3.5'>
          <div className='text-xs text-muted-foreground mb-1.5 font-bold uppercase tracking-wider text-[10px]'>Slippage Tolerance</div>
          <div className='flex gap-1.5'>
            {[0.1, 0.5, 1, 2].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  slippage === value
                    ? 'premium-depth-btn text-[11px]'
                    : 'premium-depth-btn-secondary text-[11px]'
                }`}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handlePreview}
          className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider ${
            !amount || !!error || amountNum <= 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'premium-depth-btn'
          }`}
          disabled={!amount || !!error || amountNum <= 0}
        >
          {error || (!amount ? t('swap.enterAmount') : t('swap.confirm'))}
        </Button>

        {/* Token Prices Footer - Flat Row */}
        <div className='flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border/10'>
          <div className='flex items-center gap-2 flex-1'>
            <div className='flex items-center'>{getTokenIcon(fromToken, 18)}</div>
            <div className='flex-1 min-w-0'>
              <div className='text-[11px] font-bold text-white'>{fromToken}</div>
              <div className='text-[9px] text-muted-foreground truncate'>
                {tokenData?.get(fromToken)?.id?.slice(0, 4) || ''}...
                {tokenData?.get(fromToken)?.id?.slice(-4) || ''}
              </div>
            </div>
            <div className='text-right shrink-0'>
              <div className='text-[11px] font-bold text-white'>{formatCurrency(fromPrice, 'USD')}</div>
            </div>
          </div>

          <div className='flex items-center gap-2 flex-1'>
            <div className='flex items-center'>{getTokenIcon(toToken, 18)}</div>
            <div className='flex-1 min-w-0'>
              <div className='text-[11px] font-bold text-white'>{toToken}</div>
              <div className='text-[9px] text-muted-foreground truncate'>
                {tokenData?.get(toToken)?.id?.slice(0, 4) || ''}...
                {tokenData?.get(toToken)?.id?.slice(-4) || ''}
              </div>
            </div>
            <div className='text-right shrink-0'>
              <div className='text-[11px] font-bold text-white'>{formatCurrency(toPrice, 'USD')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Token Selection Modal using ViewportModal */}
      <ViewportModal
        open={showTokenSelect !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowTokenSelect(null);
            setSearchTerm('');
          }
        }}
        title={t('swap.selectToken')}
        className="max-w-md"
      >
        {/* Search bar */}
        <div className='px-4 pt-4 pb-2'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <input
              type='text'
              placeholder='Search tokens...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-white'
            />
          </div>
        </div>

        {/* Fiat options to switch back to Buy (only for 'from' selection) */}
        {showTokenSelect === 'from' && (
          <div className='px-4 pb-3'>
            <div className='space-y-1.5'>
              {fiatOptions.map((fiat, index) => (
                <button
                  key={`fiat-${fiat}`}
                  onClick={() => {
                    setShowTokenSelect(null);
                    setSearchTerm('');
                    onSwitchToBuy?.({ fiat });
                  }}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className='w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 bg-white/5 hover:bg-white/10 hover:scale-[1.01] border border-white/5'
                >
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-lg font-bold text-white'>
                      {fiat === 'USD' ? '$' : '₫'}
                    </div>
                    <div className='text-left'>
                      <div className='font-bold text-sm text-white'>{fiat}</div>
                      <div className='text-xs text-muted-foreground'>
                        {fiat === 'USD' ? 'US Dollar' : 'Vietnamese Dong'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className='h-4 w-4 text-muted-foreground rotate-[-90deg]' />
                </button>
              ))}
            </div>
            <div className='border-t border-white/10 mt-4 pt-3'>
              <div className='text-[10px] text-muted-foreground text-center uppercase tracking-wider font-extrabold'>
                Or select token
              </div>
            </div>
          </div>
        )}

        {/* Token Options - Scrollable */}
        <div className='px-4 pb-4 max-h-[300px] overflow-y-auto custom-scrollbar'>
          <div className='space-y-1.5'>
            {filteredTokens.map((tokenSymbol, index) => {
              const token = tokens.find((t) => t.symbol === tokenSymbol);
              const jupiterToken = tokenData?.get(tokenSymbol);
              const isSelected = (showTokenSelect === 'from' && tokenSymbol === fromToken) ||
                               (showTokenSelect === 'to' && tokenSymbol === toToken);

              if (!token) return null;

              return (
                <button
                  key={token.symbol}
                  onClick={() => {
                    if (showTokenSelect === 'from') {
                      setFromToken(token.symbol);
                    } else {
                      setToToken(token.symbol);
                    }
                    setShowTokenSelect(null);
                    setSearchTerm('');
                  }}
                  style={{ animationDelay: `${index * 30}ms` }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden relative ${
                      isSelected ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-slate-900'
                    }`}>
                      {jupiterToken?.icon ? (
                        <img
                          src={jupiterToken.icon}
                          alt={token.symbol}
                          className='w-full h-full object-cover rounded-full'
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const next = e.currentTarget.nextSibling as HTMLElement;
                            if (next) next.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={jupiterToken?.icon ? 'hidden' : ''}>
                        <TokenLogo symbol={token.symbol} size={24} />
                      </div>
                    </div>
                    <div className='text-left'>
                      <div className='font-bold text-sm text-white'>{token.symbol}</div>
                      <div className='text-xs text-muted-foreground'>
                        {jupiterToken?.name || `${token.symbol} Token`}
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='text-sm font-extrabold text-white'>
                      {token.amount.toFixed(4)} {token.symbol}
                    </div>
                    <div className='text-[10px] text-muted-foreground'>
                      {formatCurrency(token.amount * token.priceUsd, 'USD')}
                    </div>
                    <div className='text-[10px] font-bold text-primary'>
                      {formatCurrency(jupiterToken?.usdPrice || token.priceUsd, 'USD')}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredTokens.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>
                <div className='text-sm font-bold'>No tokens found</div>
                <div className='text-xs mt-1'>Try a different search term</div>
              </div>
            )}
          </div>
        </div>
      </ViewportModal>

      <SwapReviewModal
        open={reviewOpen}
        onOpenChange={(v) => {
          setReviewOpen(v);
          if (!v && swapDone) {
            setAmount('');
            setSwapDone(false);
          }
        }}
        fromToken={fromToken}
        toToken={toToken}
        amount={amountNum}
        estimatedReceive={estimatedReceive}
        fee={quote ? Number(quote.feeAmount) / Math.pow(10, quote.inDecimals) : 0}
        quote={quote}
        onConfirm={async () => {
          const owner = lz.address || pubkey;
          if (!owner || !lz.signAndSendTransaction) {
            throw new Error('Connect your passkey wallet before swapping.');
          }
          if (!fromMint) throw new Error(`Unsupported token ${fromToken}`);

          try {
            // 1. Backend builds Raydium CPMM swap instructions for the vault (fresh reserves)
            const built = await buildDevnetSwap(owner, fromMint, toRaw(amountNum), slippage * 100);
            const instructions = built.instructions.map(toInstruction);
            const outUi = Number(built.quote.outAmount) / Math.pow(10, built.quote.outDecimals);

            // 2. Passkey signs; LazorKit paymaster sponsors the fee. The pool's lookup table
            //    keeps the wrapped transaction in one packet (else the hook defers it).
            const tables = await resolveLookupTables(built.lookupTables);
            const signature = await lz.signAndSendTransaction(
              instructions,
              tables.length ? { addressLookupTableAccounts: tables } : undefined,
            );

            // 3. Wait for confirmation so balances reflect the swap
            try {
              const latest = await defaultConnection.getLatestBlockhash('confirmed');
              await defaultConnection.confirmTransaction({ signature, ...latest }, 'confirmed');
            } catch (confirmErr) {
              console.warn('Swap sent, confirmation pending:', confirmErr);
            }

            addActivity?.({
              id: signature,
              kind: 'swap',
              ts: new Date().toISOString(),
              summary: `Swapped ${amountNum} ${fromToken} → ${outUi.toFixed(6)} ${toToken} (Raydium devnet)`,
              amount: amountNum,
              token: fromToken,
              status: 'Success',
              txSignature: signature,
            } as any);

            toast({
              title: 'Swap confirmed on-chain',
              description: `${amountNum} ${fromToken} → ${outUi.toFixed(6)} ${toToken}`,
            });
            setSwapDone(true);
            refreshBalances?.().catch(console.error);
            setTimeout(() => refreshBalances?.().catch(console.error), 4000);
            return signature;
          } catch (err: any) {
            console.error('Swap flow error:', err);
            toast({
              title: 'Swap failed',
              description: err?.message || 'An unexpected error occurred during the swap.',
              variant: 'destructive',
            });
            throw err;
          }
        }}
      />
    </>
  );
};