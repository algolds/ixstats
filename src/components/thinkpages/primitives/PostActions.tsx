"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Share, 
  MoreHorizontal,
  Smile
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { ReactionPopup } from '../ReactionPopup';

interface PostActionsProps {
  postId: string;
  currentUserAccountId: string;
  isLiked?: boolean;
  isReposted?: boolean;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  reactions?: any[];
  reactionCounts?: Record<string, number>;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onReaction?: (postId: string, reactionType: string) => void;
  showCounts?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PostActions({
  postId,
  currentUserAccountId,
  isLiked = false,
  isReposted = false,
  likeCount = 0,
  repostCount = 0,
  replyCount = 0,
  reactions = [],
  reactionCounts = {},
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  showCounts = true,
  size = 'md',
  className = ''
}: PostActionsProps) {
  const [showReactionPopup, setShowReactionPopup] = useState(false);

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onSuccess: () => {
      toast.success('Reaction added!');
      onReaction?.(postId, 'success');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add reaction');
    }
  });

  const removeReactionMutation = api.thinkpages.removeReaction.useMutation({
    onSuccess: () => {
      onReaction?.(postId, 'removed');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove reaction');
    }
  });

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      toast.success('Post reposted successfully!');
      onRepost?.(postId);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to repost');
    }
  });

  const handleLike = useCallback(async () => {
    if (!currentUserAccountId) {
      toast.error('Please select an account to interact');
      return;
    }

    if (!postId) {
      toast.error('Invalid post ID');
      return;
    }

    const existingReaction = reactions.find((r: any) => 
      r.userId === currentUserAccountId && r.reactionType === 'like'
    );

    try {
      if (existingReaction) {
        await removeReactionMutation.mutateAsync({ 
          postId, 
          accountId: currentUserAccountId 
        });
      } else {
        await addReactionMutation.mutateAsync({ 
          postId, 
          userId: currentUserAccountId,
          reactionType: 'like' 
        });
      }
      onLike?.(postId);
    } catch (error) {
      console.error('Error handling like:', error);
    }
  }, [postId, currentUserAccountId, reactions, addReactionMutation, removeReactionMutation, onLike]);

  const handleRepost = useCallback(async () => {
    if (!currentUserAccountId) {
      toast.error('Please select an account to interact');
      return;
    }

    const comment = prompt('Add a comment to your repost (optional):');
    
    try {
      await createPostMutation.mutateAsync({
        userId: currentUserAccountId,
        content: comment || '',
        repostOfId: postId,
        hashtags: comment ? extractHashtags(comment) : [],
        mentions: comment ? extractMentions(comment) : [],
      });
    } catch (error) {
      // Error handled in mutation
    }
  }, [postId, currentUserAccountId, createPostMutation]);

  const handleReaction = useCallback(async (reactionType: string) => {
    if (!currentUserAccountId) {
      toast.error('Please select an account to interact');
      return;
    }

    if (!postId) {
      toast.error('Invalid post ID');
      return;
    }

    // Validate reaction type
    const validReactionTypes = ['like', 'laugh', 'angry', 'sad', 'fire', 'thumbsup', 'thumbsdown'];
    if (!validReactionTypes.includes(reactionType)) {
      toast.error('Invalid reaction type');
      return;
    }

    const existingReaction = reactions.find((r: any) => r.userId === currentUserAccountId);

    try {
      if (existingReaction && existingReaction.reactionType === reactionType) {
        await removeReactionMutation.mutateAsync({ 
          postId, 
          accountId: currentUserAccountId 
        });
      } else {
        await addReactionMutation.mutateAsync({ 
          postId, 
          userId: currentUserAccountId,
          reactionType: reactionType as "like" | "laugh" | "angry" | "sad" | "fire" | "thumbsup" | "thumbsdown"
        });
      }
      onReaction?.(postId, reactionType);
      setShowReactionPopup(false);
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [postId, currentUserAccountId, reactions, addReactionMutation, removeReactionMutation, onReaction, setShowReactionPopup]);

  const handleShare = useCallback(() => {
    const postUrl = `${window.location.origin}/thinkpages/post/${postId}`;
    navigator.clipboard.writeText(postUrl);
    toast.success('Post URL copied to clipboard!');
    onShare?.(postId);
  }, [postId, onShare]);

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonPadding = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-3' : 'p-2';

  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.slice(1)) : [];
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention.slice(1)) : [];
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        {/* Reply Button */}
        <button
          onClick={() => onReply?.(postId)}
          className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 transition-colors group"
        >
          <div className={cn(`${buttonPadding} rounded-full group-hover:bg-blue-500/20 transition-colors`)}>
            <MessageCircle className={iconSize} />
          </div>
          {showCounts && replyCount > 0 && (
            <span className="text-sm">{replyCount}</span>
          )}
        </button>

        {/* Repost Button */}
        <button
          onClick={handleRepost}
          disabled={createPostMutation.isPending}
          className={cn(
            "flex items-center gap-1 transition-colors group",
            isReposted ? "text-green-500" : "text-muted-foreground hover:text-green-500"
          )}
        >
          <div className={cn(`${buttonPadding} rounded-full group-hover:bg-green-500/20 transition-colors`)}>
            <Repeat2 className={iconSize} />
          </div>
          {showCounts && repostCount > 0 && (
            <span className="text-sm">{repostCount}</span>
          )}
        </button>

        {/* Like/Reaction Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowReactionPopup(!showReactionPopup);
            }}
            className={cn(
              "flex items-center gap-1 transition-colors group",
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
            )}
          >
            <div className={cn(`${buttonPadding} rounded-full group-hover:bg-red-500/20 transition-colors`)}>
              <Heart className={cn(iconSize, isLiked && "fill-current")} />
            </div>
            {showCounts && likeCount > 0 && (
              <span className="text-sm">{likeCount}</span>
            )}
          </button>

          <AnimatePresence>
            {showReactionPopup && (
              <div className="relative z-50">
                <ReactionPopup
                  reactions={reactions}
                  onSelectReaction={handleReaction}
                  postReactionCounts={reactionCounts}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 transition-colors group"
        >
          <div className={cn(`${buttonPadding} rounded-full group-hover:bg-blue-500/20 transition-colors`)}>
            <Share className={iconSize} />
          </div>
        </button>
      </div>
    </div>
  );
}