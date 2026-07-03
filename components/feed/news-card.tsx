'use client';

import React from 'react';
import { Newspaper, ExternalLink, MessageCircle, Heart, Share2 } from 'lucide-react';

interface NewsCardProps {
  article: {
    title: string;
    source: string;
    url: string;
    image?: string;
    content: string;
    createdAt: string;
  };
}

export function NewsCard({ article }: NewsCardProps) {
  const formatTime = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="group glass-card rounded-2xl border border-border/60 hover:border-primary/30 p-5 space-y-4 transition-all duration-300 relative overflow-hidden select-none hover:shadow-lg hover:shadow-primary/5">
      {/* Top subtle neon line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/30 via-purple-500/20 to-transparent" />

      {/* Header metadata */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-wider uppercase">
            {article.source}
          </span>
          <span className="text-[10px] text-muted-foreground/80 font-medium">{formatTime(article.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
          <Newspaper className="h-3.5 w-3.5 text-primary" />
          <span>Solana Ecosystem</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-extrabold text-foreground tracking-tight leading-snug group-hover:text-primary transition-colors">
        {article.title}
      </h3>

      {/* Main image - Render ONLY if article.image is present */}
      {article.image && (
        <div className="w-full aspect-[21/9] rounded-xl overflow-hidden border border-border/40 bg-muted/10 relative">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
        </div>
      )}

      {/* Snippet body text */}
      <p className="text-xs text-muted-foreground leading-relaxed font-normal">
        {article.content}
      </p>

      {/* Footer bar with link and mock metadata */}
      <div className="flex items-center justify-between pt-3.5 border-t border-border/20">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-primary hover:text-primary/80 transition flex items-center gap-1.5"
        >
          <span>Explore Source</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="flex items-center gap-4 text-muted-foreground/70">
          <button className="hover:text-rose-400 transition flex items-center gap-1 text-xs">
            <Heart className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">18</span>
          </button>
          <button className="hover:text-foreground transition flex items-center gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold">6</span>
          </button>
          <button className="hover:text-primary transition text-xs">
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
