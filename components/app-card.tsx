'use client';

import { ExternalLink, Star, Users, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Badge } from './ui/badge';
import { AppCard as AppCardType } from '@/lib/store/wallet';
import { motion } from 'framer-motion';

interface AppCardProps {
  app: AppCardType;
  layout: 'list';
  onClick: () => void;
}

// Function to get high-quality unsplash banner image based on app name/category
const getAppBannerImage = (appName: string, category: string): string => {
  const banners: Record<string, string> = {
    'NFT & cNFT Creator': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
    'Jupiter Exchange': 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&auto=format&fit=crop&q=80',
    'Raydium': 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=400&auto=format&fit=crop&q=80',
    'Tensor': 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&auto=format&fit=crop&q=80',
    'Marinade Finance': 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
    'Dialect': 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&auto=format&fit=crop&q=80',
    'Magic Eden': 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&auto=format&fit=crop&q=80',
    'Orca': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&auto=format&fit=crop&q=80',
    'Drift Protocol': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
    'Jito': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80',
    'Metaplex': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&auto=format&fit=crop&q=80',
    'Realms': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80',
    'Squads': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80',
    'DRiP': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&auto=format&fit=crop&q=80',
    'Phantom': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&auto=format&fit=crop&q=80',
    // App fallbacks
    'SolPay Mini': 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=80',
    'Orbit Dex': 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=400&auto=format&fit=crop&q=80',
    'RippleChat': 'https://images.unsplash.com/photo-1611605698335-8b15d27e03f2?w=400&auto=format&fit=crop&q=80',
    'Keystone Tools': 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?w=400&auto=format&fit=crop&q=80',
    'Solana Social': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80',
  };

  if (banners[appName]) return banners[appName];

  const cat = category.toLowerCase();
  if (cat === 'defi') {
    return 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&auto=format&fit=crop&q=80';
  } else if (cat === 'nft') {
    return 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&auto=format&fit=crop&q=80';
  } else if (cat === 'social') {
    return 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=400&auto=format&fit=crop&q=80';
  } else if (cat === 'tools') {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80';
  }

  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80';
};

// High-fidelity App Icons
export const getAppIcon = (appName: string): string => {
  const icons: Record<string, string> = {
    'NFT & cNFT Creator': '🎨',
    'Jupiter Exchange': '🪐',
    'Raydium': '☀️',
    'Tensor': '⚡',
    'Marinade Finance': '🥩',
    'Dialect': '💬',
    'Magic Eden': '🪄',
    'Orca': '🐋',
    'Drift Protocol': '⛵',
    'Jito': '🥩',
    'Metaplex': '🔮',
    'Realms': '🏛️',
    'Squads': '👥',
    'DRiP': '💧',
    'Phantom': '👻',
    'SolPay Mini': '💳',
    'Orbit Dex': '🪐',
    'RippleChat': '💬',
    'Keystone Tools': '🔑',
    'Solana Social': '🌐',
  };
  return icons[appName] || '📱';
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

export const AppCard = ({ app, onClick }: AppCardProps) => {
  const stats = getAppStats(app.id);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.008 }}
      whileTap={{ scale: 0.992 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="cursor-pointer group flex flex-col h-full rounded-2xl overflow-hidden glass-card border border-white/5 hover:border-primary/20 shadow-lg hover:shadow-primary/5 transition-all duration-300 relative"
    >
      {/* Banner Area (Rounded Top) */}
      <div className="relative h-24 w-full bg-slate-900 overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
        <img
          src={app.banner || getAppBannerImage(app.name, app.category)}
          alt={`${app.name} banner`}
          className="w-full h-full object-cover opacity-45 group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Floating Category Badge */}
        <span className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded bg-slate-950/60 backdrop-blur-md border border-white/10 text-[9px] font-extrabold text-primary uppercase tracking-wider">
          {app.category}
        </span>

        {/* Verified Indicator */}
        {app.verified && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3 fill-emerald-500/10" />
            <span>Verified</span>
          </div>
        )}
      </div>

      {/* Floating App Icon placed OUTSIDE overflow-hidden container to avoid clipping */}
      <div className="absolute top-18 left-4 z-20 w-11 h-11 rounded-xl bg-slate-900 border border-white/10 p-0.5 shadow-xl flex items-center justify-center overflow-hidden">
        <img
          src={app.image}
          alt={`${app.name} icon`}
          className="w-full h-full rounded-lg object-contain bg-slate-950/40"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = `<div class="w-full h-full rounded-lg bg-slate-950 flex items-center justify-center text-sm">📱</div>`;
            }
          }}
        />
      </div>

      {/* Main Details Body */}
      <div className="flex-1 p-4 pt-7 flex flex-col justify-between space-y-3.5">
        <div className="space-y-2">
          {/* Title and Short Intro */}
          <div>
            <h3 className="font-extrabold text-sm text-white group-hover:text-primary transition-colors flex items-center gap-1">
              {app.name}
              <ArrowUpRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </h3>
            <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-0.5 leading-relaxed min-h-[32px]">
              {app.intro}
            </p>
          </div>

          {/* Core App stats */}
          <div className="flex items-center gap-3 text-[9.5px] text-muted-foreground/60 font-semibold font-mono bg-white/[0.01] border border-white/5 rounded-md p-1 px-2">
            <div className="flex items-center gap-0.5 text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" />
              <span>{stats.rating} Rating</span>
            </div>
            <div className="w-0.5 h-0.5 bg-white/20 rounded-full" />
            <div className="flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              <span>{stats.users} Users</span>
            </div>
            <div className="w-0.5 h-0.5 bg-white/20 rounded-full" />
            <div>
              <span>{stats.version}</span>
            </div>
          </div>
        </div>

        {/* Tags footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 flex-wrap overflow-hidden h-5">
            {app.tags.slice(0, 2).map((tag, idx) => (
              <Badge
                key={`${app.id}-tag-${idx}-${tag}`}
                variant="secondary"
                className="text-[8.5px] bg-white/5 hover:bg-white/10 text-muted-foreground border-0 px-2 py-0.5 font-bold"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <span className="text-[9px] text-primary/70 font-extrabold uppercase tracking-wider group-hover:underline">
            Launch App
          </span>
        </div>
      </div>
    </motion.div>
  );
};
