"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ReactionPopup } from "../ReactionPopup";
import { RepostModal } from "../RepostModal";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

// Helper to update reactions in any query cache data (supports Infinite, Standard, or Single Post data)
const updateReactionsInCacheData = (
  oldData: any,
  postId: string,
  accountId: string,
  reactionType: string,
  isRemove: boolean
) => {
  if (!oldData) return oldData;

  const updatePost = (post: any) => {
    if (!post || post.id !== postId) return post;

    const reactions = [...(post.reactions ?? [])];
    let reactionCounts: Record<string, number> = {};
    try {
      reactionCounts =
        typeof post.reactionCounts === "string"
          ? JSON.parse(post.reactionCounts)
          : { ...(post.reactionCounts ?? {}) };
    } catch (e) {
      reactionCounts = {};
    }

    const existingIndex = reactions.findIndex((r: any) => r.accountId === accountId);

    if (isRemove) {
      if (existingIndex !== -1) {
        const removedType = reactions[existingIndex].reactionType;
        reactions.splice(existingIndex, 1);
        reactionCounts[removedType] = Math.max(0, (reactionCounts[removedType] ?? 1) - 1);
        if (reactionCounts[removedType] === 0) {
          delete reactionCounts[removedType];
        }
      }
    } else {
      if (existingIndex !== -1) {
        const oldReactionType = reactions[existingIndex].reactionType;
        if (oldReactionType !== reactionType) {
          // Change reaction type
          reactions[existingIndex] = { ...reactions[existingIndex], reactionType };
          reactionCounts[oldReactionType] = Math.max(0, (reactionCounts[oldReactionType] ?? 1) - 1);
          if (reactionCounts[oldReactionType] === 0) {
            delete reactionCounts[oldReactionType];
          }
          reactionCounts[reactionType] = (reactionCounts[reactionType] ?? 0) + 1;
        } else {
          // Same type -> toggle off (act as remove)
          reactions.splice(existingIndex, 1);
          reactionCounts[reactionType] = Math.max(0, (reactionCounts[reactionType] ?? 1) - 1);
          if (reactionCounts[reactionType] === 0) {
            delete reactionCounts[reactionType];
          }
        }
      } else {
        // Add new reaction
        reactions.push({
          id: `optimistic-reaction-${Date.now()}`,
          accountId,
          reactionType,
          postId,
        });
        reactionCounts[reactionType] = (reactionCounts[reactionType] ?? 0) + 1;
      }
    }

    // Retain original type of reactionCounts (string vs object)
    const serializedReactionCounts =
      typeof post.reactionCounts === "string" ? JSON.stringify(reactionCounts) : reactionCounts;

    const likeCount = reactionCounts.like ?? 0;

    return {
      ...post,
      reactions,
      reactionCounts: serializedReactionCounts,
      likeCount,
    };
  };

  // Case 1: Infinite Query Data { pages: Array<{ posts: Array<any> }> }
  if (oldData.pages && Array.isArray(oldData.pages)) {
    return {
      ...oldData,
      pages: oldData.pages.map((page: any) => {
        if (!page || !Array.isArray(page.posts)) return page;
        return {
          ...page,
          posts: page.posts.map(updatePost),
        };
      }),
    };
  }

  // Case 2: Standard Query Data with posts array { posts: Array<any> }
  if (oldData.posts && Array.isArray(oldData.posts)) {
    return {
      ...oldData,
      posts: oldData.posts.map(updatePost),
    };
  }

  // Case 3: Single post object
  if (oldData.id === postId) {
    return updatePost(oldData);
  }

  return oldData;
};

