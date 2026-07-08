'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, ChevronDown, Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TokenLogo } from './ui/token-logo';
import { ViewportModal } from './ui/viewport-modal';
import { OnRampPreviewModal } from './onramp-preview-modal';
import { createWhateeOrder } from '@/lib/services/payment';
import { Payment_js_src } from '@/lib/config/payment';
import { useRouter } from 'next/navigation';
import {
  useWalletStore,
  Fiat,
  TokenSym,
} from '@/lib/store/wallet';
import {
  formatCurrency,
  convertCurrency,
  validateAmount,
  generateOrderId,
} from '@/lib/utils/format';
import { t } from '@/lib/i18n';
import { JupiterToken, TOKEN_ADDRESSES } from '@/lib/services/jupiter';
import { useWallet } from '@/hooks/use-lazorkit-wallet';

interface OnRampFormProps {
  onPreview?: (data: OnRampData) => void;
  tokenData?: Map<string, JupiterToken>;
  onSwitchToSwap?: (params: { fromToken: TokenSym; toToken?: TokenSym }) => void;
  initialFromCurrency?: Fiat;
  onTokenChange?: (token: string) => void;
}

interface OnRampData {
  fromCurrency: Fiat;
  toToken: TokenSym;
  amount: number;
}

const currencyIcons: Record<Fiat, string> = {
  USD: '$',
  VND: '₫',
};


