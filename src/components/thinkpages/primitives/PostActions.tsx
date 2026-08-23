"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import { Heart, ChatBubble as MessageCircle, Refresh as Repeat2, ShareAndroid as Share } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { ReactionPopup } from "../ReactionPopup";
import { RepostModal } from "../RepostModal";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

import { updateReactionsInCacheData, updatePostReactionsList } from "./ReactionCacheUpdater";

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
  size?: "sm" | "md" | "lg";
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
  size = "md",
  className = "",
}: PostActionsProps) {
  const notify = useNotify();
  const [showReactionPopup, setShowReactionPopup] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

  // Close reaction popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showReactionPopup &&
        reactionButtonRef.current &&
        !reactionButtonRef.current.contains(event.target as Node)
      ) {
        // Check if the click is on the popup itself
        const popupElement = document.querySelector("[data-reaction-popup]");
        if (popupElement && popupElement.contains(event.target as Node)) {
          return; // Don't close if clicking on the popup
        }
        setShowReactionPopup(false);
      }
    };

    if (showReactionPopup) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
    return;
  }, [showReactionPopup]);

  const utils = api.useUtils();
  const queryClient = useQueryClient();

  // Define context type for mutation error handlers
  type MutationContext = {
    queriesToBackup: [any[], any][];
  };

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onMutate: async (variables): Promise<MutationContext> => {
      console.log("🚀 Optimistic update starting:", variables);

      const activeAccount = accounts.find((a) => a.id === variables.accountId);

      // 1. Cancel outgoing refetches for all relevant feeds
      const feedKey = getQueryKey(api.thinkpages.getFeed);
      const userFeedKey = getQueryKey(api.thinkpages.getPostsByClerkUserId);
      const postKey = getQueryKey(api.thinkpages.getPost);
      const globalFeedKey = getQueryKey(api.activities.getGlobalFeed);
      const followingFeedKey = getQueryKey(api.activities.getFollowingFeed);
      const reactionsKey = getQueryKey(api.thinkpages.getPostReactions);

      await queryClient.cancelQueries({ queryKey: feedKey });
      await queryClient.cancelQueries({ queryKey: userFeedKey });
      await queryClient.cancelQueries({ queryKey: postKey });
      await queryClient.cancelQueries({ queryKey: globalFeedKey });
      await queryClient.cancelQueries({ queryKey: followingFeedKey });
      await queryClient.cancelQueries({ queryKey: reactionsKey });

      // 2. Snapshot the current state for rollback
      const queriesToBackup = [
        ...queryClient.getQueriesData({ queryKey: feedKey }),
        ...queryClient.getQueriesData({ queryKey: userFeedKey }),
        ...queryClient.getQueriesData({ queryKey: postKey }),
        ...queryClient.getQueriesData({ queryKey: globalFeedKey }),
        ...queryClient.getQueriesData({ queryKey: followingFeedKey }),
        ...queryClient.getQueriesData({ queryKey: reactionsKey }),
      ] as [any[], any][];

      // 3. Apply optimistic updates in cache
      const updateCache = (key: any[]) => {
        queryClient.setQueriesData({ queryKey: key }, (old: any) =>
          updateReactionsInCacheData(
            old,
            variables.postId,
            variables.accountId,
            variables.reactionType,
            false
          )
        );
      };

      updateCache(feedKey);
      updateCache(userFeedKey);
      updateCache(postKey);
      updateCache(globalFeedKey);
      updateCache(followingFeedKey);

      // Also update the reactions list query for this specific post
      queryClient.setQueriesData(
        { queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }) },
        (old: any) =>
          updatePostReactionsList(
            old,
            variables.postId,
            variables.accountId,
            variables.reactionType,
            false,
            activeAccount
          )
      );

      return { queriesToBackup };
    },
    onSuccess: (data) => {
      // Show feedback
      const dataAny = data as any;
      if ("removed" in dataAny && dataAny.removed) {
        notify.success("Reaction removed!");
      } else if ("updated" in dataAny && dataAny.updated) {
        notify.success("Reaction updated!");
      } else {
        notify.success("Reaction added!");
      }
    },
    onError: (error, variables, context) => {
      console.error("❌ addReactionMutation ERROR:", error);
      // Rollback cache
      if (context?.queriesToBackup) {
        for (const [queryKey, queryData] of context.queriesToBackup) {
          queryClient.setQueryData(queryKey, queryData);
        }
      }
      notify.error(error.message || "Failed to add reaction");
    },
    onSettled: (data, error, variables) => {
      // Silent invalidation of feeds (avoid refetch storms)
      const feedKey = getQueryKey(api.thinkpages.getFeed);
      const userFeedKey = getQueryKey(api.thinkpages.getPostsByClerkUserId);
      const globalFeedKey = getQueryKey(api.activities.getGlobalFeed);
      const followingFeedKey = getQueryKey(api.activities.getFollowingFeed);

      void queryClient.invalidateQueries({ queryKey: feedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: userFeedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: globalFeedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: followingFeedKey, refetchType: "none" });

      // Active refetch of specific post and its reactions since they are cheap
      void queryClient.invalidateQueries({
        queryKey: getQueryKey(api.thinkpages.getPost, { postId: variables.postId }),
      });
      void queryClient.invalidateQueries({
        queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }),
      });
    },
  });

  const removeReactionMutation = api.thinkpages.removeReaction.useMutation({
    onMutate: async (variables): Promise<MutationContext> => {
      console.log("🚀 Optimistic remove starting:", variables);

      const activeAccount = accounts.find((a) => a.id === variables.accountId);

      // 1. Cancel outgoing refetches for all relevant feeds
      const feedKey = getQueryKey(api.thinkpages.getFeed);
      const userFeedKey = getQueryKey(api.thinkpages.getPostsByClerkUserId);
      const postKey = getQueryKey(api.thinkpages.getPost);
      const globalFeedKey = getQueryKey(api.activities.getGlobalFeed);
      const followingFeedKey = getQueryKey(api.activities.getFollowingFeed);
      const reactionsKey = getQueryKey(api.thinkpages.getPostReactions);

      await queryClient.cancelQueries({ queryKey: feedKey });
      await queryClient.cancelQueries({ queryKey: userFeedKey });
      await queryClient.cancelQueries({ queryKey: postKey });
      await queryClient.cancelQueries({ queryKey: globalFeedKey });
      await queryClient.cancelQueries({ queryKey: followingFeedKey });
      await queryClient.cancelQueries({ queryKey: reactionsKey });

      // 2. Snapshot the current state for rollback
      const queriesToBackup = [
        ...queryClient.getQueriesData({ queryKey: feedKey }),
        ...queryClient.getQueriesData({ queryKey: userFeedKey }),
        ...queryClient.getQueriesData({ queryKey: postKey }),
        ...queryClient.getQueriesData({ queryKey: globalFeedKey }),
        ...queryClient.getQueriesData({ queryKey: followingFeedKey }),
        ...queryClient.getQueriesData({ queryKey: reactionsKey }),
      ] as [any[], any][];

      // 3. Apply optimistic updates in cache
      const updateCache = (key: any[]) => {
        queryClient.setQueriesData({ queryKey: key }, (old: any) =>
          updateReactionsInCacheData(old, variables.postId, variables.accountId, "", true)
        );
      };

      updateCache(feedKey);
      updateCache(userFeedKey);
      updateCache(postKey);
      updateCache(globalFeedKey);
      updateCache(followingFeedKey);

      // Also update the reactions list query for this specific post
      queryClient.setQueriesData(
        { queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }) },
        (old: any) =>
          updatePostReactionsList(
            old,
            variables.postId,
            variables.accountId,
            "",
            true,
            activeAccount
          )
      );

      return { queriesToBackup };
    },
    onSuccess: () => {
      notify.success("Reaction removed!");
    },
    onError: (error, variables, context) => {
      console.error("❌ removeReactionMutation ERROR:", error);
      // Rollback cache
      if (context?.queriesToBackup) {
        for (const [queryKey, queryData] of context.queriesToBackup) {
          queryClient.setQueryData(queryKey, queryData);
        }
      }
      notify.error(error.message || "Failed to remove reaction");
    },
    onSettled: (data, error, variables) => {
      // Silent invalidation of feeds (avoid refetch storms)
      const feedKey = getQueryKey(api.thinkpages.getFeed);
      const userFeedKey = getQueryKey(api.thinkpages.getPostsByClerkUserId);
      const globalFeedKey = getQueryKey(api.activities.getGlobalFeed);
      const followingFeedKey = getQueryKey(api.activities.getFollowingFeed);

      void queryClient.invalidateQueries({ queryKey: feedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: userFeedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: globalFeedKey, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: followingFeedKey, refetchType: "none" });

      // Active refetch of specific post and its reactions since they are cheap
      void queryClient.invalidateQueries({
        queryKey: getQueryKey(api.thinkpages.getPost, { postId: variables.postId }),
      });
      void queryClient.invalidateQueries({
        queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }),
      });
    },
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
              | "like"
              | "laugh"
              | "angry"
              | "sad"
              | "fire"
              | "thumbsup"
              | "thumbsdown"
              | string,
          });
        }

        onReaction?.(postId, reactionType);
      } catch (error: any) {
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
          title: "ThinkPages Post",
          text: "Check out this post on ThinkPages",
          url: postUrl,
        })
        .catch(() => {
          navigator.clipboard.writeText(postUrl);
          notify.success("Post link copied to clipboard!");
        });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(postUrl);
      notify.success("Post link copied to clipboard!");
    }
    onShare?.(postId);
  }, [postId, onShare, notify]);

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const buttonPadding = size === "sm" ? "p-1" : size === "lg" ? "p-3" : "p-2";

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        {/* Reply Button */}
        <button
          onClick={() => onReply?.(postId)}
          className="text-muted-foreground group flex items-center gap-1 transition-colors hover:text-blue-500"
        >
          <div
            className={cn(
              `${buttonPadding} rounded-full transition-colors group-hover:bg-blue-500/20`
            )}
          >
            <MessageCircle className={iconSize} />
          </div>
          {showCounts && replyCount > 0 && <span className="text-sm">{replyCount}</span>}
        </button>

        {/* Repost Button */}
        <button
          onClick={handleRepost}
          className={cn(
            "group flex items-center gap-1 transition-colors",
            isReposted ? "text-green-500" : "text-muted-foreground hover:text-green-500"
          )}
        >
          <div
            className={cn(
              `${buttonPadding} rounded-full transition-colors group-hover:bg-green-500/20`
            )}
          >
            <Repeat2 className={iconSize} />
          </div>
          {showCounts && repostCount > 0 && <span className="text-sm">{repostCount}</span>}
        </button>

        {/* Like/Reaction Button */}
        <div className="relative">
          <button
            ref={reactionButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowReactionPopup(!showReactionPopup);
            }}
            className={cn(
              "group flex items-center gap-1 transition-colors",
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500",
              !currentUserAccountId && "cursor-not-allowed opacity-50",
              showReactionPopup && "ring-2 ring-blue-500/50"
            )}
            title={
              currentUserAccountId
                ? "Click to like (right-click for emoji reactions)"
                : "Please select a ThinkPages account first"
            }
          >
            <div
              className={cn(
                `${buttonPadding} rounded-full transition-colors group-hover:bg-red-500/20`
              )}
            >
              <Heart className={cn(iconSize, isLiked && "fill-current")} />
            </div>
            {showCounts && likeCount > 0 && <span className="text-sm">{likeCount}</span>}
          </button>

          {/* Reaction Popup */}
          {showReactionPopup &&
            typeof window !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                style={{ zIndex: 99998 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionPopup(false);
                }}
              >
                <div
                  className="pointer-events-auto fixed"
                  data-reaction-popup
                  style={{
                    zIndex: 99999,
                    top: reactionButtonRef.current
                      ? Math.max(10, reactionButtonRef.current.getBoundingClientRect().top - 60)
                      : 100,
                    left: reactionButtonRef.current
                      ? Math.max(10, reactionButtonRef.current.getBoundingClientRect().left - 140)
                      : 100,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ReactionPopup
                    onSelectReaction={handleReaction}
                    postReactionCounts={reactionCounts}
                  />
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="text-muted-foreground group flex items-center gap-1 transition-colors hover:text-blue-500"
        >
          <div
            className={cn(
              `${buttonPadding} rounded-full transition-colors group-hover:bg-blue-500/20`
            )}
          >
            <Share className={iconSize} />
          </div>
        </button>
      </div>

      {/* Repost Modal */}
      {showRepostModal &&
        createPortal(
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
          />,
          document.body
        )}
    </div>
  );
}
