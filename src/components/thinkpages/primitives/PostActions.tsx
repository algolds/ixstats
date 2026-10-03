"use client";

import React, { useState, useCallback, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  Heart,
  ChatBubble as MessageCircle,
  Refresh as Repeat2,
  ShareAndroid as Share,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { ReactionPopup } from "../ReactionPopup";
import { RepostModal } from "../RepostModal";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

import {
  parseReactionCounts,
  updateReactionsInCacheData,
  updatePostReactionsList,
} from "./ReactionCacheUpdater";
import { ActionPill } from "~/components/ui/action-pill";

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

  const reactions: any[] = post.reactions ?? [];
  const isLiked = reactions.some(
    (r) => r.accountId === currentUserAccountId && r.reactionType === "like"
  );
  const isReposted = post.reposts?.some((r: any) => r.accountId === currentUserAccountId) ?? false;
  const likeCount: number = post.likeCount ?? 0;
  const repostCount: number = post.repostCount ?? 0;
  const replyCount: number = post.replyCount ?? 0;
  const reactionCounts = parseReactionCounts(post.reactionCounts);

  const queryClient = useQueryClient();

  // Context type for mutation error handlers
  type MutationContext = {
    queriesToBackup: [any[], any][];
  };

  // Feed lists whose cached posts carry reaction state
  const feedKeys = () => [
    getQueryKey(api.thinkpages.getFeed),
    getQueryKey(api.thinkpages.getPostsByClerkUserId),
    getQueryKey(api.activities.getGlobalFeed),
    getQueryKey(api.activities.getFollowingFeed),
  ];

  // Cancel in-flight fetches, snapshot the caches for rollback, then patch them optimistically
  const applyOptimisticReaction = async (
    variables: { postId: string; accountId: string },
    reactionType: string,
    isRemoval: boolean
  ): Promise<MutationContext> => {
    const activeAccount = accounts.find((a) => a.id === variables.accountId);
    const postKey = getQueryKey(api.thinkpages.getPost);
    const keys = [...feedKeys(), postKey, getQueryKey(api.thinkpages.getPostReactions)];

    await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));

    const queriesToBackup = keys.flatMap((queryKey) =>
      queryClient.getQueriesData({ queryKey })
    ) as [any[], any][];

    for (const queryKey of [...feedKeys(), postKey]) {
      queryClient.setQueriesData({ queryKey }, (old: any) =>
        updateReactionsInCacheData(
          old,
          variables.postId,
          variables.accountId,
          reactionType,
          isRemoval
        )
      );
    }

    // Also update the reactions list query for this specific post
    queryClient.setQueriesData(
      { queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }) },
      (old: any) =>
        updatePostReactionsList(
          old,
          variables.postId,
          variables.accountId,
          reactionType,
          isRemoval,
          activeAccount
        )
    );

    return { queriesToBackup };
  };

  const rollbackReaction = (context: MutationContext | undefined) => {
    for (const [queryKey, queryData] of context?.queriesToBackup ?? []) {
      queryClient.setQueryData(queryKey, queryData);
    }
  };

  const settleReaction = (postId: string) => {
    // Silent invalidation of feeds (avoid refetch storms)
    for (const queryKey of feedKeys()) {
      void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    }

    // Active refetch of specific post and its reactions since they are cheap
    void queryClient.invalidateQueries({
      queryKey: getQueryKey(api.thinkpages.getPost, { postId }),
    });
    void queryClient.invalidateQueries({
      queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId }),
    });
  };

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onMutate: (variables) => applyOptimisticReaction(variables, variables.reactionType, false),
    onSuccess: (data) => {
      // Show feedback
      const dataAny = data as any;
      if ("removed" in dataAny && dataAny.removed) {
        notify.success("Reaction removed");
      } else if ("updated" in dataAny && dataAny.updated) {
        notify.success("Reaction updated");
      } else {
        notify.success("Reaction added");
      }
    },
    onError: (error, variables, context) => {
      console.error("addReactionMutation error:", error);
      rollbackReaction(context);
      notify.error(error.message || "Failed to add reaction");
    },
    onSettled: (data, error, variables) => settleReaction(variables.postId),
  });

  const removeReactionMutation = api.thinkpages.removeReaction.useMutation({
    onMutate: (variables) => applyOptimisticReaction(variables, "", true),
    onSuccess: () => {
      notify.success("Reaction removed");
    },
    onError: (error, variables, context) => {
      console.error("removeReactionMutation error:", error);
      rollbackReaction(context);
      notify.error(error.message || "Failed to remove reaction");
    },
    onSettled: (data, error, variables) => settleReaction(variables.postId),
  });

  const handleLike = useCallback(async () => {
    if (!currentUserAccountId) {
      notify.error("Please select a ThinkPages account first to like posts");
      return;
    }

    if (!postId) {
      notify.error("Invalid post ID");
      return;
    }

    const existingReaction = reactions.find(
      (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
    );

    try {
      if (existingReaction) {
        await removeReactionMutation.mutateAsync({
          postId,
          accountId: currentUserAccountId,
        });
      } else {
        await addReactionMutation.mutateAsync({
          postId,
          accountId: currentUserAccountId,
          reactionType: "like",
        });
      }

      onLike?.(postId);
    } catch (error: any) {
      notify.error(error.message || "Failed to update reaction");
    }
  }, [
    postId,
    currentUserAccountId,
    reactions,
    addReactionMutation,
    removeReactionMutation,
    onLike,
    notify,
  ]);

  const handleRepost = useCallback(() => {
    if (!currentUserAccountId) {
      notify.error("Please select an account to interact");
      return;
    }
    setShowRepostModal(true);
  }, [currentUserAccountId, notify]);

  const handleReaction = useCallback(
    async (reactionType: string) => {
      if (!currentUserAccountId) {
        notify.error("Please select an account to interact");
        return;
      }

      if (!postId) {
        notify.error("Invalid post ID");
        return;
      }

      // Validate reaction type (including Discord emojis)
      const validReactionTypes = [
        "like",
        "laugh",
        "angry",
        "sad",
        "fire",
        "thumbsup",
        "thumbsdown",
      ];
      const isDiscordEmoji = reactionType.startsWith("discord:");
      if (!validReactionTypes.includes(reactionType) && !isDiscordEmoji) {
        notify.error("Invalid reaction type");
        return;
      }

      if (addReactionMutation.isPending || removeReactionMutation.isPending) {
        notify.error("Please wait for the current reaction to complete");
        return;
      }

      const existingReaction = reactions.find((r: any) => r.accountId === currentUserAccountId);

      setShowReactionPopup(false);

      try {
        if (existingReaction && existingReaction.reactionType === reactionType) {
          await removeReactionMutation.mutateAsync({
            postId,
            accountId: currentUserAccountId,
          });
        } else {
          await addReactionMutation.mutateAsync({
            postId,
            accountId: currentUserAccountId,
            reactionType: reactionType as
              "like" | "laugh" | "angry" | "sad" | "fire" | "thumbsup" | "thumbsdown" | string,
          });
        }

        onReaction?.(postId, reactionType);
      } catch {
        // Handled in mutation onError
      }
    },
    [
      postId,
      currentUserAccountId,
      reactions,
      addReactionMutation,
      removeReactionMutation,
      onReaction,
      notify,
    ]
  );

  const handleShare = useCallback(() => {
    const postUrl = `${window.location.origin}${withBasePath(`/thinkpages/post/${postId}`)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: "ThinkPages post",
          text: "Check out this post on ThinkPages",
          url: postUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(postUrl);
          notify.success("Post link copied to clipboard");
        });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(postUrl);
      notify.success("Post link copied to clipboard");
    }
    onShare?.(postId);
  }, [postId, onShare, notify]);

  // ActionPill has two sizes; the large toolbar uses the standalone `md` pill.
  const pillSize = size === "sm" ? "sm" : "md";

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {/* Reply */}
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

        {/* Repost */}
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

        {/* Like / reaction */}
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

        {/* Share */}
        <ActionPill size={pillSize} icon={<Share />} onClick={handleShare} aria-label="Share post">
          Share
        </ActionPill>
      </div>

      {/* Repost Modal */}
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
