'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { NewsCard } from './news-card';
import { FeedSkeleton } from '@/components/ui/loading-skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/lib/store/wallet';
import { Heart, MessageSquare, Send, Share2, Sparkles, User } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CryptoFeedProps {
  onTradeClick?: (symbol: string) => void;
}

export function CryptoFeed({ onTradeClick }: CryptoFeedProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
  const { pubkey, hasWallet } = useWalletStore();
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<Record<string, boolean>>({});

  // SWR for DB posts fetching (paginated / auto-refresh every 8s)
  const { data: feedData, mutate, isLoading, error } = useSWR(
    `${apiBase}/api/posts?limit=30`,
    fetcher,
    { refreshInterval: 8000 }
  );

  const posts = feedData?.posts || [];

  const handleToggleLike = async (postId: string) => {
    if (!pubkey) return;

    try {
      // Optimistic Update
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

      mutate({ ...feedData, posts: updatedPosts }, false);

      const res = await fetch(`${apiBase}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: pubkey }),
      });

      if (res.ok) {
        mutate();
      }
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
        body: JSON.stringify({
          walletAddress: pubkey,
          content: text.trim(),
        }),
      });

      if (res.ok) {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
        mutate();
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

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  return (
    <div className="space-y-5">


      {/* Loading State */}
      {isLoading && posts.length === 0 ? (
        <FeedSkeleton count={3} />
      ) : error ? (
        <div className="text-center py-8 border border-dashed border-red-500/30 rounded-xl bg-red-500/5">
          <p className="text-xs text-red-400 font-semibold">Failed to load Solana activity feed. Please try again.</p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
          className="space-y-4"
        >
          {posts.map((post: any) => {
            const isNews = post.type === 'news';
            if (isNews && post.metadata) {
              const article = {
                title: post.metadata.title || 'Solana Ecosystem Update',
                source: post.metadata.source || 'Ecosystem',
                url: post.metadata.url || '#',
                image: post.metadata.image,
                content: post.content,
                createdAt: post.createdAt,
              };
              return (
                <motion.div
                  key={post._id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <NewsCard article={article} />
                </motion.div>
              );
            }

            // User Post UI (Social Media Style)
            const isLiked = pubkey ? post.likes?.includes(pubkey) : false;
            const commentsList = post.comments || [];
            const isCommentsExpanded = !!expandedComments[post._id];

            return (
              <motion.div
                key={post._id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <div className="group glass-card rounded-2xl border border-border/60 p-5 space-y-4 transition-all duration-300 relative overflow-hidden select-none hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar */}
                      <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-emerald-500/15 flex items-center justify-center border border-border/40 font-mono text-[9px] font-black uppercase text-foreground">
                        {post.walletAddress.slice(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground">
                            {formatAddress(post.walletAddress)}
                          </span>
                          {post.walletAddress === 'System' && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">STAFF</span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80 font-bold tracking-wider uppercase">
                      <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                      <span>Social Hub</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed font-normal whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border/20">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <button
                        onClick={() => handleToggleLike(post._id)}
                        disabled={!pubkey}
                        className={`hover:text-rose-400 transition flex items-center gap-1.5 text-xs ${
                          isLiked ? 'text-rose-500 font-extrabold' : ''
                        }`}
                      >
                        <Heart className={`h-4.5 w-4.5 ${isLiked ? 'fill-current' : ''}`} />
                        <span className="text-[10px] font-bold">{post.likes?.length || 0}</span>
                      </button>

                      <button
                        onClick={() => toggleComments(post._id)}
                        className={`hover:text-primary transition flex items-center gap-1.5 text-xs ${
                          isCommentsExpanded ? 'text-primary' : ''
                        }`}
                      >
                        <MessageSquare className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">{commentsList.length}</span>
                      </button>
                    </div>

                    <button className="hover:text-primary transition text-muted-foreground/60">
                      <Share2 className="h-4 w-4" />
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
                        {/* Comment Input */}
                        {hasWallet && pubkey && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentInputs[post._id] || ''}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))
                              }
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

                        {/* Comments List */}
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {commentsList.map((comment: any, cIdx: number) => (
                            <div key={cIdx} className="bg-muted/10 p-2.5 rounded-lg border border-border/20 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-extrabold text-foreground text-[10px]">
                                  {formatAddress(comment.walletAddress)}
                                </span>
                                <span className="text-[8px] text-muted-foreground">
                                  {new Date(comment.timestamp || comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
      )}

      {/* Fallback Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="text-center py-10 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No Solana activities found at the moment.</p>
        </div>
      )}
    </div>
  );
}
