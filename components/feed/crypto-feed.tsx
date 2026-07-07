'use client';

import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { NewsCard } from './news-card';
import { FeedSkeleton } from '@/components/ui/loading-skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/lib/store/wallet';
import { Heart, MessageSquare, Send, Share2, Sparkles, User, Newspaper, Users, Activity, RefreshCw, PenSquare, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FeedTab = 'news' | 'community' | 'activity';

interface CryptoFeedProps {
  onTradeClick?: (symbol: string) => void;
}

export function CryptoFeed({ onTradeClick }: CryptoFeedProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
  const { pubkey, hasWallet, activity } = useWalletStore();
  const [activeTab, setActiveTab] = useState<FeedTab>('news');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<Record<string, boolean>>({});

  // ── SWR: RSS News (30s refresh) ──
  const { data: newsData, isLoading: newsLoading, error: newsError, mutate: mutateNews } = useSWR(
    activeTab === 'news' ? `${apiBase}/api/news` : null,
    fetcher,
    { refreshInterval: 30000, dedupingInterval: 10000 }
  );

  // ── SWR: Community Posts (8s refresh) ──
  const { data: feedData, mutate: mutatePosts, isLoading: postsLoading, error: postsError } = useSWR(
    activeTab === 'community' ? `${apiBase}/api/posts?limit=30` : null,
    fetcher,
    { refreshInterval: 8000, dedupingInterval: 3000 }
  );

  const newsArticles = Array.isArray(newsData) ? newsData : [];
  const posts = feedData?.posts || [];

  // ── Compose Post State ──
  const [composeText, setComposeText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const handleComposeSubmit = useCallback(async () => {
    if (!composeText.trim() || !pubkey || composeSubmitting) return;
    setComposeSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: pubkey, content: composeText.trim() }),
      });
      if (res.ok) {
        setComposeText('');
        setIsComposing(false);
        mutatePosts();
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setComposeSubmitting(false);
    }
  }, [composeText, pubkey, composeSubmitting, apiBase, mutatePosts]);

  const handleToggleLike = async (postId: string) => {
    if (!pubkey) return;
    try {
      const updatedPosts = posts.map((p: any) => {
        if (p._id === postId) {
          const alreadyLiked = p.likes.includes(pubkey);
          const newLikes = alreadyLiked
            ? p.likes.filter((addr: string) => addr !== pubkey)
            : [...p.likes, pubkey];
          return { ...p, likes: newLikes };
        }
        return p;
      });
      mutatePosts({ ...feedData, posts: updatedPosts }, false);
      const res = await fetch(`${apiBase}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: pubkey }),
      });
      if (res.ok) mutatePosts();
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim() || !pubkey || isSubmittingComment[postId]) return;
    try {
      setIsSubmittingComment((prev) => ({ ...prev, [postId]: true }));
      const res = await fetch(`${apiBase}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: pubkey, content: text.trim() }),
      });
      if (res.ok) {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
        mutatePosts();
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setIsSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address === 'System') return 'System';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  // ── On-chain Activity Items from Zustand ──
  const onChainActivity = (activity || []).slice(0, 20);

  const tabs: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'news', label: 'News', icon: <Newspaper className="h-3.5 w-3.5" /> },
    { id: 'community', label: 'Community', icon: <Users className="h-3.5 w-3.5" /> },
    { id: 'activity', label: 'On-Chain', icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* ── Tab Bar ── */}
      <div className="flex gap-1 p-1 rounded-xl premium-depth-inset">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-primary shadow-sm border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: News ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'news' && (
          <motion.div
            key="news"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Refresh button */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                Solana Ecosystem • Live RSS Feed
              </span>
              <button
                onClick={() => mutateNews()}
                className="text-muted-foreground hover:text-primary transition p-1 rounded-md hover:bg-white/[0.03]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {newsLoading ? (
              <FeedSkeleton count={4} />
            ) : newsError ? (
              <div className="text-center py-8 border border-dashed border-red-500/30 rounded-xl bg-red-500/5">
                <p className="text-xs text-red-400 font-semibold">Failed to load news feed. Retrying...</p>
              </div>
            ) : newsArticles.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
                }}
                className="space-y-3"
              >
                {newsArticles.map((article: any, idx: number) => (
                  <motion.div
                    key={article.url || idx}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block glass-card rounded-xl border border-border/50 p-4 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        {article.image && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-border/30">
                            <img
                              src={article.image}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Source + Time */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-primary/80 uppercase tracking-wider">
                              {article.sourceIcon || '📰'} {article.source}
                            </span>
                            <span className="text-[8px] text-muted-foreground/60">
                              {formatTimeAgo(article.createdAt)}
                            </span>
                          </div>
                          {/* Title */}
                          <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary/90 transition-colors">
                            {article.title}
                          </h4>
                          {/* Snippet */}
                          {article.content && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                              {article.content}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition shrink-0 mt-1" />
                      </div>
                    </a>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <Newspaper className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No articles available at the moment.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB: Community ── */}
        {activeTab === 'community' && (
          <motion.div
            key="community"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Compose Button / Form */}
            {hasWallet && pubkey && (
              <div className="glass-card rounded-xl border border-border/50 p-4 space-y-3">
                {isComposing ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-emerald-500/15 flex items-center justify-center border border-border/40 font-mono text-[9px] font-black uppercase text-foreground shrink-0">
                        {pubkey.slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={composeText}
                          onChange={(e) => setComposeText(e.target.value.slice(0, 280))}
                          placeholder="What's happening on Solana?"
                          className="w-full bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground/50 resize-none min-h-[60px]"
                          autoFocus
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                          <span className={`text-[9px] font-mono ${composeText.length > 260 ? 'text-rose-400' : 'text-muted-foreground/50'}`}>
                            {composeText.length}/280
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setIsComposing(false); setComposeText(''); }}
                              className="h-7 text-[10px] text-muted-foreground"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleComposeSubmit}
                              disabled={!composeText.trim() || composeSubmitting}
                              className="h-7 text-[10px] bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:opacity-40"
                            >
                              {composeSubmitting ? 'Posting...' : 'Post'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsComposing(true)}
                    className="w-full flex items-center gap-3 text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-emerald-500/15 flex items-center justify-center border border-border/40 font-mono text-[9px] font-black uppercase text-foreground shrink-0">
                      {pubkey.slice(0, 2)}
                    </div>
                    <span className="text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition">
                      Share something with the community...
                    </span>
                    <PenSquare className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition ml-auto" />
                  </button>
                )}
              </div>
            )}

            {postsLoading && posts.length === 0 ? (
              <FeedSkeleton count={3} />
            ) : postsError ? (
              <div className="text-center py-8 border border-dashed border-red-500/30 rounded-xl bg-red-500/5">
                <p className="text-xs text-red-400 font-semibold">Failed to load community feed.</p>
              </div>
            ) : posts.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
                }}
                className="space-y-3"
              >
                {posts.map((post: any) => {
                  const isLiked = pubkey ? post.likes?.includes(pubkey) : false;
                  const commentsList = post.comments || [];
                  const isCommentsExpanded = !!expandedComments[post._id];

                  return (
                    <motion.div
                      key={post._id}
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    >
                      <div className="group glass-card rounded-xl border border-border/50 p-4 space-y-3 transition-all duration-300 relative overflow-hidden select-none hover:shadow-lg hover:shadow-primary/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-emerald-500/15 flex items-center justify-center border border-border/40 font-mono text-[9px] font-black uppercase text-foreground">
                              {post.walletAddress.slice(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground">
                                  {formatAddress(post.walletAddress)}
                                </span>
                                {pubkey && post.walletAddress === pubkey && (
                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">YOU</span>
                                )}
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {formatTimeAgo(post.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-bold tracking-wider uppercase">
                            <Sparkles className="h-3 w-3 text-primary/50" />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed font-normal whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <button
                              onClick={() => handleToggleLike(post._id)}
                              disabled={!pubkey}
                              className={`hover:text-rose-400 transition flex items-center gap-1.5 text-xs ${isLiked ? 'text-rose-500 font-extrabold' : ''}`}
                            >
                              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                              <span className="text-[10px] font-bold">{post.likes?.length || 0}</span>
                            </button>
                            <button
                              onClick={() => toggleComments(post._id)}
                              className={`hover:text-primary transition flex items-center gap-1.5 text-xs ${isCommentsExpanded ? 'text-primary' : ''}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-[10px] font-bold">{commentsList.length}</span>
                            </button>
                          </div>
                          <button className="hover:text-primary transition text-muted-foreground/40">
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Comments Section */}
                        <AnimatePresence>
                          {isCommentsExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden space-y-3 pt-3 border-t border-border/10"
                            >
                              {hasWallet && pubkey && (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={commentInputs[post._id] || ''}
                                    onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                                    placeholder="Write a comment..."
                                    className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddComment(post._id)}
                                    disabled={!(commentInputs[post._id] || '').trim() || isSubmittingComment[post._id]}
                                    className="h-8 w-8 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {commentsList.map((comment: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-muted/10 p-2.5 rounded-lg border border-border/20 text-xs">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-extrabold text-foreground text-[10px]">
                                        {formatAddress(comment.walletAddress)}
                                      </span>
                                      <span className="text-[8px] text-muted-foreground">
                                        {formatTimeAgo(comment.timestamp || comment.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground font-normal leading-normal">{comment.content}</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No community posts yet. Be the first to share!</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB: On-Chain Activity ── */}
        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
              Your Wallet Activity • Solana Devnet
            </span>

            {!pubkey ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl space-y-3">
                <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-xs text-muted-foreground">Connect your wallet to see on-chain activity.</p>
              </div>
            ) : onChainActivity.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
                }}
                className="space-y-2"
              >
                {onChainActivity.map((act: any, idx: number) => (
                  <motion.div
                    key={act.id || idx}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    className="glass-card rounded-xl border border-border/40 p-3.5 flex items-center justify-between hover:border-primary/15 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        act.kind === 'send' ? 'bg-rose-500/10 text-rose-400' :
                        act.kind === 'swap' ? 'bg-purple-500/10 text-purple-400' :
                        act.kind === 'onramp' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {act.kind === 'send' ? '↗' : act.kind === 'swap' ? '⇄' : act.kind === 'onramp' ? '↓' : '◉'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{act.summary}</span>
                        <span className="text-[9px] text-muted-foreground">{formatTimeAgo(act.ts)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {act.status && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          act.status === 'Success' ? 'bg-emerald-500/10 text-emerald-400' :
                          act.status === 'Failed' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {act.status}
                        </span>
                      )}
                      {act.txSignature && (
                        <a
                          href={`https://explorer.solana.com/tx/${act.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground/40 hover:text-primary transition"
                          title="View on Solana Explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-10 border border-dashed border-border rounded-xl space-y-3">
                <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-xs text-muted-foreground">No on-chain activity found yet.</p>
                <p className="text-[10px] text-muted-foreground/60">Send a transaction to see it appear here.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
