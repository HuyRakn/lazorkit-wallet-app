'use client';

import React, { useState } from 'react';
import { Heart, MessageCircle, Send, Share2, Sparkles } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet';
import { Blockie } from '@/components/ui/blockie';
import { formatAddress } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface UserPostCardProps {
  post: {
    _id: string;
    walletAddress: string;
    content: string;
    likes: string[];
    comments: Array<{
      _id: string;
      walletAddress: string;
      content: string;
      timestamp: string;
    }>;
    createdAt: string;
    image?: string; // Support embedded image
  };
  onPostUpdated?: (updatedPost: any) => void;
}

export function UserPostCard({ post, onPostUpdated }: UserPostCardProps) {
  const { pubkey } = useWalletStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [liking, setLiking] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
  const isLiked = pubkey ? post.likes.includes(pubkey) : false;

  const handleLike = async () => {
    if (!pubkey || liking) return;
    setLiking(true);

    try {
      const response = await fetch(`${apiBase}/api/posts/${post._id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: pubkey }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onPostUpdated) {
          onPostUpdated({
            ...post,
            likes: data.likes,
          });
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
    } finally {
      setLiking(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubkey || !commentText.trim() || commenting) return;
    setCommenting(true);

    try {
      const response = await fetch(`${apiBase}/api/posts/${post._id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: pubkey,
          content: commentText.trim(),
        }),
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setCommentText('');
        if (onPostUpdated) {
          onPostUpdated(updatedPost);
        }
      }
    } catch (err) {
      console.error('Comment submission failed:', err);
    } finally {
      setCommenting(false);
    }
  };

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
    <div className="group glass-card rounded-2xl border border-border/60 hover:border-purple-500/20 p-5 space-y-4 transition-all duration-300 relative overflow-hidden select-none hover:shadow-lg hover:shadow-purple-500/5">
      {/* Top ambient colored light indicator */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500/30 via-primary/20 to-transparent" />

      {/* Header Info */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-border/80 shrink-0">
            <Blockie seed={post.walletAddress} size={8} scale={4} />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground">
                {formatAddress(post.walletAddress)}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[10px] text-muted-foreground/80 font-medium">Smart Account Devnet</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/80 font-medium">{formatTime(post.createdAt)}</span>
          <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Post Text content */}
      <p className="text-xs sm:text-sm text-foreground/90 font-normal leading-relaxed whitespace-pre-wrap pl-0.5">
        {post.content}
      </p>

      {/* Visual Attachment Card (Render ONLY if post.image is present) */}
      {post.image && (
        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-border/40 bg-muted/10 relative">
          <img
            src={post.image}
            alt="Attachment"
            className="w-full h-full object-cover group-hover:scale-[1.01] transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
        </div>
      )}

      {/* Interaction Toolbar */}
      <div className="flex items-center gap-6 pt-3 border-t border-border/20 text-muted-foreground">
        {/* Like trigger */}
        <button
          onClick={handleLike}
          disabled={!pubkey}
          className={`flex items-center gap-2 text-xs font-bold transition-colors ${
            isLiked ? 'text-primary' : 'hover:text-foreground'
          } ${!pubkey ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Heart className={`h-4.5 w-4.5 transition-transform active:scale-125 ${isLiked ? 'fill-primary text-primary' : ''}`} />
          <span className="text-[11px]">{post.likes.length} Likes</span>
        </button>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-xs font-bold hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4.5 w-4.5" />
          <span className="text-[11px]">{post.comments.length} Comments</span>
        </button>

        {/* Share trigger */}
        <button className="flex items-center gap-2 text-xs font-bold hover:text-foreground transition-colors ml-auto">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments Collapse Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-3.5 pt-3.5 border-t border-border/25"
          >
            {/* Comment timeline list */}
            {post.comments.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {post.comments.map((comment) => (
                  <div key={comment._id} className="bg-muted/10 border border-border/30 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-border/80">
                          <Blockie seed={comment.walletAddress} size={8} scale={2.5} />
                        </div>
                        <span className="font-bold text-foreground">{formatAddress(comment.walletAddress)}</span>
                      </div>
                      <span className="text-muted-foreground/60">{formatTime(comment.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-7 leading-normal font-normal">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 text-center py-2">No comments yet. Share your thoughts below!</p>
            )}

            {/* Input Composer */}
            {pubkey ? (
              <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={commenting}
                  placeholder="Type your Web3 reply..."
                  className="flex-1 bg-background/50 border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-0"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={commenting || !commentText.trim()}
                  className="h-9 px-3 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 text-center pt-1">Connect your passkey wallet to reply.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
