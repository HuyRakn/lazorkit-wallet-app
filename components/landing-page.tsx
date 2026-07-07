'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Fingerprint, 
  ArrowRight, 
  CheckCircle2, 
  QrCode, 
  ArrowLeftRight, 
  CreditCard,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Wallet,
  Settings,
  HelpCircle,
  TrendingUp,
  Search,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';

interface LandingPageProps {
  onConnectClick: () => void;
}

export function LandingPage({ onConnectClick }: LandingPageProps) {
  const [mode, setMode] = useState<'buy' | 'swap'>('buy');
  
  // Simulator States
  // 'idle' -> 'routing' -> 'prompt' -> 'signing' -> 'success'
  // or for buy: 'idle' -> 'routing' -> 'qrcode' -> 'success'
  const [status, setStatus] = useState<'idle' | 'routing' | 'prompt' | 'signing' | 'success' | 'qrcode'>('idle');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);

  // Inputs
  const [fiatAmount, setFiatAmount] = useState('1,500,000');
  const [cryptoReceive, setCryptoReceive] = useState('61.42');
  const [selectedBank, setSelectedBank] = useState<'Techcombank' | 'Vietcombank'>('Techcombank');
  
  const [swapFrom, setSwapFrom] = useState('10');
  const [swapTo, setSwapTo] = useState('1,540.20');
  
  // Timer for QR Code
  const [timeLeft, setTimeLeft] = useState(899);

  // Auto calculate exchange rates with a mock "re-calculating" flicker for realism
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => {
      setIsCalculating(false);
      if (mode === 'buy') {
        const num = parseFloat(fiatAmount.replace(/,/g, ''));
        if (!isNaN(num)) {
          setCryptoReceive((num / 24420).toFixed(2));
        } else {
          setCryptoReceive('0.00');
        }
      } else {
        const num = parseFloat(swapFrom);
        if (!isNaN(num)) {
          setSwapTo((num * 154.02).toFixed(2));
        } else {
          setSwapTo('0.00');
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [fiatAmount, swapFrom, mode]);

  // QR Code Timer countdown
  useEffect(() => {
    if (status !== 'qrcode') return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 899));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleExecute = () => {
    setStatus('routing');
    
    // Simulate fetching best route / price feed
    setTimeout(() => {
      if (mode === 'buy') {
        setTimeLeft(899);
        setStatus('qrcode');
      } else {
        setStatus('prompt');
      }
    }, 1500);
  };

  const handleAuthorizePasskey = () => {
    setStatus('signing');
    
    // Simulate signature success
    setTimeout(() => {
      setStatus('success');
    }, 2800);
  };

  const resetSimulator = () => {
    setStatus('idle');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate payment confirmation in buy mode
  useEffect(() => {
    if (status === 'qrcode') {
      const paymentTimer = setTimeout(() => {
        setStatus('success');
      }, 5500); // 5.5 seconds simulation
      return () => clearTimeout(paymentTimer);
    }
  }, [status]);

  return (
    <div className="min-h-screen lg:h-screen w-screen overflow-y-auto lg:overflow-hidden bg-[#07080a] text-white flex flex-col relative font-sans select-none">
      
      {/* ── Background Aesthetics (clipped to prevent extra scroll scrollbar padding) ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-purple-500/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* ── Main Layout Split ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative z-10">
        
        {/* === LEFT COLUMN: Branding & Call To Actions === */}
        <div className="w-full lg:w-[45%] p-6 sm:p-10 lg:p-16 flex flex-col items-center lg:items-start text-center lg:text-left justify-between min-h-0 shrink-0">
          
          {/* Correct Logo & Text */}
          <div className="flex items-center gap-3 justify-center lg:justify-start w-full">
            <div className="h-8 w-auto">
              <img
                src="/logo.png"
                alt="RampFi"
                className="h-8 w-auto object-contain"
              />
            </div>
            <span className="text-xl font-bold tracking-wider text-white">
              Ramp<span className="text-[#16ffbb]">Fi</span>
            </span>
          </div>

          {/* Core Content */}
          <div className="my-auto py-4 lg:py-8 space-y-4 lg:space-y-6 max-w-xl flex flex-col items-center lg:items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-extrabold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>Gasless Solana Gateway</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              The <span className="gradient-text">Gateway</span> <br />
              to Digital Finance.
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
              Access Solana assets with zero gas fees. Purchase via VietQR bank transfer, 
              trade with Jupiter-powered execution, and mint NFTs — all secured by biometric passkeys.
            </p>

            <div className="pt-2 w-full flex justify-center lg:justify-start">
              <button
                onClick={onConnectClick}
                className="w-full sm:w-auto px-8 py-3.5 bg-primary text-black font-extrabold text-xs sm:text-sm rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(4,242,168,0.25)] hover:shadow-[0_0_40px_rgba(4,242,168,0.4)] active:scale-[0.98] transition duration-200"
              >
                <Fingerprint className="h-5 w-5" />
                <span>Launch Portal</span>
              </button>
            </div>
          </div>

        </div>

        {/* === RIGHT COLUMN: Interactive High-Fidelity Simulator === */}
        <div className="w-full lg:w-[55%] p-4 sm:p-10 lg:p-16 flex items-center justify-center min-h-0 bg-white/[0.01] border-t lg:border-t-0 lg:border-l border-white/[0.04] shrink-0">
          
          <div className="w-full max-w-[420px] glass-card rounded-3xl p-6 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.06]">
            
            {/* Background glowing halo inside the card */}
            <div className="absolute top-[-20%] right-[-20%] w-[60%] aspect-square rounded-full bg-primary/5 blur-[50px] pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {/* === STATE: INPUT (Idle) === */}
              {status === 'idle' && (
                <motion.div
                  key="idle-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Card Header & Toggles */}
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1 p-0.5 rounded-xl bg-black/40 border border-white/[0.03] w-[220px]">
                      <button
                        onClick={() => setMode('buy')}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          mode === 'buy'
                            ? 'bg-primary text-black font-extrabold shadow-[0_2px_10px_rgba(4,242,168,0.15)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span>Buy</span>
                      </button>
                      <button
                        onClick={() => setMode('swap')}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          mode === 'swap'
                            ? 'bg-primary text-black font-extrabold shadow-[0_2px_10px_rgba(4,242,168,0.15)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        <span>Swap</span>
                      </button>
                    </div>

                    {/* Simulator settings button */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:text-primary flex items-center justify-center transition"
                      >
                        <Settings className={`h-4 w-4 ${showSettings ? 'text-primary rotate-45' : 'text-muted-foreground'} transition-transform duration-300`} />
                      </button>
                      
                      {/* Slippage Settings Popup */}
                      {showSettings && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0e0f14] border border-white/[0.08] p-3 shadow-2xl z-50 space-y-2">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Slippage Tolerance</span>
                          <div className="grid grid-cols-3 gap-1">
                            {['0.1', '0.5', '1.0'].map((val) => (
                              <button
                                key={val}
                                onClick={() => {
                                  setSlippage(val);
                                  setShowSettings(false);
                                }}
                                className={`py-1 text-[10px] font-mono rounded border ${
                                  slippage === val
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-black/40 border-white/[0.03] text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {val}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form Container */}
                  <div className="space-y-4">
                    {mode === 'buy' ? (
                      /* REALISTIC BUY VIEW */
                      <>
                        {/* Fiat Input Field */}
                        <div className="bg-black/20 border border-white/[0.04] rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <span>You Pay</span>
                            <span className="text-[9px] text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 normal-case">Direct Transfer</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={fiatAmount}
                              onChange={(e) => setFiatAmount(e.target.value)}
                              className="bg-transparent border-0 outline-none text-2xl font-black w-2/3 p-0 focus:ring-0 text-white font-mono"
                            />
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <span className="text-xs font-bold text-foreground">VND</span>
                            </div>
                          </div>
                        </div>

                        {/* Swap indicator */}
                        <div className="flex justify-center -my-2.5 relative z-10">
                          <div className="w-8 h-8 rounded-full bg-[#121318] border border-white/[0.06] flex items-center justify-center text-primary shadow-lg">
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </div>
                        </div>

                        {/* Crypto Output Field */}
                        <div className="bg-black/20 border border-white/[0.04] rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <span>You Receive</span>
                            <span className="text-[9px] text-muted-foreground normal-case font-medium">Slippage &lt; 0.1%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-2xl font-black font-mono transition-opacity duration-150 ${isCalculating ? 'opacity-40' : 'opacity-100'}`}>
                              {cryptoReceive}
                            </span>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-4 h-4 rounded-full bg-[#2775ca] flex items-center justify-center text-[9px] font-black text-white shrink-0">S</div>
                              <span className="text-xs font-bold text-primary">USDC</span>
                            </div>
                          </div>
                        </div>

                        {/* Bank selector */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Select Deposit Bank</span>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Techcombank */}
                            <button
                              onClick={() => setSelectedBank('Techcombank')}
                              className={`p-3 rounded-2xl border text-left transition-all ${
                                selectedBank === 'Techcombank'
                                  ? 'bg-[#e31837]/5 border-[#e31837] text-white shadow-[0_0_15px_rgba(227,24,55,0.08)]'
                                  : 'bg-black/25 border-white/[0.04] text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-md bg-[#e31837] flex items-center justify-center text-[9px] font-black text-white">T</div>
                                <div>
                                  <span className="text-xs font-bold block">Techcombank</span>
                                  <span className="text-[9px] text-muted-foreground mt-0.5">Instant Transfer</span>
                                </div>
                              </div>
                            </button>

                            {/* Vietcombank */}
                            <button
                              onClick={() => setSelectedBank('Vietcombank')}
                              className={`p-3 rounded-2xl border text-left transition-all ${
                                selectedBank === 'Vietcombank'
                                  ? 'bg-[#74b34b]/5 border-[#74b34b] text-white shadow-[0_0_15px_rgba(116,179,75,0.08)]'
                                  : 'bg-black/25 border-white/[0.04] text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-md bg-[#74b34b] flex items-center justify-center text-[9px] font-black text-white">V</div>
                                <div>
                                  <span className="text-xs font-bold block">Vietcombank</span>
                                  <span className="text-[9px] text-muted-foreground mt-0.5">Instant Transfer</span>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* REALISTIC SWAP VIEW */
                      <>
                        {/* Token From Field */}
                        <div className="bg-black/20 border border-white/[0.04] rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <span>From</span>
                            <div className="flex gap-2">
                              <button onClick={() => setSwapFrom('1')} className="text-[9px] hover:text-primary transition font-bold px-1 rounded bg-white/[0.03]">10%</button>
                              <button onClick={() => setSwapFrom('5')} className="text-[9px] hover:text-primary transition font-bold px-1 rounded bg-white/[0.03]">50%</button>
                              <button onClick={() => setSwapFrom('10')} className="text-[9px] hover:text-primary transition font-bold px-1 rounded bg-white/[0.03] text-primary">MAX</button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={swapFrom}
                              onChange={(e) => setSwapFrom(e.target.value)}
                              className="bg-transparent border-0 outline-none text-2xl font-black w-2/3 p-0 focus:ring-0 text-white font-mono"
                            />
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 shrink-0" />
                              <span className="text-xs font-bold">SOL</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Switcher */}
                        <div className="flex justify-center -my-2.5 relative z-10">
                          <button
                            onClick={() => {
                              const f = swapFrom;
                              setSwapFrom(swapTo);
                              setSwapTo(f);
                            }}
                            className="w-8 h-8 rounded-full bg-[#121318] border border-white/[0.06] flex items-center justify-center text-primary shadow-lg hover:rotate-180 transition duration-300"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 rotate-90" />
                          </button>
                        </div>

                        {/* Token To Field */}
                        <div className="bg-black/20 border border-white/[0.04] rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            <span>To</span>
                            <span className="text-[9px] text-muted-foreground font-medium">1 SOL ≈ 154.02 USDC</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-2xl font-black font-mono transition-opacity duration-150 ${isCalculating ? 'opacity-40' : 'opacity-100'}`}>
                              {swapTo}
                            </span>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-4 h-4 rounded-full bg-[#2775ca] flex items-center justify-center text-[9px] font-black text-white shrink-0">S</div>
                              <span className="text-xs font-bold text-primary">USDC</span>
                            </div>
                          </div>
                        </div>

                        {/* Realistic Route Aggregator Details */}
                        <div className="p-3 bg-black/20 border border-white/[0.04] rounded-xl flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            <span>Jupiter routing (Best Price Route)</span>
                          </div>
                          <span className="text-primary font-bold">SOL → JUP → USDC</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleExecute}
                    className="w-full py-4 bg-primary text-black font-black text-xs rounded-xl shadow-lg hover:shadow-primary/10 hover:bg-primary/95 transition duration-150 uppercase tracking-wider"
                  >
                    {mode === 'buy' ? 'Generate VietQR Gateway' : 'Swap Instantly (Gasless)'}
                  </button>
                </motion.div>
              )}

              {/* === STATE: ROUTING (Rate/Route loader) === */}
              {status === 'routing' && (
                <motion.div
                  key="routing-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 flex flex-col items-center justify-center space-y-5 text-center"
                >
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Finding Best Exchange Route</h3>
                    <p className="text-[10px] text-muted-foreground max-w-[200px]">
                      Querying Jupiter liquidity depth & optimizing slippage bounds...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* === STATE: PROMPT (Simulated Browser WebAuthn Dialogue) === */}
              {status === 'prompt' && (
                <motion.div
                  key="prompt-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5 py-2"
                >
                  <div className="flex items-center gap-2 text-xs border-b border-white/[0.06] pb-3 text-muted-foreground font-bold uppercase tracking-wider">
                    <Wallet className="h-4.5 w-4.5 text-primary" />
                    <span>Passkey Authorization</span>
                  </div>

                  <div className="p-4 bg-black/40 border border-white/[0.04] rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                        <Fingerprint className="h-5.5 w-5.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white">RampFi Security Gate</span>
                        <span className="text-[10px] text-muted-foreground">Request type: Signature / Swap</span>
                      </div>
                    </div>

                    <div className="divide-y divide-white/[0.05] text-[11px] font-mono">
                      <div className="py-2 flex justify-between">
                        <span className="text-muted-foreground">Origin</span>
                        <span className="text-white font-bold">rampfi.io</span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-muted-foreground">Action</span>
                        <span className="text-primary font-bold">Swap {swapFrom} SOL</span>
                      </div>
                      <div className="py-2 flex justify-between">
                        <span className="text-muted-foreground">Estimated Gas</span>
                        <span className="text-emerald-400 font-bold">0.00 SOL (Sponsored)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={resetSimulator}
                      className="flex-1 py-3 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-muted-foreground hover:text-white font-bold text-xs rounded-xl transition"
                    >
                      Deny
                    </button>
                    <button
                      onClick={handleAuthorizePasskey}
                      className="flex-1 py-3 bg-primary text-black font-black text-xs rounded-xl shadow-lg hover:bg-primary/95 transition"
                    >
                      Sign with TouchID
                    </button>
                  </div>
                </motion.div>
              )}

              {/* === STATE: SIGNING (TouchID Scanning Animation) === */}
              {status === 'signing' && (
                <motion.div
                  key="signing-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center space-y-6 text-center"
                >
                  <div className="relative">
                    {/* Ring scale pulses */}
                    <div className="absolute inset-[-10px] rounded-full border border-primary/30 animate-ping opacity-40" />
                    <div className="absolute inset-[-25px] rounded-full border border-primary/10 animate-pulse opacity-20" />
                    
                    {/* Fingerprint logo */}
                    <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary shadow-[0_0_30px_rgba(4,242,168,0.2)]">
                      <Fingerprint className="h-10 w-10 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Validating Credentials</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Confirming passkey hardware cryptographic token...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* === STATE: QRCODE (VietQR Bank Scanning Dialogue) === */}
              {status === 'qrcode' && (
                <motion.div
                  key="qrcode-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Title & Live Status */}
                  <div className="flex justify-between items-center text-xs border-b border-white/[0.06] pb-3">
                    <span className="text-muted-foreground font-bold">VietQR Payment Gateway</span>
                    <span className="font-mono text-primary font-extrabold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  {/* QR Image Container */}
                  <div className="relative w-44 h-44 mx-auto bg-white rounded-2xl p-3 flex items-center justify-center shadow-xl overflow-hidden">
                    <QrCode className="w-full h-full text-black" />
                    {/* Scanner laser lines */}
                    <div className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_var(--primary)] animate-scanner-bar opacity-80" />
                  </div>

                  {/* Transaction Details (Vietnam Invoice style) */}
                  <div className="bg-black/30 border border-white/[0.04] p-4 rounded-2xl space-y-2 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bank Target</span>
                      <span className="font-bold text-white">{selectedBank === 'Techcombank' ? 'TCB (1903...)' : 'VCB (0071...)'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Name</span>
                      <span className="font-bold text-white">RAMPFI SYSTEM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transfer Amount</span>
                      <span className="font-bold text-white">{fiatAmount} VND</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-dashed border-white/[0.08] mt-1">
                      <span className="text-muted-foreground">Transfer Memo</span>
                      <span className="font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">RF 8372 901</span>
                    </div>
                  </div>

                  {/* Listening status */}
                  <div className="text-center space-y-1 py-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Awaiting bank verification</span>
                    <p className="text-[10px] text-muted-foreground/80 leading-normal">
                      Scan VietQR in your bank app to transfer. Transactions are monitored 24/7.
                    </p>
                  </div>

                  <button
                    onClick={resetSimulator}
                    className="w-full py-2.5 bg-white/[0.02] border border-white/[0.06] text-muted-foreground hover:text-white font-bold text-[10px] rounded-xl transition"
                  >
                    Cancel Transaction
                  </button>
                </motion.div>
              )}

              {/* === STATE: SUCCESS (Receipt View) === */}
              {status === 'success' && (
                <motion.div
                  key="success-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-2 flex flex-col items-center justify-center space-y-5 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Transaction Executed</h3>
                    <p className="text-[11px] text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                      {mode === 'buy' 
                        ? `Fiat deposit processed successfully. Credited ${cryptoReceive} USDC to wallet.`
                        : `Successfully swapped ${swapFrom} SOL for ${swapTo} USDC.`}
                    </p>
                  </div>

                  {/* Authentic Tx Receipt block */}
                  <div className="w-full bg-[#0a0b0f] border border-white/[0.04] p-4 rounded-2xl text-[10px] font-mono text-muted-foreground space-y-2 text-left">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-emerald-400 font-bold">CONFIRMED (ON-CHAIN)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Gas</span>
                      <span className="text-primary font-bold">SPONSORED ($0.00)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Solana Signature</span>
                      <span className="text-white select-text">5yW9...Kj2N</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Block Timestamp</span>
                      <span className="text-white">Just now (Solana Epoch)</span>
                    </div>
                  </div>

                  <button
                    onClick={resetSimulator}
                    className="w-full py-3 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] text-white font-bold text-xs rounded-xl transition"
                  >
                    Perform Another Swap / Deposit
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </div>

      {/* Global Footer (Visible on both desktop & mobile at bottom of page) */}
      <footer className="w-full border-t border-white/[0.04] py-4 bg-black/20 relative z-10 shrink-0 mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <span>© 2026 RampFi. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Solana Devnet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Jupiter Route
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Biometric Passkey
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