// Helper to update the reactions list array in getPostReactions query cache
const updatePostReactionsList = (
  oldData: any[] | undefined,
  postId: string,
  accountId: string,
  reactionType: string,
  isRemove: boolean,
  activeAccount: any
) => {
  if (!oldData) return [];

  const existingIndex = oldData.findIndex((r) => r.accountId === accountId);

  if (isRemove) {
    if (existingIndex !== -1) {
      return oldData.filter((r) => r.accountId !== accountId);
    }
    return oldData;
  } else {
    // Toggling off same reaction type
    if (existingIndex !== -1 && oldData[existingIndex].reactionType === reactionType) {
      return oldData.filter((r) => r.accountId !== accountId);
    }

    const updatedReaction = {
      id: `optimistic-reaction-${Date.now()}`,
      postId,
      accountId,
      reactionType,
      account: activeAccount
        ? {
            id: activeAccount.id,
            displayName: activeAccount.displayName || "Unknown",
            username: activeAccount.username || "unknown",
            profileImageUrl: activeAccount.profileImageUrl || "",
            accountType: activeAccount.accountType || "citizen",
            verified: !!activeAccount.verified,
          }
        : {
            id: accountId,
            displayName: "You",
            username: "you",
            profileImageUrl: "",
            accountType: "citizen",
            verified: false,
          },
    };

    if (existingIndex !== -1) {
      const next = [...oldData];
      next[existingIndex] = updatedReaction;
      return next;
    } else {
      return [...oldData, updatedReaction];
    }
  }
};

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
  // Debug component initialization
  console.log("🔧 PostActions component initialized:", {
    postId,
    currentUserAccountId,
    isLiked,
    likeCount,
    reactionsCount: reactions?.length || 0,
    reactions: reactions,
    hasOnLike: !!onLike,
    hasOnReaction: !!onReaction,
    size,
    showCounts,
  });
  const [showReactionPopup, setShowReactionPopup] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

  // Debug popup state changes
  useEffect(() => {
    console.log("🎭 Reaction popup state changed:", { showReactionPopup, postId });
  }, [showReactionPopup, postId]);

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
    console.log("❤️ Heart button clicked!", {
      currentUserAccountId,
      postId,
      isLiked,
      reactions: reactions?.length || 0,
      hasAccount: !!currentUserAccountId,
      accountId: currentUserAccountId,
    });

    if (!currentUserAccountId) {
      notify.error("Please select a ThinkPages account first to like posts");
      console.warn("No currentUserAccountId provided to heart button");
      return;
    }

    if (!postId) {
      notify.error("Invalid post ID");
      console.error("No postId provided to heart button");
      return;
    }

    const existingReaction = reactions.find(
      (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
    );

    console.log("🔍 Existing reaction check:", {
      existingReaction: !!existingReaction,
      reactionId: existingReaction?.id,
      willRemove: !!existingReaction,
    });

    try {
      if (existingReaction) {
        console.log("🗑️ Removing like reaction for account:", currentUserAccountId);
        await removeReactionMutation.mutateAsync({
          postId,
          accountId: currentUserAccountId,
        });
      } else {
        console.log("➕ Adding like reaction for account:", currentUserAccountId);
        await addReactionMutation.mutateAsync({
          postId,
          accountId: currentUserAccountId,
          reactionType: "like",
        });
      }

      // Call the parent callback if provided
      onLike?.(postId);
      console.log("✅ Heart button action completed successfully");
    } catch (error: any) {
      console.error("❌ Error handling like:", error);
      notify.error(error.message || "Failed to update reaction");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    postId,
    currentUserAccountId,
    reactions,
    addReactionMutation,
    removeReactionMutation,
    onLike,
    isLiked,
  ]);

  const handleRepost = useCallback(() => {
    if (!currentUserAccountId) {
      notify.error("Please select an account to interact");
      return;
    }
    setShowRepostModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserAccountId]);

  const handleReaction = useCallback(
    async (reactionType: string) => {
      console.log("🎭 handleReaction called:", {
        reactionType,
        currentUserAccountId,
        postId,
        reactionsCount: reactions?.length || 0,
        isAddPending: addReactionMutation.isPending,
        isRemovePending: removeReactionMutation.isPending,
      });

      if (!currentUserAccountId) {
        console.warn("❌ No currentUserAccountId for reaction");
        notify.error("Please select an account to interact");
        return;
      }

      if (!postId) {
        console.warn("❌ No postId for reaction");
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
        console.warn("❌ Invalid reaction type:", reactionType);
        notify.error("Invalid reaction type");
        return;
      }

      // Check if already loading
      if (addReactionMutation.isPending || removeReactionMutation.isPending) {
        console.warn("⏳ Reaction already in progress");
        notify.error("Please wait for the current reaction to complete");
        return;
      }

      const existingReaction = reactions.find((r: any) => r.accountId === currentUserAccountId);

      console.log("🔍 Reaction analysis:", {
        postId,
        currentUserAccountId,
        reactionType,
        existingReaction,
        allReactions: reactions,
        willRemove: existingReaction && existingReaction.reactionType === reactionType,
      });

      // Close popup immediately for instant feedback
      setShowReactionPopup(false);

      try {
        if (existingReaction && existingReaction.reactionType === reactionType) {
          console.log("🗑️ Removing existing reaction:", existingReaction);
          await removeReactionMutation.mutateAsync({
            postId,
            accountId: currentUserAccountId,
          });
        } else {
          console.log("➕ Adding new reaction:", {
            postId,
            accountId: currentUserAccountId,
            reactionType,
          });
          await addReactionMutation.mutateAsync({
            postId,
            accountId: currentUserAccountId,
            reactionType: reactionType as
              "like" | "laugh" | "angry" | "sad" | "fire" | "thumbsup" | "thumbsdown" | string,
          });
        }

        console.log("📞 Calling onReaction callback");
        onReaction?.(postId, reactionType);
      } catch (error: any) {
        console.error("❌ Error in handleReaction:", error);
        // Error handling is already done in mutation onError
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      postId,
      currentUserAccountId,
      reactions,
      addReactionMutation,
      removeReactionMutation,
      onReaction,
    ]
  );

  const handleShare = useCallback(() => {
    const postUrl = `${window.location.origin}/thinkpages/post/${postId}`;
    if (navigator.share) {
      navigator
        .share({
          title: "ThinkPages Post",
          text: "Check out this post on ThinkPages",
          url: postUrl,
        })
        .catch(() => {
          // Fallback to clipboard if share fails
          navigator.clipboard.writeText(postUrl);
          notify.success("Post link copied to clipboard!");
        });
    } else {
      navigator.clipboard.writeText(postUrl);
      notify.success("Post link copied to clipboard!");
    }
    onShare?.(postId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, onShare]);

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
              console.log(
                "🖱️ Heart button clicked (single click), current state:",
                showReactionPopup
              );
              // Show reaction popup on click
              setShowReactionPopup(!showReactionPopup);
              console.log("🖱️ Heart button clicked, setting popup to:", !showReactionPopup);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Show reaction popup on right-click
              console.log("🖱️ Right-click detected, toggling reaction popup");
              setShowReactionPopup(!showReactionPopup);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              // Show reaction popup on double-click
              console.log("🖱️ Double-click detected, toggling reaction popup");
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
                ? "Click for reactions, right-click or double-click also work"
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

          {/* Debug indicator */}
          {showReactionPopup && (
            <div
              className="absolute -top-8 left-0 rounded bg-red-500 px-2 py-1 text-xs text-white"
              style={{ zIndex: 100000 }}
            >
              POPUP ACTIVE
            </div>
          )}

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
