'use client';

import { ExternalLink, Star, Heart, Shield, Sparkles, ShieldCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ViewportModal } from './ui/viewport-modal';
import { AppCard as AppCardType } from '@/lib/store/wallet';
import { t } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';

import { getAppIcon } from './app-card';

interface AppDetailModalProps {
  app: AppCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Function to get high-quality unsplash banner image based on app name/category
const getAppBannerImage = (appName: string, category: string): string => {
  const banners: Record<string, string> = {
    'NFT & cNFT Creator': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'Jupiter Exchange': 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&auto=format&fit=crop&q=80',
    'Raydium': 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=600&auto=format&fit=crop&q=80',
    'Tensor': 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&auto=format&fit=crop&q=80',
    'Marinade Finance': 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    'Dialect': 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=600&auto=format&fit=crop&q=80',
    'Magic Eden': 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80',
    'Orca': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    'Drift Protocol': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    'Jito': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    'Metaplex': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80',
    'Realms': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
    'Squads': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
    'DRiP': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
    'Phantom': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&auto=format&fit=crop&q=80',
    // App fallbacks
    'SolPay Mini': 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    'Orbit Dex': 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&auto=format&fit=crop&q=80',
    'RippleChat': 'https://images.unsplash.com/photo-1611605698335-8b15d27e03f2?w=600&auto=format&fit=crop&q=80',
    'Keystone Tools': 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?w=600&auto=format&fit=crop&q=80',
    'Solana Social': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
  };

  if (banners[appName]) return banners[appName];

  const cat = category.toLowerCase();
  if (cat === 'defi') {
    return 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&auto=format&fit=crop&q=80';
  } else if (cat === 'nft') {
    return 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80';
  } else if (cat === 'social') {
    return 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=600&auto=format&fit=crop&q=80';
  } else if (cat === 'tools') {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
  }

  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
};

// High-fidelity App Stats Map
const getAppStats = (appId: string) => {
  const statsMap: Record<string, { rating: string; users: string; version: string }> = {
    'nft-creator': { rating: '4.9', users: '12K+', version: 'v1.1.2' },
    'jupiter': { rating: '5.0', users: '250K+', version: 'v4.0.0' },
    'raydium': { rating: '4.8', users: '180K+', version: 'v2.1.0' },
    'tensor': { rating: '4.9', users: '95K+', version: 'v1.8.5' },
    'marinade': { rating: '4.7', users: '64K+', version: 'v3.0.1' },
    'dialect': { rating: '4.6', users: '42K+', version: 'v2.0.0' },
    'magic-eden': { rating: '4.9', users: '310K+', version: 'v5.2.0' },
    'orca': { rating: '4.8', users: '115K+', version: 'v2.4.2' },
    'drift': { rating: '4.7', users: '58K+', version: 'v2.1.1' },
    'jito': { rating: '4.9', users: '88K+', version: 'v1.5.0' },
    'metaplex': { rating: '4.9', users: '140K+', version: 'v2.0.3' },
    'realms': { rating: '4.5', users: '18K+', version: 'v1.0.8' },
    'squads': { rating: '4.9', users: '35K+', version: 'v4.1.0' },
    'drip': { rating: '4.8', users: '150K+', version: 'v2.2.0' },
    'phantom': { rating: '5.0', users: '1.2M+', version: 'v24.5.0' },
  };
  return statsMap[appId] || { rating: '4.6', users: '5K+', version: 'v1.0.0' };
};

export const AppDetailModal = ({ app, open, onOpenChange }: AppDetailModalProps) => {
  const router = useRouter();
  const stats = getAppStats(app.id);

  const handleOpenApp = () => {
    toast({
      title: '🚀 Connecting Integration',
      description: `Opening ${app.name} protocol flow...`,
    });
    if (app.website.startsWith('/')) {
      router.push(app.website);
      onOpenChange(false);
    } else {
      window.open(app.website, '_blank');
    }
  };

  const handleAddToFavorites = () => {
    toast({
      title: '❤️ Favorite Added',
      description: `${app.name} has been added to your dashboard shortcuts.`,
    });
  };

  return (
    <ViewportModal
      open={open}
      onOpenChange={onOpenChange}
      title={app.name}
      className="max-w-lg"
    >
      <div className="flex flex-col">
        {/* Banner with App Icon */}
        <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />
          <img
            src={getAppBannerImage(app.name, app.category)}
            alt={`${app.name} banner`}
            className="w-full h-full object-cover opacity-50"
          />

          {/* Floating Category */}
          <span className="absolute top-4 left-4 z-20 px-2 py-0.5 rounded-md bg-slate-950/65 backdrop-blur-md border border-white/10 text-[10px] font-extrabold text-primary uppercase tracking-wider">
            {app.category}
          </span>

          {/* Verified Label */}
          {app.verified && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5 fill-emerald-500/10" />
              <span>Verified</span>
            </div>
          )}

          {/* App Logo */}
          <div className="absolute -bottom-6 left-6 z-20 w-16 h-16 rounded-2xl bg-slate-950 border border-white/10 p-1 flex items-center justify-center shadow-2xl overflow-hidden">
            <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center text-2xl">
              {getAppIcon(app.name)}
            </div>
          </div>
        </div>

        {/* Modal Info Details */}
        <div className="p-6 pt-9 space-y-6">
          {/* Headline Description */}
          <div className="space-y-2">
            <h3 className="font-extrabold text-lg text-white">{app.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {app.intro}
            </p>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl font-mono text-center">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase">Rating</span>
              <div className="text-sm font-extrabold text-amber-400 flex items-center justify-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400" />
                <span>{stats.rating}</span>
              </div>
            </div>
            <div className="space-y-1 border-x border-white/5">
              <span className="text-[10px] text-muted-foreground uppercase">Active Users</span>
              <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{stats.users}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase">Version</span>
              <div className="text-sm font-extrabold text-muted-foreground">{stats.version}</div>
            </div>
          </div>

          {/* Tags list */}
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold block">Keywords & tags</span>
            <div className="flex flex-wrap gap-1.5">
              {app.tags.map((tag, idx) => (
                <Badge
                  key={`${app.id}-detail-tag-${idx}-${tag}`}
                  variant="secondary"
                  className="text-[9px] bg-white/5 border-0 hover:bg-white/10 text-muted-foreground px-2 py-0.5 font-bold"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Security & Access Rights */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Shield className="h-4 w-4 text-primary" />
              <span>Permission Request Details</span>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed pl-1 font-mono">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span>Read-only wallet balance tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span>Request signatures for transaction authorization</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span>Public key access for Web3 identification</span>
              </li>
            </ul>
          </div>

          {/* URL Info */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">Ecosystem URL:</span>
            <a
              href={app.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-bold font-mono flex items-center gap-1.5"
            >
              {app.website.startsWith('/') ? `Internal Protocol` : app.website}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleAddToFavorites}
              className="flex-1 h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-xl"
            >
              <Heart className="h-4 w-4 mr-2" />
              Favorite
            </Button>
            <Button
              onClick={handleOpenApp}
              className="flex-1 h-11 bg-primary text-slate-950 font-extrabold hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/10"
            >
              <Sparkles className="h-4 w-4 mr-2 fill-slate-950" />
              Open Portal
            </Button>
          </div>
        </div>
      </div>
    </ViewportModal>
  );
};
