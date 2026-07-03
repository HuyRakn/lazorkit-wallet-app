'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  QrCode,
  ShieldCheck,
  TrendingUp,
  Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Force client-side params parsing via Suspense wrapper
export default function OnrampCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get('ref');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'card' | 'qr'>('card');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState('LAZORKIT SANDBOX');
  const [expiry, setExpiry] = useState('12/29');
  const [cvv, setCvv] = useState('•••');
  
  // Payment processing states
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setError('Missing order reference parameter');
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
        const response = await fetch(`${backendBase}/api/orders/${ref}`);
        if (!response.ok) {
          throw new Error('Order not found or expired');
        }
        const data = await response.json();
        setOrder(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [ref]);

  const handlePayment = async (status: 'success' | 'failed') => {
    if (processing) return;
    setError(null);

    if (status === 'failed') {
      const returnFailed = `/callback/failed?status=failed&ref=${encodeURIComponent(ref || '')}&token=${encodeURIComponent(order?.token || '')}&currency=${encodeURIComponent(order?.currency || '')}&amount=${encodeURIComponent(order?.amount || 0)}`;
      router.push(returnFailed);
      return;
    }

    setProcessing(true);
    setProcessStep(1); // Verifying payment

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      
      // Step 2: Deploying smart wallet (Simulated wait)
      setTimeout(() => setProcessStep(2), 2000);
      
      // Step 3: Minting SPL tokens (Simulated wait)
      setTimeout(() => setProcessStep(3), 5000);

      const response = await fetch(`${backendBase}/api/orders/callback/success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process payment callback on blockchain');
      }

      const callbackResult = await response.json();
      
      // Step 4: Finished redirecting
      setProcessStep(4);
      setTimeout(() => {
        const returnSuccess = `/callback/success?status=success&ref=${encodeURIComponent(ref || '')}&token=${encodeURIComponent(order?.token || '')}&currency=${encodeURIComponent(order?.currency || '')}&amount=${encodeURIComponent(order?.amount || 0)}&tx=${encodeURIComponent(callbackResult.txSignature || '')}`;
        router.push(returnSuccess);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Blockchain order settlement failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-gray-400 text-sm">Loading checkout session...</p>
      </div>
    );
  }

  if (error && !processing) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-red-950/10 border-red-500/20 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Checkout Session Error</h2>
          <p className="text-gray-400 text-sm">{error}</p>
          <Button onClick={() => router.push('/buy')} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to wallet
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {processing ? (
        <Card className="w-full max-w-md p-8 bg-white/5 border-white/10 backdrop-blur-md text-center space-y-6">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-black tracking-tight">Processing Payment</h2>
          
          <div className="space-y-4 text-left max-w-xs mx-auto">
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${processStep >= 1 ? 'border-primary bg-primary/20 text-primary' : 'border-gray-600 text-gray-500'}`}>
                {processStep > 1 ? '✓' : '1'}
              </div>
              <span className={`text-sm ${processStep >= 1 ? 'text-white font-medium' : 'text-gray-500'}`}>Verifying card details</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${processStep >= 2 ? 'border-primary bg-primary/20 text-primary' : 'border-gray-600 text-gray-500'}`}>
                {processStep > 2 ? '✓' : '2'}
              </div>
              <span className={`text-sm ${processStep >= 2 ? 'text-white font-medium' : 'text-gray-500'}`}>Deploying Passkey Smart Wallet</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${processStep >= 3 ? 'border-primary bg-primary/20 text-primary' : 'border-gray-600 text-gray-500'}`}>
                {processStep > 3 ? '✓' : '3'}
              </div>
              <span className={`text-sm ${processStep >= 3 ? 'text-white font-medium' : 'text-gray-500'}`}>Minting & transferring {order?.token}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${processStep >= 4 ? 'border-primary bg-primary/20 text-primary' : 'border-gray-600 text-gray-500'}`}>
                {processStep >= 4 ? '✓' : '4'}
              </div>
              <span className={`text-sm ${processStep >= 4 ? 'text-white font-medium' : 'text-gray-500'}`}>Redirecting to wallet...</span>
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-2 bg-red-950/20 border border-red-500/20 p-2.5 rounded-lg">{error}</p>
          )}
        </Card>
      ) : (
        <div className="w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => handlePayment('failed')}
              className="flex items-center text-sm text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Cancel Payment
            </button>
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 text-xs font-medium text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Sandbox Checkout
            </div>
          </div>

          {/* Amount Showcase Card */}
          <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-md flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Amount Due</p>
              <h1 className="text-3xl font-black text-white">
                ${(order?.amount || 0).toFixed(2)} <span className="text-lg font-medium text-gray-400">{order?.currency}</span>
              </h1>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1.5 justify-end text-sm text-primary font-bold">
                <Coins className="w-4 h-4 text-yellow-500" /> Receiving Token
              </div>
              <p className="text-lg font-semibold text-white">{order?.token}</p>
            </div>
          </Card>

          {/* Tabs selector */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
            <button 
              onClick={() => setActiveTab('card')}
              className={`flex-1 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${activeTab === 'card' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              <CreditCard className="w-4 h-4" /> Credit Card (Visa/Mastercard)
            </button>
            <button 
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${activeTab === 'qr' ? 'bg-primary text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              <QrCode className="w-4 h-4" /> VietQR (Bank Transfer)
            </button>
          </div>

          {/* Checkout Body */}
          {activeTab === 'card' ? (
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-md space-y-6">
              {/* Credit Card Graphic */}
              <div className="relative h-44 w-full bg-gradient-to-tr from-purple-800 to-indigo-900 rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-lg border border-white/20">
                <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Sandbox Card</span>
                    <h2 className="text-lg font-bold text-white leading-none">LazorKit Pay</h2>
                  </div>
                  <span className="text-xl font-black italic text-white">VISA</span>
                </div>

                <p className="text-xl font-mono tracking-widest text-white">{cardNumber}</p>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-gray-400 block uppercase">Card Holder</span>
                    <span className="text-xs font-semibold uppercase tracking-wider">{cardHolder}</span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[9px] text-gray-400 block uppercase">Expires</span>
                      <span className="text-xs font-semibold">{expiry}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block uppercase">CVV</span>
                      <span className="text-xs font-semibold">{cvv}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Input fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-bold text-gray-300 uppercase">Card Number</Label>
                    <Input 
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber === '4242 •••• •••• 4242' ? '' : cardNumber}
                      onChange={(e) => setCardNumber(e.target.value || '4242 •••• •••• 4242')}
                      className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-300 uppercase">Expiration Date</Label>
                    <Input 
                      placeholder="MM/YY"
                      value={expiry === '12/29' ? '' : expiry}
                      onChange={(e) => setExpiry(e.target.value || '12/29')}
                      className="bg-white/5 border-white/10 text-white rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-300 uppercase">CVC / CVV</Label>
                    <Input 
                      placeholder="123"
                      value={cvv === '•••' ? '' : cvv}
                      onChange={(e) => setCvv(e.target.value || '•••')}
                      className="bg-white/5 border-white/10 text-white rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <Button 
                    onClick={() => handlePayment('success')}
                    className="flex-1 h-12 text-sm font-bold bg-primary hover:bg-primary/90 rounded-xl"
                  >
                    Simulate Success
                  </Button>
                  <Button 
                    onClick={() => handlePayment('failed')}
                    variant="outline"
                    className="flex-1 h-12 text-sm font-bold border-white/10 hover:bg-white/5 rounded-xl text-red-400 hover:text-red-300"
                  >
                    Simulate Fail
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-md space-y-6 text-center">
              <p className="text-sm text-gray-400">Scan QR using your mobile banking app to pay</p>
              
              {/* VietQR Graphic */}
              <div className="relative w-56 h-56 bg-white rounded-2xl mx-auto p-4 flex flex-col items-center justify-center border-4 border-primary/20 shadow-xl">
                {/* SVG QR Code Mock */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-black">
                  <rect x="0" y="0" width="20" height="20" fill="currentColor" />
                  <rect x="2" y="2" width="16" height="16" fill="white" />
                  <rect x="5" y="5" width="10" height="10" fill="currentColor" />

                  <rect x="80" y="0" width="20" height="20" fill="currentColor" />
                  <rect x="82" y="2" width="16" height="16" fill="white" />
                  <rect x="85" y="5" width="10" height="10" fill="currentColor" />

                  <rect x="0" y="80" width="20" height="20" fill="currentColor" />
                  <rect x="2" y="82" width="16" height="16" fill="white" />
                  <rect x="85" y="85" width="10" height="10" fill="currentColor" />

                  {/* Random QR block pixels */}
                  <rect x="25" y="5" width="5" height="10" fill="currentColor" />
                  <rect x="40" y="10" width="10" height="5" fill="currentColor" />
                  <rect x="65" y="0" width="5" height="15" fill="currentColor" />
                  <rect x="30" y="30" width="40" height="40" fill="currentColor" />
                  <rect x="35" y="35" width="30" height="30" fill="white" />
                  
                  {/* Central VietQR Logo box */}
                  <rect x="42" y="42" width="16" height="16" fill="currentColor" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded leading-none shadow">
                    VietQR
                  </div>
                </div>
              </div>

              {/* QR Details */}
              <div className="bg-white/5 border border-white/5 p-4 rounded-xl text-left space-y-1.5 text-xs max-w-sm mx-auto">
                <div className="flex justify-between"><span className="text-gray-400">Bank Name</span><span className="font-semibold">MB Bank (Military Bank)</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Account Number</span><span className="font-semibold font-mono">130220268888</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Account Holder</span><span className="font-semibold">LAZORKIT SANDBOX PORTAL</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Transfer Message</span><span className="font-semibold font-mono text-primary">{ref}</span></div>
              </div>

              <div className="pt-2 flex gap-3">
                <Button 
                  onClick={() => handlePayment('success')}
                  className="flex-1 h-12 text-sm font-bold bg-primary hover:bg-primary/90 rounded-xl"
                >
                  Simulate Bank Transfer Success
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
