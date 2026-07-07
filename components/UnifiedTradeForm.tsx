'use client';

import { useEffect, useState } from 'react';
import ErrorBoundary from '@/components/error-boundary';
import { OnRampForm } from '@/components/onramp-form';
import { SwapForm } from '@/components/swap-form';
import { PriceChart } from '@/components/market/price-chart';
import { JupiterToken } from '@/lib/services/jupiter';
import { useWalletStore } from '@/lib/store/wallet';
import { ArrowLeftRight, CreditCard, ShieldCheck, Zap, Info, Wallet, BarChart2 } from 'lucide-react';

type Mode = 'buy' | 'swap';

interface UnifiedTradeFormProps {
  tokenData?: Map<string, JupiterToken>;
}

const getTradingViewSymbol = (tokenSymbol: string) => {
  const mapping: Record<string, string> = {
    'SOL': 'COINBASE:SOLUSD',
    'BTC': 'BINANCE:BTCUSDT',
    'ETH': 'BINANCE:ETHUSDT',
    'USDC': 'COINBASE:USDCUSD',
    'USDT': 'COINBASE:USDTUSD',
    'BONK': 'BYBIT:BONKUSDT',
    'RAY': 'RAYDEX:RAYUSDT',
    'JUP': 'JUPITER:JUPUSDT',
    'ORCA': 'ORCA:ORCAUSD',
  };
  return mapping[tokenSymbol] || `COINBASE:${tokenSymbol}USD`;
};

