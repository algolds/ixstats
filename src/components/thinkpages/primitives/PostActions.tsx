"use client";

import React, { useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  Heart,
  ChatBubble as MessageCircle,
  Refresh as Repeat2,
  ShareAndroid as Share,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { feedShareCopy } from "~/lib/thinkpages/share-copy";
import { ReactionPopup } from "../ReactionPopup";
import { RepostModal } from "../RepostModal";
import { parseReactionCounts } from "./ReactionCacheUpdater";
import { useReactionMutations } from "./useReactionMutations";
import { ActionPill } from "~/components/ui/action-pill";

const VALID_REACTION_TYPES = ["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"];

function getPostStats(post: any, accountId: string) {
  const reactions: any[] = post.reactions ?? [];
  return {
    reactions,
    isLiked: reactions.some((r) => r.accountId === accountId && r.reactionType === "like"),
    isReposted: post.reposts?.some((r: any) => r.accountId === accountId) ?? false,
    likeCount: (post.likeCount ?? 0) as number,
    repostCount: (post.repostCount ?? 0) as number,
    replyCount: (post.replyCount ?? 0) as number,
    reactionCounts: parseReactionCounts(post.reactionCounts),
  };
}

function sharePost(postId: string, notify: ReturnType<typeof useNotify>) {
  const postUrl = `${window.location.origin}${withBasePath(`/dashboard/post/${postId}`)}`;
  const copyLink = () => {
    void navigator.clipboard.writeText(postUrl);
    notify.success("Post link copied to clipboard");
  };

  if (navigator.share) {
    navigator
      .share({ ...feedShareCopy("post"), url: postUrl })
      .catch(copyLink);
  } else if (navigator.clipboard) {
    copyLink();
  }
}

interface PostActionsProps {
  postId: string;
  currentUserAccountId: string;
  post: any;
  accounts?: any[];
  countryId?: string;
  isOwner?: boolean;
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onReaction?: (postId: string, reactionType: string) => void;
  showCounts?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PostActions({
  postId,
  currentUserAccountId,
  post,
  accounts = [],
  countryId = "",
  isOwner = false,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  showCounts = true,
  size = "md",
  className = "",
}: PostActionsProps) {
  const notify = useNotify();
  const [showReactionPopup, setShowReactionPopup] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

  const { reactions, isLiked, isReposted, likeCount, repostCount, replyCount, reactionCounts } =
    getPostStats(post, currentUserAccountId);

  const { addReactionMutation, removeReactionMutation } = useReactionMutations(accounts);

  // Removes the account's reaction when it already has `type`, otherwise adds `type`.
  const toggleReaction = (existingType: string | undefined, type: string) =>
    existingType === type
      ? removeReactionMutation.mutateAsync({ postId, accountId: currentUserAccountId })
      : addReactionMutation.mutateAsync({
          postId,
          accountId: currentUserAccountId,
          reactionType: type,
        });

  const handleLike = async () => {
    if (!currentUserAccountId) {
      notify.error("Please select a ThinkPages account first to like posts");
      return;
    }
    if (!postId) {
      notify.error("Invalid post ID");
      return;
    }

    try {
      await toggleReaction(isLiked ? "like" : undefined, "like");
      onLike?.(postId);
    } catch (error: any) {
      notify.error(error.message || "Failed to update reaction");
    }
  };

  const handleRepost = () => {
    if (!currentUserAccountId) {
      notify.error("Please select an account to interact");
      return;
    }
    setShowRepostModal(true);
  };

  const handleReaction = async (reactionType: string) => {
    if (!currentUserAccountId) {
      notify.error("Please select an account to interact");
      return;
    }
    if (!postId) {
      notify.error("Invalid post ID");
      return;
    }
    if (!VALID_REACTION_TYPES.includes(reactionType) && !reactionType.startsWith("discord:")) {
      notify.error("Invalid reaction type");
      return;
    }
    if (addReactionMutation.isPending || removeReactionMutation.isPending) {
      notify.error("Please wait for the current reaction to complete");
      return;
    }

    const existing = reactions.find((r) => r.accountId === currentUserAccountId);
    setShowReactionPopup(false);

    try {
      await toggleReaction(existing?.reactionType, reactionType);
      onReaction?.(postId, reactionType);
    } catch {
      // Handled in mutation onError
    }
  };

  const handleShare = () => {
    sharePost(postId, notify);
    onShare?.(postId);
  };

  // ActionPill has two sizes; the large toolbar uses the standalone `md` pill.
  const pillSize = size === "sm" ? "sm" : "md";

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <ActionPill
          size={pillSize}
          tone="info"
          icon={<MessageCircle />}
          count={showCounts && replyCount > 0 ? replyCount : undefined}
          onClick={() => onReply?.(postId)}
          aria-label="Reply to post"
        >
          Reply
        </ActionPill>

        <ActionPill
          size={pillSize}
          pressed={isReposted}
          icon={<Repeat2 />}
          count={showCounts && repostCount > 0 ? repostCount : undefined}
          onClick={handleRepost}
          aria-label="Repost"
        >
          Repost
        </ActionPill>

        <div className="relative">
          <ActionPill
            ref={reactionButtonRef}
            size={pillSize}
            tone="secondary"
            pressed={isLiked || showReactionPopup}
            icon={<Heart className={cn(isLiked && "fill-current")} />}
            count={showCounts && likeCount > 0 ? likeCount : undefined}
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowReactionPopup(!showReactionPopup);
            }}
            className={cn(!currentUserAccountId && "cursor-not-allowed opacity-50")}
            title={
              currentUserAccountId
                ? "Click to like (right-click for emoji reactions)"
                : "Please select a ThinkPages account first"
            }
            aria-label="Like post"
          >
            {isLiked ? "Liked" : "Like"}
          </ActionPill>

          {/* Reaction popup, anchored to the like button (opened by right-click). */}
          <Popover open={showReactionPopup} onOpenChange={setShowReactionPopup}>
            <PopoverTrigger asChild>
              <span
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute inset-0"
              />
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-auto p-3">
              <ReactionPopup
                onSelectReaction={handleReaction}
                postReactionCounts={reactionCounts}
              />
            </PopoverContent>
          </Popover>
        </div>

        <ActionPill size={pillSize} icon={<Share />} onClick={handleShare} aria-label="Share post">
          Share
        </ActionPill>
      </div>

      {showRepostModal && (
        <RepostModal
          open={showRepostModal}
          onOpenChange={setShowRepostModal}
          originalPost={post}
          countryId={countryId}
          selectedAccount={accounts.find((acc) => acc.id === currentUserAccountId)}
          accounts={accounts}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          isOwner={isOwner}
          onPost={() => {
            onRepost?.(postId);
            setShowRepostModal(false);
          }}
        />
      )}
    </div>
  );
}
