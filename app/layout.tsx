import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Suspense } from 'react';
import { LazorkitRootProvider } from '@/components/lazorkit-provider';
import { WalletSync } from '@/components/wallet-sync';

export const metadata: Metadata = {
  title: 'RampFi — Your Gateway to Blockchain',
  description: 'The easiest way to buy, send, and manage crypto assets on Solana. Gasless transactions powered by LazorKit passkeys.',
  generator: 'RampFi',
  keywords: ['crypto', 'solana', 'wallet', 'web3', 'blockchain', 'passkey', 'gasless'],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'RampFi — Your Gateway to Blockchain',
    description: 'Buy, send, and manage crypto assets on Solana with biometric passkeys. No gas fees.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0B0F',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
        <link
          href='https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap'
          rel='stylesheet'
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.className = 'dark';
                  localStorage.setItem('theme', 'dark');
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body
        className='font-sans antialiased text-foreground bg-background transition-colors duration-300'
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (typeof window !== 'undefined' && !window.global) { window.global = window; }
              })();
            `,
          }}
        />
        <Suspense fallback={null}>
          <LazorkitRootProvider>
            <ThemeProvider
              attribute='class'
              defaultTheme='dark'
              forcedTheme='dark'
              enableSystem={false}
              disableTransitionOnChange
            >
              <WalletSync />
              {children}
              <Toaster />
            </ThemeProvider>
          </LazorkitRootProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