export const OnRampForm = ({ onPreview, tokenData, onSwitchToSwap, initialFromCurrency, onTokenChange }: OnRampFormProps) => {
  const { rateUsdToVnd } = useWalletStore();
  const wallet = useWallet() as any;
  const router = useRouter();
  
  const [fromCurrency, setFromCurrency] = useState<Fiat>(initialFromCurrency || 'USD');
  const [toToken, setToToken] = useState<TokenSym>('USDC');

  useEffect(() => {
    if (onTokenChange) {
      onTokenChange(toToken);
    }
  }, [toToken, onTokenChange]);
  const [amount, setAmount] = useState('');
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [passkeyDataRef, setPasskeyDataRef] = useState<any>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showCurrencySelect || showTokenSelect) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCurrencySelect, showTokenSelect]);

  const amountNum = parseFloat(amount.replace(/,/g, '')) || 0;
  const amountUsd =
    fromCurrency === 'USD'
      ? amountNum
      : convertCurrency(amountNum, 'VND', 'USD', rateUsdToVnd);

  const tokenJupiterData = tokenData?.get(toToken);
  // Use Jupiter live price data → fallback to known stablecoin prices → zero
  const tokenPrice = tokenJupiterData?.usdPrice 
    || (toToken === 'USDC' || toToken === 'USDT' ? 1.0 : 0);
  const estimatedReceive = amountUsd / tokenPrice;

  const quickAmounts = [50, 100, 200, 500];

  const ICON_OVERRIDES: Partial<Record<TokenSym, string>> = {
    USDC: 'https://assets.coingecko.com/coins/images/6319/standard/USD_Coin_icon.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  };
  const ICON_FALLBACK_2: Partial<Record<TokenSym, string>> = {
    USDC: 'https://assets.coingecko.com/coins/images/6319/standard/USD_Coin_icon.png',
    USDT: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
  };

  const getTokenIcon = (symbol: string) => {
    const token = tokenData?.get(symbol);
    const override = ICON_OVERRIDES[symbol as TokenSym];
    return (
      <div className='relative w-5 h-5'>
        <TokenLogo symbol={symbol} size={20} />
        {(token?.icon || override) && (
          <img
            src={(token?.icon as string) || override!}
            alt={symbol}
            className='absolute inset-0 w-full h-full rounded-full'
            data-fallback={ICON_FALLBACK_2[symbol as TokenSym] || ''}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              const next = img.getAttribute('data-fallback');
              if (next) {
                img.setAttribute('data-fallback', '');
                img.src = next;
              } else {
                img.style.display = 'none';
              }
            }}
          />
        )}
      </div>
    );
  };

  const validateForm = () => {
    if (!amount || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (!validateAmount(amountUsd)) {
      if (amountUsd < 20) {
        setError(t('onRamp.amountTooLow'));
      } else {
        setError(t('onRamp.amountTooHigh'));
      }
      return false;
    }

    setError('');
    return true;
  };

  const handlePreview = async () => {
    if (!validateForm()) return;

    try {
      setIsCreatingOrder(true);

      // Bước 1: Tạo passkey để xác thực (giữ nguyên để tạo order sau này)
      console.log('🔐 Requesting passkey authentication...');
      if (!wallet?.connectPasskey) {
        throw new Error('Passkey creation not available');
      }
      
      const passkeyData = await wallet.connectPasskey();
      console.log('✅ Passkey authenticated:', {
        credentialId: passkeyData?.credentialId,
        hasSmartWalletAddress: Boolean(passkeyData?.smartWalletAddress),
        smartWalletAddress: passkeyData?.smartWalletAddress
      });
      
      if (!passkeyData) {
        throw new Error('Failed to get passkey data');
      }
      
      // KHÔNG LƯU localStorage - sẽ gửi trực tiếp vào order
      setPasskeyDataRef(passkeyData);

      // Bước 2: Mở preview modal
      // Không tạo smart wallet tại đây nữa trong luồng mới (đã chuyển sang /auth)
      const data: OnRampData = {
        fromCurrency,
        toToken,
        amount: amountUsd,
      };

      console.log('✅ Opening preview with passkey data');
      onPreview?.(data);
      setPreviewOpen(true);
      
    } catch (error: any) {
      console.error('❌ Error in handlePreview:', error);
      setError(error.message || 'Failed to prepare wallet');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleAmountChange = (value: string) => {
    const cleanValue = value.replace(/,/g, '');
    if (cleanValue && !/^\d*\.?\d*$/.test(cleanValue)) return;
    setAmount(cleanValue);
    setSelectedQuickAmount(null);
    setError('');
  };

  const handleQuickAmountClick = (usdAmount: number) => {
    const fiatAmount = fromCurrency === 'USD' ? usdAmount : usdAmount * rateUsdToVnd;
    setAmount(fiatAmount.toString());
    setSelectedQuickAmount(usdAmount);
    setError('');
  };

  const formatDisplayValue = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const allTokens: TokenSym[] = ['SOL','USDC','USDT','BONK','RAY','JUP','ORCA','mSOL','JitoSOL','PYTH'];
  const filteredTokens = allTokens.filter(token => 
    token.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className='space-y-4'>
        <div className='flex items-center justify-between mb-2'>
          <div className='text-sm font-medium'>{t('onRamp.title')}</div>
          <button className='p-1.5 rounded-lg hover:bg-muted/50 transition-colors'>
            <Settings2 className='h-3.5 w-3.5 text-muted-foreground' />
          </button>
        </div>

        <div className='relative rounded-2xl overflow-hidden border border-white/10 premium-depth-inset bg-black/20'>
          {/* Paying Section */}
          <div className='p-5 pb-6 bg-white/[0.01]/10 hover:bg-white/[0.02] transition-colors border-b border-white/10'>
            <div className='flex items-start justify-between'>
              <div>
                <div className='text-xs text-muted-foreground mb-2'>{t('onRamp.paying')}</div>
                <button
                  onClick={() => setShowCurrencySelect(true)}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl premium-depth-btn-secondary border border-white/10'
                >
                  <span className='text-sm text-primary font-black'>
                    {currencyIcons[fromCurrency]}
                  </span>
                  <span className='font-bold text-xs text-white'>{fromCurrency}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              <div className='flex-1 ml-3 text-right'>
                <div className='mb-1'>
                  <span className='text-[10px] text-muted-foreground font-medium'>
                    {fromCurrency === 'VND' ? t('onRamp.minAmount') + ' • ' + t('onRamp.maxAmount') : `${t('onRamp.minAmount')} • ${t('onRamp.maxAmount')}`}
                  </span>
                </div>
                <Input
                  type='text'
                  inputMode='decimal'
                  placeholder={fromCurrency === 'VND' ? '1,000,000' : '100.00'}
                  value={formatDisplayValue(amount)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className='text-xl sm:text-2xl font-black bg-transparent border-0 p-0 h-auto text-right focus-visible:ring-0 placeholder:text-muted-foreground/20 text-white mobile-input'
                />
                <div className='text-xs text-muted-foreground mt-0.5 font-medium'>
                  {fromCurrency === 'VND'
                    ? `≈ ${amountUsd.toFixed(2)}`
                    : `≈ ${(amountNum * rateUsdToVnd).toLocaleString()} ₫`}
                </div>
              </div>
            </div>
          </div>

          {/* Receiving Section */}
          <div className='p-5 pt-6 pb-6 bg-white/[0.03] hover:bg-white/[0.04] transition-colors'>
            <div className='flex items-start justify-between'>
              <div>
                <div className='text-xs text-muted-foreground mb-2'>
                  {t('onRamp.receiving')}
                </div>
                <button
                  onClick={() => setShowTokenSelect(true)}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl premium-depth-btn-secondary border border-white/10'
                >
                  <div className='flex items-center'>
                    {getTokenIcon(toToken)}
                  </div>
                  <span className='font-bold text-xs text-white'>{toToken}</span>
                  <ChevronDown className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>

              <div className='flex-1 ml-3 text-right'>
                <div className='mb-1'>
                  <span className='text-[10px] text-muted-foreground font-medium'>
                    {t('common.price')}: 1 {toToken} = ${tokenPrice?.toFixed(2) || '1.00'}
                  </span>
                </div>
                <div className='text-xl sm:text-2xl font-semibold text-white/50'>
                  {estimatedReceive > 0
                    ? formatDisplayValue(estimatedReceive.toFixed(6))
                    : '0.000000'}
                </div>
                <div className='text-xs text-muted-foreground mt-0.5 font-medium'>
                  ≈ ${(estimatedReceive * tokenPrice).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-3.5 mb-3.5'>
          <div className='text-xs text-muted-foreground mb-1.5 font-bold uppercase tracking-wider text-[10px]'>{t('onRamp.quickAmount')}</div>
          <div className='flex gap-1.5'>
            {quickAmounts.map((usdAmount) => {
              const isSelected =
                selectedQuickAmount === usdAmount &&
                (fromCurrency === 'USD'
                  ? amountNum === usdAmount
                  : Math.abs(amountNum - usdAmount * rateUsdToVnd) < 1);

              return (
                <button
                  key={usdAmount}
                  onClick={() => handleQuickAmountClick(usdAmount)}
                  className={`flex-1 py-1.5 px-1 text-xs font-bold rounded-lg transition-all ${
                    isSelected
                      ? 'premium-depth-btn text-[11px]'
                      : 'premium-depth-btn-secondary text-[11px]'
                  }`}
                >
                  ${usdAmount}
                </button>
              );
            })}
          </div>
          {fromCurrency === 'VND' && (
            <div className='text-[10px] text-muted-foreground text-center mt-1'>
              {t('onRamp.usdConvertedHint')}
            </div>
          )}
        </div>

        <Button
          onClick={handlePreview}
          className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider ${
            !amount || !!error || amountNum <= 0 || isCreatingOrder
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'premium-depth-btn'
          }`}
          disabled={!amount || !!error || amountNum <= 0 || isCreatingOrder}
        >
          {isCreatingOrder ? 'Preparing...' : (error || (!amount ? t('onRamp.enterAmount') : t('common.next')))}
        </Button>

        <div className='text-center mt-2.5'>
          <div className='text-[10px] text-muted-foreground'>
            {t('onRamp.exchangeRate')}: 1 USD = {rateUsdToVnd.toLocaleString()} VND
          </div>
        </div>
      </div>

      {/* Enhanced Currency Selection Modal using ViewportModal */}
      <ViewportModal
        open={showCurrencySelect}
        onOpenChange={setShowCurrencySelect}
        title={t('onRamp.selectCurrency')}
        className="max-w-md"
      >
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

        <div className='p-4 space-y-1.5'>
          {(['VND', 'USD'] as Fiat[]).map((currency, index) => (
            <button
              key={currency}
              onClick={() => {
                setFromCurrency(currency);
                setShowCurrencySelect(false);
                setAmount('');
                setSelectedQuickAmount(null);
              }}
              style={{ animationDelay: `${index * 50}ms` }}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 hover:scale-[1.01] ${
                currency === fromCurrency
                  ? 'bg-primary/10 border border-primary/30 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 border border-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold ${
                currency === fromCurrency ? 'bg-primary/20 text-primary' : 'bg-slate-900 text-white'
              }`}>
                {currencyIcons[currency]}
              </div>
              <div className='flex-1 text-left'>
                <div className='font-bold text-sm text-white'>{currency}</div>
                <div className='text-xs text-muted-foreground'>
                  {currency === 'VND' ? 'Vietnamese Dong' : 'US Dollar'}
                </div>
              </div>
              {currency === fromCurrency && (
                <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                  <div className='w-2 h-2 rounded-full bg-slate-950' />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className='px-4 py-2'>
          <div className='border-t border-white/10 relative'>
            <div className='absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 bg-slate-950'>
              <span className='text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold'>
                {t('swap.selectToken')}
              </span>
            </div>
          </div>
        </div>

        <div className='px-4 pb-4 max-h-[250px] overflow-y-auto custom-scrollbar'>
          <div className='space-y-1'>
            {filteredTokens.map((sym, index) => {
              const jup = tokenData?.get(sym);
              return (
                <button
                  key={`fiat-to-token-${sym}`}
                  onClick={() => {
                    setShowCurrencySelect(false);
                    setSearchTerm('');
                    onSwitchToSwap?.({ fromToken: sym });
                  }}
                  style={{ animationDelay: `${index * 30}ms` }}
                  className='w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 bg-white/5 hover:bg-white/10 hover:scale-[1.01] border border-white/5'
                >
                  <div className='w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center relative overflow-hidden'>
                    <TokenLogo symbol={sym} size={22} />
                    {(jup?.icon || ICON_OVERRIDES[sym]) && (
                      <img
                        src={(jup?.icon as string) || ICON_OVERRIDES[sym]!}
                        alt={sym}
                        className='absolute inset-0 w-full h-full rounded-full object-cover'
                        data-fallback={ICON_FALLBACK_2[sym] || ''}
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          const next = img.getAttribute('data-fallback');
                          if (next) {
                            img.setAttribute('data-fallback', '');
                            img.src = next;
                          } else {
                            img.style.display = 'none';
                          }
                        }}
                      />
                    )}
                  </div>
                  <div className='flex-1 text-left'>
                    <div className='font-bold text-sm text-white'>{sym}</div>
                    <div className='text-[10px] text-muted-foreground'>
                      {jup?.name || 'Token'}
                    </div>
                  </div>
                  <ChevronDown className='h-4 w-4 text-muted-foreground rotate-[-90deg]' />
                </button>
              );
            })}
          </div>
        </div>
      </ViewportModal>

      {/* Enhanced Token Selection Modal using ViewportModal */}
      <ViewportModal
        open={showTokenSelect}
        onOpenChange={setShowTokenSelect}
        title={t('onRamp.selectToken')}
        className="max-w-md"
      >
        <div className='p-4 space-y-1.5'>
          {(['USDC', 'SOL', 'USDT'] as TokenSym[]).map((token, index) => {
            const jupiterToken = tokenData?.get(token);
            const override = ICON_OVERRIDES[token];
            return (
              <button
                key={token}
                onClick={() => {
                  setToToken(token);
                  setShowTokenSelect(false);
                }}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 hover:scale-[1.01] ${
                  token === toToken
                    ? 'bg-primary/10 border border-primary/30 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 border border-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden relative ${
                  token === toToken ? 'bg-primary/20 ring-1 ring-primary/30' : 'bg-slate-900'
                }`}>
                  <TokenLogo symbol={token} size={24} />
                  {(jupiterToken?.icon || override) && (
                    <img
                      src={(jupiterToken?.icon as string) || override!}
                      alt={token}
                      className='absolute inset-0 w-full h-full rounded-full object-cover'
                      data-fallback={ICON_FALLBACK_2[token] || ''}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        const next = img.getAttribute('data-fallback');
                        if (next) {
                          img.setAttribute('data-fallback', '');
                          img.src = next;
                        } else {
                          img.style.display = 'none';
                        }
                      }}
                    />
                  )}
                </div>
                <div className='flex-1 text-left'>
                  <div className='font-bold text-sm text-white'>{token}</div>
                  {(
                    jupiterToken?.id ||
                    (TOKEN_ADDRESSES as Record<string, string>)[token]
                  ) && (
                    <div className='text-[10px] text-muted-foreground font-mono'>
                      {(
                        (jupiterToken?.id || (TOKEN_ADDRESSES as Record<string, string>)[token]) as string
                      ).slice(0, 4)}...
                      {(
                        (jupiterToken?.id || (TOKEN_ADDRESSES as Record<string, string>)[token]) as string
                      ).slice(-4)}
                    </div>
                  )}
                </div>
                {token === toToken && (
                  <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                    <div className='w-2 h-2 rounded-full bg-slate-950' />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ViewportModal>

      <OnRampPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        data={{ fromCurrency, toToken, amount: amountUsd }}
        onConfirm={async () => {
          try {
            setIsCreatingOrder(true);
            
            const passkeyData = passkeyDataRef;
            if (!passkeyData) throw new Error('No passkey data found. Please try again.');

            if (typeof window !== 'undefined' && !document.querySelector(`script[src="${Payment_js_src}"]`)) {
              const s = document.createElement('script');
              s.src = Payment_js_src;
              s.async = true;
              document.body.appendChild(s);
            }

            const subtotal = Number(amountUsd.toFixed(2));
            const fee = 1.00; // Fixed $1 fee for all transactions
            const network = 0.00; // No network fee
            const total = Number((subtotal + fee).toFixed(2));

            console.log('💳 Creating order with passkey data:', {
              credentialId: passkeyData.credentialId?.slice(0, 10) + '...',
              smartWalletAddress: passkeyData.smartWalletAddress
            });

            const res = await createWhateeOrder({
              amount: subtotal, // Send subtotal (original amount) instead of total
              currency: fromCurrency,
              description: `Buy ${toToken} via Lazorkit`,
              metadata: { 
                toToken, 
                subtotal: String(subtotal), 
                fee: String(fee),
                total: String(total), // Keep total in metadata for reference
                network: String(network) 
              },
              token: toToken,
              passkeyData,
              orderLines: [
                { key: 'subtotal', title: 'Subtotal', quantity: 1, unit_price: subtotal, amount: subtotal },
                { key: 'fee', title: 'Fee', quantity: 1, unit_price: fee, amount: fee },
                { key: 'network', title: 'Est. network fee', quantity: 1, unit_price: network, amount: network },
              ],
            });

            if (res.checkoutUrl) {
              console.log('✅ Redirecting to checkout:', res.checkoutUrl);
              window.location.href = res.checkoutUrl;
            } else {
              throw new Error('Missing checkoutUrl from provider');
            }
          } catch (e) {
            const raw = (e as Error)?.message || 'Unknown error';
            const message = raw.length > 160 ? raw.slice(0, 160) + '…' : raw;
            const url = `/callback/failed?reason=${encodeURIComponent(message)}&amount=${encodeURIComponent(
              amountUsd.toFixed(2)
            )}&token=${encodeURIComponent(toToken)}&currency=${encodeURIComponent(fromCurrency)}`;
            router.push(url);
          } finally {
            setIsCreatingOrder(false);
          }
        }}
      />
    </>
  );
};