export const UnifiedTradeForm = ({ tokenData }: UnifiedTradeFormProps) => {
  const getTokenAmount = useWalletStore((s) => s.getTokenAmount);
  const tokens = useWalletStore((s) => s.tokens);
  const hasAssets = useWalletStore((s) => s.hasAssets?.());
  const refreshBalances = useWalletStore((s) => s.refreshBalances);

  const [mode, setMode] = useState<Mode>('buy');
  const [activeChartToken, setActiveChartToken] = useState<string>('SOL');
  const [swapInit, setSwapInit] = useState<{ fromToken?: any; toToken?: any } | null>(null);
  const [buyInitFiat, setBuyInitFiat] = useState<'USD' | 'VND' | undefined>(undefined);
  const [autoApplied, setAutoApplied] = useState(false);

  // Refresh balances once on mount
  useEffect(() => {
    if (typeof refreshBalances === 'function') {
      refreshBalances().catch(() => { });
    }
  }, [refreshBalances]);

  // Auto decide default mode
  useEffect(() => {
    if (autoApplied) return;

    if (hasAssets) {
      setMode('swap');
      setSwapInit({ fromToken: 'USDC', toToken: 'SOL' });
      setActiveChartToken('SOL');
    } else {
      setMode('buy');
      setBuyInitFiat('USD');
      setActiveChartToken('USDC');
    }
    setAutoApplied(true);
  }, [hasAssets, autoApplied]);

  return (
    <div className="flex flex-col w-full space-y-8 select-none p-0 bg-transparent border-0 shadow-none">
      {/* Desktop Split Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Trade Form + Chart (main) */}
        <div className="flex-1 min-w-0 flex flex-col space-y-6">
          {/* Toggle Mode Bar */}
          <div className="flex gap-1.5 p-1 rounded-xl mb-6 w-full max-w-[360px] mx-auto premium-depth-inset">
            <button
              onClick={() => {
                setMode('buy');
                setActiveChartToken('USDC');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${mode === 'buy'
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.2)]'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Buy Crypto</span>
            </button>
            <button
              onClick={() => {
                setMode('swap');
                // restore last active token if possible
                setActiveChartToken(swapInit?.toToken || 'SOL');
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${mode === 'swap'
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.2)]'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>Swap Token</span>
            </button>
          </div>

          {/* Dynamic Form Render (Stretches 100% width to match the page title) */}
          <div className="w-full premium-depth-card rounded-2xl p-6 relative z-20">
            {mode === 'buy' ? (
              <ErrorBoundary>
                <OnRampForm
                  tokenData={tokenData}
                  onSwitchToSwap={({ fromToken, toToken }) => {
                    setSwapInit({ fromToken, toToken });
                    setMode('swap');
                    setAutoApplied(true);
                  }}
                  initialFromCurrency={buyInitFiat}
                  onTokenChange={(token) => setActiveChartToken(token)}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary>
                <SwapForm
                  tokenData={tokenData}
                  initialFromToken={swapInit?.fromToken}
                  initialToToken={swapInit?.toToken}
                  onSwitchToBuy={({ fiat }) => {
                    setBuyInitFiat(fiat);
                    setMode('buy');
                    setAutoApplied(true);
                  }}
                  onTokenChange={(token) => setActiveChartToken(token)}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* 1.1 Integrated Live Price Chart underneath Buy / Swap forms */}
          {(
            <div className="w-full space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{activeChartToken} / USD Live Price Feed</span>
              <PriceChart
                symbol={getTradingViewSymbol(activeChartToken)}
                tokenSymbol={activeChartToken}
                height="h-[240px]"
              />
            </div>
          )}
        </div>

        {/* Right Column: Portfolio Summary (Desktop Only) */}
        <div className="hidden lg:flex flex-col w-[320px] shrink-0 space-y-4 lg:pt-[64px]">
          {/* Quick Stats */}
          <div className="premium-depth-card rounded-2xl p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Portfolio Summary</h4>
            <div className="section-divider" />
            {tokens.length > 0 ? (
              <div className="space-y-3">
                {tokens.slice(0, 5).map((token: any) => (
                  <div key={token.symbol || token.mint} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center text-[9px] font-bold text-primary">
                        {(token.symbol || '?').slice(0, 2)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">{token.symbol || 'Unknown'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {typeof token.amount === 'number' ? token.amount.toFixed(4) : token.amount}
                    </span>
                  </div>
                ))}
                {tokens.length > 5 && (
                  <p className="text-[9px] text-muted-foreground text-center pt-1">
                    +{tokens.length - 5} more tokens
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <BarChart2 className="h-6 w-6 text-muted-foreground/20 mx-auto" />
                <p className="text-[10px] text-muted-foreground">No assets yet. Buy or receive tokens to get started.</p>
              </div>
            )}
          </div>

          {/* Network Info */}
          <div className="premium-depth-card rounded-2xl p-5 space-y-3">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Network</h4>
            <div className="section-divider" />
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Chain</span>
                <span className="font-bold text-foreground">Solana</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cluster</span>
                <span className="font-bold text-purple-400">Devnet</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Gas</span>
                <span className="font-bold text-primary">Sponsored</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Swap Router</span>
                <span className="font-bold text-foreground">Jupiter v6</span>
              </div>
            </div>
          </div>

          {/* AI-generated Trading Art Card to fill empty space */}
          <div className="premium-depth-card rounded-2xl overflow-hidden p-0 border border-white/5 shadow-2xl relative group">
            <div className="relative h-[210px] w-full overflow-hidden">
              <img
                src="/crypto_trading_art.png"
                alt="Crypto Dex Visualizer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            </div>
            <div className="p-4 relative -mt-6 bg-background/90 backdrop-blur-sm border-t border-white/5">
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest block">RampFi Intel</span>
              <h5 className="text-[11px] font-extrabold text-foreground mt-0.5">Real-time Web3 DEX Intelligence</h5>
              <p className="text-[9px] text-muted-foreground mt-1 leading-normal">
                Sensing liquidity depth, on-chain slippage routes, and cross-exchange spreads continuously.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Divider */}
      <div className="section-divider w-full" />

      {/* 2. Educational & Gateway Information (Horizontal 3-Column Grid) */}
      <div className="w-full">
        {mode === 'buy' ? (
          /* Buy Mode information */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Domestic Banking Gateway */}
            <div className="space-y-3.5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Vietnamese Banking Gateway</span>
                <h3 className="text-sm font-extrabold text-foreground">Secure VietQR & Napas</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Purchase digital currencies directly from bank accounts. No card signup required.
                </p>
              </div>

              {/* Bank logos grid */}
              <div className="space-y-2">
                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Supported Banking Apps</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Vietcombank', 'Techcombank', 'MB Bank', 'Vietinbank', 'Napas', 'VietQR'].map((bank) => (
                    <div
                      key={bank}
                      className="px-1.5 py-1.5 rounded-lg bg-background/50 border border-border/50 text-[9px] font-bold text-center text-foreground/80 select-none hover:border-primary/20 transition-all duration-200"
                    >
                      {bank}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Execution Pipeline */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Execution Pipeline</span>
              <div className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-[9px] font-black text-primary shrink-0">1</div>
                  <p className="text-[11px] text-muted-foreground/95 leading-normal">Configure transaction details & verify final exchange rates.</p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-[9px] font-black text-primary shrink-0">2</div>
                  <p className="text-[11px] text-muted-foreground/95 leading-normal">Verify credentials via secure biometric TouchID passkey.</p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-[9px] font-black text-primary shrink-0">3</div>
                  <p className="text-[11px] text-muted-foreground/95 leading-normal">Scan the generated VietQR code inside your mobile banking app to execute deposit.</p>
                </div>
              </div>
            </div>

            {/* Column 3: Sponsor Coverage */}
            <div className="flex flex-col justify-center">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start h-fit">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-foreground block">Gasless Sponsor Active</span>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    RampFi sponsorships cover all Solana account initialization rent and setup transactions. Zero gas fees for Vietnam accounts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Swap Mode information */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Jupiter Routing Engine */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Liquidity Aggregator</span>
              <h3 className="text-sm font-extrabold text-foreground">Jupiter Routing Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Executing trades across multiple Solana DEXes simultaneously to fetch the lowest possible price impact and optimal routing.
              </p>
            </div>

            {/* Column 2: Execution Fees */}
            <div className="space-y-2.5">
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Execution Fees</span>
              <div className="space-y-2 bg-background/35 p-3 rounded-xl border border-border/40">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Slippage</span>
                  <span className="font-bold text-foreground font-mono">0.5%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">RampFi Fee</span>
                  <span className="font-bold text-emerald-400 font-mono">0.0%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Solana Gas</span>
                  <span className="font-bold text-primary font-mono">Sponsored</span>
                </div>
              </div>
            </div>

            {/* Column 3: Security Standard */}
            <div className="flex flex-col justify-center">
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 flex gap-3 items-start h-fit">
                <Wallet className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-foreground block">Non-Custodial Account</span>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    RampFi cannot access your funds. All trades require biometric passkey authorization on your trusted device.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
