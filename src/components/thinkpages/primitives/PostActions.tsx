"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal, Smile } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { ReactionPopup } from "../ReactionPopup";
import { RepostModal } from "../RepostModal";

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
  }, [showReactionPopup]);

  const utils = api.useUtils();

  // Define context type for mutation error handlers
  type MutationContext = {
    previousFeed?: any;
    previousRecentFeed?: any;
    previousTrendingFeed?: any;
    previousHotFeed?: any;
  };

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onMutate: async (variables): Promise<MutationContext> => {
      console.log("🚀 Optimistic update starting:", variables);

      // Cancel outgoing refetches for all possible query variations
      await utils.thinkpages.getFeed.cancel();

      // Snapshot previous values for all possible query variations
      const previousFeed = utils.thinkpages.getFeed.getData({});
      const previousRecentFeed = utils.thinkpages.getFeed.getData({ filter: "recent" });
      const previousTrendingFeed = utils.thinkpages.getFeed.getData({ filter: "trending" });
      const previousHotFeed = utils.thinkpages.getFeed.getData({ filter: "hot" });

      // Optimistically update the cache for all possible query variations
      const updateFeedCache = (queryParams: any = {}) => {
        utils.thinkpages.getFeed.setData(queryParams, (old: any) => {
          if (!old?.posts) return old;

          return {
            ...old,
            posts: old.posts.map((post: any) => {
              if (post.id === variables.postId) {
                const existingReaction = post.reactions?.find(
                  (r: any) => r.accountId === variables.accountId
                );
                let newReactions = [...(post.reactions || [])];
                let newReactionCounts = {
                  ...(() => {
                    try {
                      return typeof post.reactionCounts === "string"
                        ? JSON.parse(post.reactionCounts)
                        : post.reactionCounts || {};
                    } catch (error) {
                      return {};
                    }
                  })(),
                };

                if (existingReaction) {
                  // Update existing reaction
                  newReactions = newReactions.map((r: any) =>
                    r.accountId === variables.accountId
                      ? { ...r, reactionType: variables.reactionType }
                      : r
                  );
                  // Update counts
                  if (newReactionCounts[existingReaction.reactionType]) {
                    newReactionCounts[existingReaction.reactionType] = Math.max(
                      0,
                      newReactionCounts[existingReaction.reactionType] - 1
                    );
                  }
                } else {
                  // Add new reaction
                  newReactions.push({
                    id: `temp-${Date.now()}`,
                    accountId: variables.accountId,
                    reactionType: variables.reactionType,
                    timestamp: new Date().toISOString(),
                  });
                }

                // Increment new reaction count
                newReactionCounts[variables.reactionType] =
                  (newReactionCounts[variables.reactionType] || 0) + 1;

                const updatedPost = {
                  ...post,
                  reactions: newReactions,
                  reactionCounts: JSON.stringify(newReactionCounts), // Store as JSON string to match server format
                  likeCount: newReactionCounts.like || 0,
                  // Force a new object reference to trigger re-renders
                  _optimisticUpdate: Date.now(),
                };

                console.log("🔄 Optimistically updated post:", {
                  postId: variables.postId,
                  newReactions,
                  newReactionCounts,
                  likeCount: updatedPost.likeCount,
                  hasOptimisticUpdate: true,
                });

                return updatedPost;
              }
              return post;
            }),
          };
        });
      };

      // Apply optimistic updates to all query variations
      updateFeedCache({});
      updateFeedCache({ filter: "recent" });
      updateFeedCache({ filter: "trending" });
      updateFeedCache({ filter: "hot" });

      // Force an immediate re-render by triggering a cache update
      setTimeout(() => {
        const cleanupOptimisticFlags = (queryParams: any = {}) => {
          utils.thinkpages.getFeed.setData(queryParams, (currentData: any) => {
            if (!currentData?.posts) return currentData;

            return {
              ...currentData,
              posts: currentData.posts.map((post: any) => {
                if (post.id === variables.postId && post._optimisticUpdate) {
                  // Remove the optimistic update flag after a short delay
                  const { _optimisticUpdate, ...cleanPost } = post;
                  return cleanPost;
                }
                return post;
              }),
            };
          });
        };

        cleanupOptimisticFlags({});
        cleanupOptimisticFlags({ filter: "recent" });
        cleanupOptimisticFlags({ filter: "trending" });
        cleanupOptimisticFlags({ filter: "hot" });
      }, 100);

      return { previousFeed, previousRecentFeed, previousTrendingFeed, previousHotFeed };
    },
    onSuccess: (data) => {
      console.log("🎉 addReactionMutation SUCCESS:", {
        data,
        postId,
        accountId: currentUserAccountId,
      });

      // Show instant feedback
      const dataAny = data as any;
      if ("removed" in dataAny && dataAny.removed) {
        toast.success("Reaction removed!");
      } else if ("updated" in dataAny && dataAny.updated) {
        toast.success("Reaction updated!");
      } else {
        toast.success("Reaction added!");
      }

      // Force immediate cache invalidation and refetch for all query variations
      utils.thinkpages.getFeed.invalidate();
      utils.thinkpages.getFeed.invalidate({ filter: "recent" });
      utils.thinkpages.getFeed.invalidate({ filter: "trending" });
      utils.thinkpages.getFeed.invalidate({ filter: "hot" });
      utils.thinkpages.getPost.invalidate({ postId });

      // Force a refetch to ensure fresh data from server
      setTimeout(() => {
        utils.thinkpages.getFeed.refetch();
      }, 100);
    },
    onError: (error, variables, context) => {
      console.error("❌ addReactionMutation ERROR:", {
        error,
        message: error.message,
        postId,
        accountId: currentUserAccountId,
      });

      // Rollback optimistic update for all query variations
      const ctx = context as MutationContext | undefined;
      if (ctx?.previousFeed) {
        utils.thinkpages.getFeed.setData({}, () => ctx.previousFeed);
      }
      if (ctx?.previousRecentFeed) {
        utils.thinkpages.getFeed.setData({ filter: "recent" }, () => ctx.previousRecentFeed);
      }
      if (ctx?.previousTrendingFeed) {
        utils.thinkpages.getFeed.setData({ filter: "trending" }, () => ctx.previousTrendingFeed);
      }
      if (ctx?.previousHotFeed) {
        utils.thinkpages.getFeed.setData({ filter: "hot" }, () => ctx.previousHotFeed);
      }

      toast.error(error.message || "Failed to add reaction");
    },
  });

  const removeReactionMutation = api.thinkpages.removeReaction.useMutation({
    onMutate: async (variables): Promise<MutationContext> => {
      console.log("🚀 Optimistic remove starting:", variables);

      // Cancel outgoing refetches for all possible query variations
      await utils.thinkpages.getFeed.cancel();

      // Snapshot previous values for all possible query variations
      const previousFeed = utils.thinkpages.getFeed.getData({});
      const previousRecentFeed = utils.thinkpages.getFeed.getData({ filter: "recent" });
      const previousTrendingFeed = utils.thinkpages.getFeed.getData({ filter: "trending" });
      const previousHotFeed = utils.thinkpages.getFeed.getData({ filter: "hot" });

      // Optimistically update the cache for all possible query variations
      const updateFeedCache = (queryParams: any = {}) => {
        utils.thinkpages.getFeed.setData(queryParams, (old: any) => {
          if (!old?.posts) return old;

          return {
            ...old,
            posts: old.posts.map((post: any) => {
              if (post.id === variables.postId) {
                const existingReaction = post.reactions?.find(
                  (r: any) => r.accountId === variables.accountId
                );
                if (existingReaction) {
                  let newReactions =
                    post.reactions?.filter((r: any) => r.accountId !== variables.accountId) || [];
                  let newReactionCounts = {
                    ...(() => {
                      try {
                        return typeof post.reactionCounts === "string"
                          ? JSON.parse(post.reactionCounts)
                          : post.reactionCounts || {};
                      } catch (error) {
                        return {};
                      }
                    })(),
                  };

                  // Decrement reaction count
                  if (newReactionCounts[existingReaction.reactionType]) {
                    newReactionCounts[existingReaction.reactionType] = Math.max(
                      0,
                      newReactionCounts[existingReaction.reactionType] - 1
                    );
                  }

                  const updatedPost = {
                    ...post,
                    reactions: newReactions,
                    reactionCounts: JSON.stringify(newReactionCounts), // Store as JSON string to match server format
                    likeCount: newReactionCounts.like || 0,
                    // Force a new object reference to trigger re-renders
                    _optimisticUpdate: Date.now(),
                  };

                  console.log("🔄 Optimistically removed reaction from post:", {
                    postId: variables.postId,
                    newReactions,
                    newReactionCounts,
                    likeCount: updatedPost.likeCount,
                    hasOptimisticUpdate: true,
                  });

                  return updatedPost;
                }
              }
              return post;
            }),
          };
        });
      };

      // Apply optimistic updates to all query variations
      updateFeedCache({});
      updateFeedCache({ filter: "recent" });
      updateFeedCache({ filter: "trending" });
      updateFeedCache({ filter: "hot" });

      return { previousFeed, previousRecentFeed, previousTrendingFeed, previousHotFeed };
    },
    onSuccess: () => {
      console.log("🎉 removeReactionMutation SUCCESS:", {
        postId,
        accountId: currentUserAccountId,
      });
      toast.success("Reaction removed!");

      // Force immediate cache invalidation and refetch for all query variations
      utils.thinkpages.getFeed.invalidate();
      utils.thinkpages.getFeed.invalidate({ filter: "recent" });
      utils.thinkpages.getFeed.invalidate({ filter: "trending" });
      utils.thinkpages.getFeed.invalidate({ filter: "hot" });
      utils.thinkpages.getPost.invalidate({ postId });

      // Force a refetch to ensure fresh data from server
      setTimeout(() => {
        utils.thinkpages.getFeed.refetch();
      }, 100);
    },
    onError: (error, variables, context) => {
      console.error("❌ removeReactionMutation ERROR:", {
        error,
        message: error.message,
        postId,
        accountId: currentUserAccountId,
      });

      // Rollback optimistic update for all query variations
      const ctx = context as MutationContext | undefined;
      if (ctx?.previousFeed) {
        utils.thinkpages.getFeed.setData({}, () => ctx.previousFeed);
      }
      if (ctx?.previousRecentFeed) {
        utils.thinkpages.getFeed.setData({ filter: "recent" }, () => ctx.previousRecentFeed);
      }
      if (ctx?.previousTrendingFeed) {
        utils.thinkpages.getFeed.setData({ filter: "trending" }, () => ctx.previousTrendingFeed);
      }
      if (ctx?.previousHotFeed) {
        utils.thinkpages.getFeed.setData({ filter: "hot" }, () => ctx.previousHotFeed);
      }

      toast.error(error.message || "Failed to remove reaction");
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
      toast.error("Please select a ThinkPages account first to like posts");
      console.warn("No currentUserAccountId provided to heart button");
      return;
    }

    if (!postId) {
      toast.error("Invalid post ID");
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
      toast.error(error.message || "Failed to update reaction");
    }
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
      toast.error("Please select an account to interact");
      return;
    }
    setShowRepostModal(true);
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
        toast.error("Please select an account to interact");
        return;
      }

      if (!postId) {
        console.warn("❌ No postId for reaction");
        toast.error("Invalid post ID");
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
        toast.error("Invalid reaction type");
        return;
      }

      // Check if already loading
      if (addReactionMutation.isPending || removeReactionMutation.isPending) {
        console.warn("⏳ Reaction already in progress");
        toast.error("Please wait for the current reaction to complete");
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

        console.log("📞 Calling onReaction callback");
        onReaction?.(postId, reactionType);
      } catch (error: any) {
        console.error("❌ Error in handleReaction:", error);
        // Error handling is already done in mutation onError
      }
    },
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
          toast.success("Post link copied to clipboard!");
        });
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success("Post link copied to clipboard!");
    }
    onShare?.(postId);
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
              showReactionPopup && "ring-opacity-50 ring-2 ring-blue-500"
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
