"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
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
import { RepostModal } from '../RepostModal';

interface PostActionsProps {
  postId: string;
  currentUserAccountId: string;
  post: any;
  accounts: any[];
  countryId: string;
  isOwner: boolean;
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
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
  post,
  accounts,
  countryId,
  isOwner,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
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
  const [showRepostModal, setShowRepostModal] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

  // Close reaction popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showReactionPopup && reactionButtonRef.current && !reactionButtonRef.current.contains(event.target as Node)) {
        setShowReactionPopup(false);
      }
    };

    if (showReactionPopup) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showReactionPopup]);

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
      r.accountId === currentUserAccountId && r.reactionType === 'like'
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
          accountId: currentUserAccountId,
          reactionType: 'like' 
        });
      }
      onLike?.(postId);
    } catch (error) {
      console.error('Error handling like:', error);
    }
  }, [postId, currentUserAccountId, reactions, addReactionMutation, removeReactionMutation, onLike]);

  const handleRepost = useCallback(() => {
    if (!currentUserAccountId) {
      toast.error('Please select an account to interact');
      return;
    }
    setShowRepostModal(true);
  }, [currentUserAccountId]);

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

    const existingReaction = reactions.find((r: any) => r.accountId === currentUserAccountId);

    try {
      if (existingReaction && existingReaction.reactionType === reactionType) {
        await removeReactionMutation.mutateAsync({ 
          postId, 
          accountId: currentUserAccountId 
        });
      } else {
        await addReactionMutation.mutateAsync({ 
          postId, 
          accountId: currentUserAccountId,
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
    if (navigator.share) {
      navigator.share({
        title: 'ThinkPages Post',
        text: 'Check out this post on ThinkPages',
        url: postUrl
      }).catch(() => {
        // Fallback to clipboard if share fails
        navigator.clipboard.writeText(postUrl);
        toast.success('Post link copied to clipboard!');
      });
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success('Post link copied to clipboard!');
    }
    onShare?.(postId);
  }, [postId, onShare]);

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonPadding = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-3' : 'p-2';

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
            ref={reactionButtonRef}
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
            {showReactionPopup && typeof window !== 'undefined' && createPortal(
              <div 
                className="fixed z-[99999]"
                style={{
                  top: reactionButtonRef.current ? reactionButtonRef.current.getBoundingClientRect().top - 10 : 0,
                  left: reactionButtonRef.current ? reactionButtonRef.current.getBoundingClientRect().left : 0,
                }}
              >
                <ReactionPopup
                  onSelectReaction={handleReaction}
                  postReactionCounts={reactionCounts}
                />
              </div>,
              document.body
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

      {/* Repost Modal */}
      {showRepostModal && createPortal(
        <RepostModal
          open={showRepostModal}
          onOpenChange={setShowRepostModal}
          originalPost={post}
          countryId={countryId}
          selectedAccount={accounts.find(acc => acc.id === currentUserAccountId)}
          accounts={accounts}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          isOwner={isOwner}
          onPost={() => {
            onRepost?.(postId);
            setShowRepostModal(false);
          }}
        />,
        document.body
      )}
    </div>
  );
}