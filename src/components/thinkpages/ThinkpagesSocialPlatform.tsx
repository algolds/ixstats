"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import {
  Users,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  Hash,
  Newspaper,
  Rss,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ThinkpagesPost } from "./ThinkpagesPost";
import { GlassCanvasComposer } from "./GlassCanvasComposer";
import { LiveHeadlinesTicker } from "~/components/shared/LiveHeadlinesTicker";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { AccountManagerModal } from "./AccountManagerModal";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { RepostModal } from "./RepostModal";
import { cn } from "~/lib/utils";

interface ThinkpagesSocialPlatformProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
  selectedAccount?: any;
  accounts?: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  profileMode?: boolean;
  countryOwnerClerkUserId?: string;
}

export function ThinkpagesSocialPlatform({
  countryId,
  countryName,
  isOwner,
  selectedAccount,
  accounts = [],
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  profileMode = false,
  countryOwnerClerkUserId,
}: ThinkpagesSocialPlatformProps) {
  const notify = useNotify();
  const [feedFilter, setFeedFilter] = useState<"recent" | "trending" | "hot">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [repostingPost, setRepostingPost] = useState<any>(null);

  // Infinite scroll state
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Feed queries
  const {
    data: feed,
    isLoading: isLoadingFeed,
    refetch: refetchFeed,
  } = api.thinkpages.getFeed.useQuery({ filter: feedFilter, limit: 20 }, { enabled: !profileMode });

  const {
    data: userFeed,
    isLoading: isLoadingUserFeed,
    refetch: refetchUserFeed,
  } = api.thinkpages.getPostsByClerkUserId.useQuery(
    { clerkUserId: countryOwnerClerkUserId!, limit: 20 },
    { enabled: profileMode && !!countryOwnerClerkUserId },
  );

  const {
    data: trendingTopics,
  } = api.thinkpages.getTrendingTopics.useQuery({ limit: 5 });

  const displayFeed = profileMode ? userFeed : feed;
  const isLoadingDisplayFeed = profileMode ? isLoadingUserFeed : isLoadingFeed;

  // Update posts when feed loads
  useEffect(() => {
    if (displayFeed?.posts) {
      setAllPosts(displayFeed.posts);
      setNextCursor(displayFeed.nextCursor || null);
    }
  }, [displayFeed]);

  const utils = api.useUtils();

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.thinkpages.getFeed.invalidate(),
        utils.thinkpages.getPostsByClerkUserId.invalidate(),
        utils.thinkpages.getPost.invalidate(),
      ]);
    },
    onError: (error) => {
      notify.error(error.message || "Failed to add reaction");
    },
  });

  // Infinite scroll — load more
  const loadMorePosts = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      let newData;
      if (profileMode && countryOwnerClerkUserId) {
        newData = await utils.thinkpages.getPostsByClerkUserId.fetch({
          clerkUserId: countryOwnerClerkUserId,
          limit: 20,
          cursor: nextCursor,
        });
      } else {
        newData = await utils.thinkpages.getFeed.fetch({
          filter: feedFilter,
          limit: 20,
          cursor: nextCursor,
        });
      }

      if (newData?.posts && newData.posts.length > 0) {
        setAllPosts((prev) => [...prev, ...newData.posts]);
        setNextCursor(newData.nextCursor || null);
      } else {
        setNextCursor(null);
      }
    } catch {
      notify.error("Failed to load more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, profileMode, countryOwnerClerkUserId, feedFilter, utils]);

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, isLoadingMore, loadMorePosts]);

  const refetchDisplayFeed = useCallback(() => {
    if (profileMode) {
      refetchUserFeed();
    } else {
      refetchFeed();
    }
    setAllPosts([]);
    setNextCursor(null);
  }, [profileMode, refetchFeed, refetchUserFeed]);

  // Reset posts when filter changes
  useEffect(() => {
    setAllPosts([]);
    setNextCursor(null);
  }, [feedFilter]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post: any) => {
      if (searchQuery) {
        return post.content.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [allPosts, searchQuery]);

  const totalPosts = allPosts.length;

  // Shared post action handlers
  const handleLike = useCallback(
    (postId: string) => {
      if (selectedAccount) {
        addReactionMutation.mutate({
          postId,
          accountId: selectedAccount.id,
          reactionType: "like",
        });
      } else {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, addReactionMutation],
  );

  const handleRepost = useCallback(
    (postId: string) => {
      if (selectedAccount) {
        const postToRepost = filteredPosts?.find((p) => p.id === postId);
        if (postToRepost) {
          setRepostingPost(postToRepost);
          setIsRepostModalOpen(true);
        }
      } else {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, filteredPosts],
  );

  const handleReply = useCallback(
    (_postId: string) => {
      if (!selectedAccount) {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount],
  );

  const handleShare = useCallback((_postId: string) => {
    if (navigator.share) {
      navigator.share({
        title: "ThinkPages Post",
        text: "Check out this post on ThinkPages",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      notify.success("Link copied to clipboard!");
    }
  }, []);

  const handleReaction = useCallback(
    (postId: string, reactionType: string) => {
      if (selectedAccount) {
        const validReactions = [
          "like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown",
        ] as const;
        type ValidReaction = (typeof validReactions)[number];

        if (validReactions.includes(reactionType as ValidReaction)) {
          addReactionMutation.mutate({
            postId,
            accountId: selectedAccount.id,
            reactionType: reactionType as ValidReaction,
          });
        }
      } else {
        notify.error("Please select an account first");
      }
    },
    [selectedAccount, addReactionMutation],
  );

  // Render post item with stagger animation
  const renderPost = useCallback(
    (post: any, index: number) => (
      <motion.div
        key={post.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      >
        <ThinkpagesPost
          post={post}
          currentUserAccountId={selectedAccount?.id || ""}
          accounts={accounts}
          countryId={countryId}
          isOwner={isOwner}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          onLike={handleLike}
          onRepost={handleRepost}
          onReply={handleReply}
          onShare={handleShare}
          onReaction={handleReaction}
          onAccountClick={() => notify.info("Account profile view coming soon!")}
          showThread={true}
        />
      </motion.div>
    ),
    [
      selectedAccount?.id, accounts, countryId, isOwner,
      onAccountSelect, onAccountSettings, onCreateAccount,
      handleLike, handleRepost, handleReply, handleShare, handleReaction,
    ],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* ── Profile Mode Header ── */}
      {profileMode && countryOwnerClerkUserId && (
        <div className="glass-hierarchy-child overflow-hidden rounded-xl">
          <div className="border-b border-white/10 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                  <Rss className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">ThinkPages Activity</h3>
                  <p className="text-muted-foreground text-sm">
                    Posts and updates from {countryName.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <Button variant="default" size="sm" onClick={() => setIsAccountModalOpen(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Manage Accounts</span>
                    <span className="sm:hidden">Accounts</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDisplayFeed()}
                  disabled={isLoadingDisplayFeed}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingDisplayFeed ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/5 px-4 py-3 text-sm md:px-6">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{totalPosts}</span>
              <span className="text-muted-foreground">{totalPosts === 1 ? "Post" : "Posts"}</span>
            </div>
            {totalPosts > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div className="text-muted-foreground">Latest activity from official accounts</div>
              </>
            )}
          </div>

          {isOwner && totalPosts === 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4 md:p-6">
              <div className="flex gap-3">
                <Rss className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                <div className="flex-1">
                  <h4 className="mb-1 font-semibold">Get started with ThinkPages</h4>
                  <p className="text-muted-foreground mb-3 text-sm">
                    Share updates, announcements, and engage with other nations on the global stage.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setIsAccountModalOpen(true)}>
                    Create Your First Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Feed Toolbar (non-profile mode) ── */}
      {!profileMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="glass-hierarchy-child rounded-xl border border-white/10 p-3 sm:p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="h-9 rounded-lg pr-4 pl-9 text-sm"
                inputMode="search"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Filter pills */}
              <ToggleGroup
                type="single"
                value={feedFilter}
                onValueChange={(value) => value && setFeedFilter(value as typeof feedFilter)}
                className="flex gap-0.5 rounded-lg bg-white/5 p-0.5"
              >
                {(["recent", "trending", "hot"] as const).map((filter) => (
                  <ToggleGroupItem
                    key={filter}
                    value={filter}
                    className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary rounded-md px-3 py-1 text-xs font-medium capitalize transition-all"
                  >
                    {filter}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {/* Actions */}
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => refetchFeed()}
                >
                  {isLoadingFeed ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setIsAccountModalOpen(true)}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden text-xs sm:inline">Accounts</span>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Live News Ticker ── */}
      {!profileMode && <LiveHeadlinesTicker />}

      {/* ── Trending Topics Strip (non-profile mode) ── */}
      {!profileMode && trendingTopics && trendingTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="glass-hierarchy-child rounded-xl border border-white/10 p-3 sm:p-4"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-semibold">Trending</span>
            </div>
            <Badge variant="outline" className="text-muted-foreground px-1.5 py-0 text-[0.6rem]">
              {trendingTopics.length} topics
            </Badge>
          </div>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto">
            {trendingTopics.map((topic, index) => (
              <button
                key={topic.hashtag}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Hash className="h-3 w-3 text-orange-500" />
                <span>{topic.hashtag}</span>
                <span className="text-muted-foreground text-[0.65rem]">{topic.postCount}</span>
                {index === 0 && (
                  <TrendingUp className="ml-0.5 h-2.5 w-2.5 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Composer ── */}
      {!profileMode && selectedAccount && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <GlassCanvasComposer
            account={selectedAccount}
            onPost={() => {
              notify.success("Posted successfully!");
              refetchDisplayFeed();
            }}
            placeholder="What's happening across the nations?"
            countryId={countryId}
            accounts={[]}
            isOwner={false}
          />
        </motion.div>
      )}

      {/* Account Selection Prompt */}
      {!profileMode && !selectedAccount && !isAccountModalOpen && (
        <Card className="glass-hierarchy-child">
          <CardContent className="p-6 text-center">
            <Users className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <h3 className="mb-1.5 text-base font-semibold">Select an Account to Compose</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Choose an account to start posting on ThinkPages
            </p>
            <Button size="sm" onClick={() => setIsAccountModalOpen(true)}>
              <Users className="mr-2 h-3.5 w-3.5" />
              Manage Accounts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Posts Feed (Infinite Scroll) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {profileMode && !countryOwnerClerkUserId ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="p-8 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Owner Found</h3>
              <p className="text-muted-foreground">
                This country hasn&apos;t been claimed yet. Once claimed, ThinkPages posts will appear
                here.
              </p>
            </CardContent>
          </Card>
        ) : isLoadingDisplayFeed ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredPosts && filteredPosts.length > 0 ? (
          <div className="space-y-3">
            {filteredPosts.map((post, index) => renderPost(post, index))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-px" />

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Loading more posts...</span>
              </div>
            )}

            {/* End of feed */}
            {!nextCursor && !isLoadingMore && filteredPosts.length > 0 && (
              <div className="text-muted-foreground py-4 text-center text-xs">
                You&apos;ve reached the end of the feed
              </div>
            )}
          </div>
        ) : (
          <Card className="glass-hierarchy-child">
            <CardContent className="p-8 text-center">
              <Rss className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
              <h3 className="mb-2 text-base font-semibold">
                {profileMode ? "No Posts Yet" : "No Posts Found"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {profileMode
                  ? `${countryName.replace(/_/g, " ")} hasn't shared any posts yet.`
                  : searchQuery
                    ? "No posts match your search criteria."
                    : "Be the first to share something on ThinkPages!"}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* ── Modals ── */}
      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        countryId={countryId}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onAccountSelect={onAccountSelect || (() => {})}
        onAccountSettings={onAccountSettings || (() => {})}
        onCreateAccount={onCreateAccount || (() => {})}
        isOwner={isOwner}
      />

      {repostingPost && (
        <RepostModal
          open={isRepostModalOpen}
          onOpenChange={setIsRepostModalOpen}
          originalPost={repostingPost}
          countryId={countryId}
          selectedAccount={selectedAccount}
          accounts={accounts}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          isOwner={isOwner}
          onPost={() => {
            notify.success("Reposted successfully!");
            refetchFeed();
            setIsRepostModalOpen(false);
            setRepostingPost(null);
          }}
        />
      )}
    </motion.div>
  );
}
