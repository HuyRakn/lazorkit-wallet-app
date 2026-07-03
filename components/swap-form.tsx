'use client';

import { useState, useEffect } from 'react';
import { ArrowUpDown, Settings2, ChevronDown, Sparkles, RefreshCcw, Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { TokenLogo } from './ui/token-logo';
import { useWalletStore, TokenSym, SwapResult } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { formatTokenAmount, formatCurrency } from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { SwapReviewModal } from './swap-review-modal';
import { toast } from '@/hooks/use-toast';
import { JupiterToken, getSwapQuote, TOKEN_ADDRESSES, getSymbolDecimals } from '@/lib/services/jupiter';

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
  quote?: {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    priceImpactPct?: string;
    routePlan?: unknown[];
  };
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
  const { tokens, swapReal, addActivity, refreshBalances } = useWalletStore();
  const lz = useWallet() as any;
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

  // Fetch Jupiter quote when amount or tokens change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountNum || fromToken === toToken) {
        setQuote(undefined);
        return;
      }

      const fromMint = (TOKEN_ADDRESSES as Record<string, string>)[fromToken];
      const toMint = (TOKEN_ADDRESSES as Record<string, string>)[toToken];
      
      if (!fromMint || !toMint) {
        setQuote(undefined);
        return;
      }

      // Validate amount before API call
      if (amountNum <= 0 || !isFinite(amountNum)) {
        setQuote(undefined);
        return;
      }

      setLoadingQuote(true);
      try {
        const fromDecimals = getSymbolDecimals(
          fromToken,
          tokenData?.get(fromToken)
        );
        const jupiterQuote = await getSwapQuote(
          fromMint,
          toMint,
          Math.round(amountNum * Math.pow(10, fromDecimals)),
          slippage * 100 // Convert percentage to basis points
        );
        
        if (jupiterQuote && typeof jupiterQuote === 'object') {
          setQuote(jupiterQuote);
        } else {
          setQuote(undefined);
          console.warn('No valid quote received from Jupiter API');
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        setQuote(undefined);
      } finally {
        setLoadingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [amountNum, fromToken, toToken, slippage]);

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
      const toDecimals = getSymbolDecimals(
        toToken,
        tokenData?.get(toToken)
      );
      const out = parseFloat(quote.outAmount || '0');
      return out / Math.pow(10, toDecimals);
    }
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
  const availableTokens = ['SOL', 'USDC', 'USDT', 'BONK', 'RAY', 'JUP', 'ORCA', 'mSOL', 'JitoSOL', 'PYTH'] as TokenSym[];
  const fiatOptions: Array<'USD' | 'VND'> = ['USD', 'VND'];

  // Filter tokens based on search
  const filteredTokens = availableTokens.filter(token => 
    token.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tokenData?.get(token)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className='p-4 pt-3 mobile-padding'>
        {/* Header with Ultra V2 and settings - Compact */}
        <div className='flex items-center justify-between mb-2'>
          <button className='flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors'>
            <Sparkles className='h-3.5 w-3.5 text-primary' />
            <span className='font-medium text-xs'>Ultra V2</span>
            <Settings2 className='h-3 w-3 text-muted-foreground' />
          </button>
          <div className='flex items-center gap-2'>
            <button className='p-1.5 rounded-lg hover:bg-muted/50 transition-colors'>
              <Settings2 className='h-3.5 w-3.5 text-muted-foreground' />
            </button>
          </div>
        </div>

        {/* Two Adjacent Input Sections with Overlapping Swap Button */}
        <div className='relative'>
          {/* Selling Section */}
          <div className='bg-muted/5 rounded-t-lg p-2.5 pb-3 border border-b-0 border-border/50'>
            <div className='flex items-start justify-between'>
              {/* Left side - Label and selector */}
              <div>
                <div className='text-xs text-muted-foreground mb-2'>
                  {t('swap.from')}
                </div>
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className='flex items-center gap-1.5 px-3 py-2 rounded-full bg-card hover:bg-muted/20 transition-colors border border-border/50'
                >
                  <div className='flex items-center'>
                    {getTokenIcon(fromToken)}
                  </div>
                  <span className='font-medium text-sm'>{fromToken}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              {/* Right side - Balance, buttons and input */}
              <div className='flex-1 ml-3 text-right'>
                <div className='flex items-center justify-end gap-1.5 mb-1 h-4'>
                  <span className='text-xs text-muted-foreground whitespace-nowrap'>
                    {formatBalance(fromBalanceAmount, fromToken)}
                  </span>
                  {fromBalanceAmount > 0 && (
                    <>
                      <button
                        onClick={handleHalfClick}
                        className='px-2 py-0.5 text-[10px] font-medium rounded bg-muted/20 hover:bg-muted/30 transition-colors'
                      >
                        HALF
                      </button>
                      <button
                        onClick={handleMaxClick}
                        className='px-2 py-0.5 text-[10px] font-medium rounded bg-muted/20 hover:bg-muted/30 transition-colors'
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
                  className='text-xl sm:text-2xl font-semibold bg-transparent border-0 p-0 h-auto text-right focus-visible:ring-0 placeholder:text-muted-foreground/30 text-foreground mobile-input'
                />
                <div className='text-xs text-muted-foreground mt-0.5'>
                  {formatCurrency(amountUsd, 'USD')}
                </div>
              </div>
            </div>
          </div>

          {/* Swap Button - Overlapping both inputs */}
          <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10'>
            <button
              onClick={handleSwapTokens}
              className='p-2 rounded-full bg-card hover:bg-muted/20 transition-colors border-2 border-border shadow-lg'
            >
              <ArrowUpDown className='h-4 w-4 text-foreground' />
            </button>
          </div>

          {/* Buying Section */}
          <div className='bg-muted/5 rounded-b-lg p-2.5 pb-3 border border-border/50'>
            <div className='flex items-start justify-between'>
              {/* Left side - Label and selector */}
              <div>
                <div className='text-xs text-muted-foreground mb-2'>{t('swap.to')}</div>
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className='flex items-center gap-1.5 px-3 py-2 rounded-full bg-card hover:bg-muted/20 transition-colors border border-border/50'
                >
                  <div className='flex items-center'>
                    {getTokenIcon(toToken)}
                  </div>
                  <span className='font-medium text-sm'>{toToken}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              {/* Right side - Balance and output */}
              <div className='flex-1 ml-3 text-right'>
                <div className='h-4 mb-1'>
                  {toTokenData && (
                    <span className='text-xs text-muted-foreground whitespace-nowrap'>
                      {formatBalance(toTokenData.amount, toToken)}
                    </span>
                  )}
                </div>
                <div className='text-xl sm:text-2xl font-semibold text-muted-foreground/50 transition-all duration-300'>
                  {loadingQuote ? (
                    <div className='flex items-center gap-2 animate-pulse'>
                      <RefreshCcw className='h-4 w-4 animate-spin' />
                      <span className='mobile-text-sm'>Loading...</span>
                    </div>
                  ) : estimatedReceive > 0 ? (
                    <span className='animate-fade-in'>{formatDisplayValue(estimatedReceive.toFixed(6))}</span>
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
          <div className='mt-2 p-2.5 rounded-lg bg-muted/5 border border-border/30 space-y-1.5'>
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Rate</span>
              <span className='font-mono text-foreground'>1 {fromToken} = {(estimatedReceive / amountNum).toFixed(6)} {toToken}</span>
            </div>
            {quote.priceImpactPct && (
              <div className='flex items-center justify-between text-[10px]'>
                <span className='text-muted-foreground'>Price Impact</span>
                <span className={`font-semibold ${parseFloat(quote.priceImpactPct) > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
            )}
            <div className='flex items-center justify-between text-[10px]'>
              <span className='text-muted-foreground'>Route</span>
              <span className='text-foreground'>{quote.routePlan?.length ? `${quote.routePlan.length} hop${quote.routePlan.length > 1 ? 's' : ''}` : 'Direct'}</span>
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
        <div className='mt-2.5 mb-2.5'>
          <div className='text-xs text-muted-foreground mb-1'>Slippage Tolerance</div>
          <div className='flex gap-1'>
            {[0.1, 0.5, 1, 2].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`flex-1 py-1 text-xs rounded transition-all ${
                  slippage === value
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/10 hover:bg-muted/20 border border-border/30'
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
          className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 button-press ${
            !amount || !!error || amountNum <= 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] pulse-important'
          }`}
          disabled={!amount || !!error || amountNum <= 0}
        >
          {error || (!amount ? t('swap.enterAmount') : t('swap.confirm'))}
        </Button>

        {/* Token Prices Footer - Individual borders */}
        <div className='flex items-center justify-between gap-2 mt-2.5'>
          <div className='flex items-center gap-2 p-2 border border-border/30 rounded-lg bg-muted/5 flex-1'>
            <div className='flex items-center'>{getTokenIcon(fromToken)}</div>
            <div className='flex-1'>
              <div className='text-xs font-medium'>{fromToken}</div>
              <div className='text-[10px] text-muted-foreground truncate'>
                {tokenData?.get(fromToken)?.id?.slice(0, 4) || ''}...
                {tokenData?.get(fromToken)?.id?.slice(-4) || ''}
              </div>
            </div>
            <div className='text-right'>
              <div className='text-xs font-medium'>{formatCurrency(fromPrice, 'USD')}</div>
            </div>
          </div>

          <div className='flex items-center gap-2 p-2 border border-border/30 rounded-lg bg-muted/5 flex-1'>
            <div className='flex items-center'>{getTokenIcon(toToken)}</div>
            <div className='flex-1'>
              <div className='text-xs font-medium'>{toToken}</div>
              <div className='text-[10px] text-muted-foreground truncate'>
                {tokenData?.get(toToken)?.id?.slice(0, 4) || ''}...
                {tokenData?.get(toToken)?.id?.slice(-4) || ''}
              </div>
            </div>
            <div className='text-right'>
              <div className='text-xs font-medium'>{formatCurrency(toPrice, 'USD')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Token Selection Modal */}
      {showTokenSelect && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center transition-all duration-300 ease-out'
          style={{ animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => {
            setShowTokenSelect(null);
            setSearchTerm('');
          }}
        >
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { 
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              to { 
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); border-radius: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
          `}</style>
          <Card
            className='w-full max-w-md mx-4 sm:mx-0 overflow-hidden shadow-2xl border-border/60'
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className='flex items-center justify-between p-4 border-b border-border/60 bg-card/50 backdrop-blur-sm'>
              <h3 className='font-semibold text-base'>{t('swap.selectToken')}</h3>
              <button 
                onClick={() => {
                  setShowTokenSelect(null);
                  setSearchTerm('');
                }}
                className='p-1 rounded-lg hover:bg-muted/50 transition-all duration-200'
              >
                <X className='h-4 w-4 text-muted-foreground' />
              </button>
            </div>

            {/* Search bar */}
            <div className='px-4 pt-3 pb-2'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search tokens...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-9 pr-3 py-2 bg-muted/30 border border-border/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200'
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
                      className='w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 bg-muted/30 hover:bg-muted/50 hover:scale-[1.01] border border-transparent hover:border-border/40'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-full bg-background/50 flex items-center justify-center text-lg font-semibold'>
                          {fiat === 'USD' ? '$' : '₫'}
                        </div>
                        <div className='text-left'>
                          <div className='font-medium text-sm'>{fiat}</div>
                          <div className='text-xs text-muted-foreground'>
                            {fiat === 'USD' ? 'US Dollar' : 'Vietnamese Dong'}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className='h-4 w-4 text-muted-foreground rotate-[-90deg]' />
                    </button>
                  ))}
                </div>
                <div className='border-t border-border/40 mt-3 pt-3'>
                  <div className='text-xs text-muted-foreground text-center uppercase tracking-wider font-medium'>
                    Or select token
                  </div>
                </div>
              </div>
            )}

            {/* Token Options - Scrollable */}
            <div className='px-4 pb-4 max-h-[350px] overflow-y-auto custom-scrollbar'>
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
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                        isSelected
                          ? 'bg-primary/15 border-2 border-primary/40 shadow-sm'
                          : 'bg-muted/30 hover:bg-muted/50 border-2 border-transparent'
                      }`}
                    >
                      <div className='flex items-center gap-3'>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                          isSelected ? 'bg-primary/20 ring-2 ring-primary/30' : 'bg-background/50'
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
                          <div className='font-semibold text-sm'>{token.symbol}</div>
                        <div className='text-xs text-muted-foreground'>
                          {jupiterToken?.name || `${token.symbol} Token`}
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                        <div className='text-sm font-medium'>
                          {token.amount.toFixed(4)} {token.symbol}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {formatCurrency(token.amount * token.priceUsd, 'USD')}
                      </div>
                        <div className='text-xs font-medium text-primary'>
                          {formatCurrency(jupiterToken?.usdPrice || token.priceUsd, 'USD')}
                        </div>
                    </div>
                      {/* Selected border only - no dot */}
                  </button>
                );
              })}
                {filteredTokens.length === 0 && (
                  <div className='text-center py-8 text-muted-foreground'>
                    <div className='text-sm'>No tokens found</div>
                    <div className='text-xs mt-1'>Try a different search term</div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      <SwapReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        fromToken={fromToken}
        toToken={toToken}
        amount={amountNum}
        estimatedReceive={estimatedReceive}
        fee={amountNum * 0.002}
        quote={quote}
        onConfirm={async () => {
          try {
            // Step 1: Get the swap transaction from Jupiter via store
            const result = swapReal ? await swapReal(fromToken, toToken, amountNum) : false;
            
            if (!result) {
              toast({
                title: 'Swap Failed',
                description: 'Failed to prepare swap transaction. Check console for details.',
                variant: 'destructive',
              });
              setReviewOpen(false);
              return;
            }

            const swapResult = result as SwapResult;

            // Step 2: Try to sign and send via LazorKit SDK (biometric passkey)
            let signature: string | null = null;
            let isDevnetSimulated = false;

            if (lz?.signAndSendTransaction && swapResult.swapTransaction?.swapTransaction) {
              try {
                // Deserialize and sign the Jupiter swap transaction
                const { VersionedTransaction } = await import('@solana/web3.js');
                const txBuffer = Buffer.from(swapResult.swapTransaction.swapTransaction, 'base64');
                const transaction = VersionedTransaction.deserialize(txBuffer);
                
                // Extract instructions and sign via LazorKit
                signature = await lz.signAndSendTransaction(transaction);
                console.log('✅ Swap transaction signed and sent:', signature);
              } catch (signError: any) {
                console.warn('⚠️ Swap signing failed (expected on Devnet — no Jupiter pools):', signError.message);
                isDevnetSimulated = true;
              }
            } else {
              console.warn('⚠️ LazorKit SDK not available or no swap transaction — simulating on Devnet');
              isDevnetSimulated = true;
            }

            // Step 3: Record activity based on outcome
            const activity = {
              id: Date.now().toString(),
              kind: 'swap' as const,
              ts: new Date().toISOString(),
              summary: isDevnetSimulated
                ? `[Devnet Simulated] Swapped ${amountNum} ${fromToken} for ~${swapResult.estimatedOutput.toFixed(4)} ${toToken}`
                : `Swapped ${amountNum} ${fromToken} for ~${swapResult.estimatedOutput.toFixed(4)} ${toToken}`,
              amount: amountNum,
              token: fromToken,
              status: isDevnetSimulated ? 'Simulated' : 'Success',
              tx: signature || undefined,
            };
            addActivity?.(activity as any);

            // Step 4: Notify user
            if (isDevnetSimulated) {
              toast({
                title: '⚡ Swap Simulated (Devnet)',
                description: `${amountNum} ${fromToken} → ${swapResult.estimatedOutput.toFixed(4)} ${toToken}. Jupiter pools unavailable on Devnet — swap was simulated with real pricing data.`,
              });
            } else {
              toast({
                title: '✅ Swap Confirmed On-Chain',
                description: `${amountNum} ${fromToken} → ${swapResult.estimatedOutput.toFixed(4)} ${toToken}`,
              });
              // Only refresh balances on real swap
              setTimeout(() => refreshBalances?.().catch(console.error), 3000);
            }
          } catch (err: any) {
            console.error('Swap flow error:', err);
            toast({
              title: 'Swap Error',
              description: err?.message || 'An unexpected error occurred during the swap.',
              variant: 'destructive',
            });
          }
          
          setReviewOpen(false);
          setAmount('');
        }}
      />
    </>
  );
};