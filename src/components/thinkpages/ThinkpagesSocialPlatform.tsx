"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { VariableSizeList, type VariableSizeListHandle } from "~/lib/react-window-compat";
import {
  Users,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Rss,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ThinkpagesPost } from "./ThinkpagesPost";
import { LiveEventsFeed } from "./LiveEventsFeed";
import { ThinkPagesGuide } from "./ThinkPagesGuide";
import { GlassCanvasComposer } from "./GlassCanvasComposer";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { BlurFade } from "~/components/magicui/blur-fade";
import { AccountManagerModal } from "./AccountManagerModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { RepostModal } from "./RepostModal";

interface ThinkpagesSocialPlatformProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
  selectedAccount?: any;
  accounts?: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  profileMode?: boolean; // When true, show only posts from this country's owner
  countryOwnerClerkUserId?: string; // The clerkUserId of the country owner
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
  const [feedFilter, setFeedFilter] = useState<"recent" | "trending" | "hot">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const [repostingPost, setRepostingPost] = useState<any>(null);

  // State for infinite scroll
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const listRef = useRef<VariableSizeListHandle>(null);
  const itemSizeCache = useRef<Map<number, number>>(new Map());

  // In profile mode, show only posts from this user's accounts
  // Otherwise show global feed
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
    { enabled: profileMode && !!countryOwnerClerkUserId }
  );

  const {
    data: trendingTopics,
    isLoading: isLoadingTrending,
    refetch: refetchTrending,
  } = api.thinkpages.getTrendingTopics.useQuery({ limit: 5 });

  // Use the appropriate feed based on mode
  const displayFeed = profileMode ? userFeed : feed;
  const isLoadingDisplayFeed = profileMode ? isLoadingUserFeed : isLoadingFeed;

  // Update posts when initial feed loads
  useEffect(() => {
    if (displayFeed?.posts) {
      setAllPosts(displayFeed.posts);
      setNextCursor(displayFeed.nextCursor || null);
    }
  }, [displayFeed]);
  const calculateTrendingMutation = api.thinkpages.calculateTrendingTopics.useMutation({
    onSuccess: () => {
      toast.success("Trending topics calculated successfully!");
      refetchTrending();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to calculate trending topics");
    },
  });

  const canManageAccounts = Boolean(
    isOwner && (onAccountSelect || onAccountSettings || onCreateAccount)
  );

  const activeAccountName = selectedAccount
    ? (selectedAccount.displayName ??
      selectedAccount.username ??
      selectedAccount.accountName ??
      (selectedAccount.id ? `Account ${String(selectedAccount.id).slice(-4)}` : "Active account"))
    : undefined;

  // Debug logging for account selection
  useEffect(() => {
    console.log("📱 ThinkpagesSocialPlatform account state:", {
      selectedAccount: !!selectedAccount,
      accountId: selectedAccount?.id,
      accountName: activeAccountName,
      accountsCount: accounts.length,
      isOwner,
    });
  }, [selectedAccount, activeAccountName, accounts.length, isOwner]);

  const utils = api.useUtils();

  // Reaction mutation
  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onSuccess: async () => {
      // Properly await cache invalidation
      await Promise.all([
        utils.thinkpages.getFeed.invalidate(),
        utils.thinkpages.getPostsByClerkUserId.invalidate(),
        utils.thinkpages.getPost.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add reaction");
    },
  });

  // Load more posts for infinite scroll
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
    } catch (error) {
      console.error("Failed to load more posts:", error);
      toast.error("Failed to load more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, profileMode, countryOwnerClerkUserId, feedFilter, utils]);

  // Refetch function that handles both modes
  const refetchDisplayFeed = useCallback(() => {
    if (profileMode) {
      refetchUserFeed();
    } else {
      refetchFeed();
    }
    // Clear pagination state
    setAllPosts([]);
    setNextCursor(null);
    itemSizeCache.current.clear();
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [profileMode, refetchFeed, refetchUserFeed]);

  // Reset posts when filter changes
  useEffect(() => {
    setAllPosts([]);
    setNextCursor(null);
    itemSizeCache.current.clear();
  }, [feedFilter]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post: any) => {
      // Show all posts globally (or user posts in profile mode), only filter by search query if provided
      if (searchQuery) {
        return post.content.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [allPosts, searchQuery]);

  // Calculate dynamic item size based on post content
  const getItemSize = useCallback(
    (index: number) => {
      // Check cache first
      if (itemSizeCache.current.has(index)) {
        return itemSizeCache.current.get(index)!;
      }

      const post = filteredPosts[index];
      if (!post) return 400; // Default size

      // Base height: 200px for basic post structure
      let height = 200;

      // Add height for content (estimate ~0.3px per character)
      if (post.content) {
        const lines = Math.ceil(post.content.length / 60); // ~60 chars per line
        height += Math.min(lines * 20, 200); // Max 200px for content
      }

      // Add height for images
      if (post.images?.length > 0) {
        height += 300; // ~300px per image group
      }

      // Add height for media attachments
      if (post.mediaAttachments?.length > 0) {
        height += post.mediaAttachments.length * 250;
      }

      // Add height for replies preview
      if (post._count?.replies > 0) {
        height += 40;
      }

      // Add height for repost
      if (post.repostOf || post.isRepost) {
        height += 150;
      }

      // Add height for parent post (if it's a reply)
      if (post.parentPost) {
        height += 100;
      }

      // Clamp between reasonable bounds
      const finalHeight = Math.max(250, Math.min(800, height));

      // Cache the calculated size
      itemSizeCache.current.set(index, finalHeight);

      return finalHeight;
    },
    [filteredPosts]
  );

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    ({ scrollOffset, scrollUpdateWasRequested }: any) => {
      if (scrollUpdateWasRequested || isLoadingMore || !nextCursor) return;

      // Calculate total height of all items
      const totalHeight = filteredPosts.reduce((sum, _, i) => sum + getItemSize(i), 0);
      const viewportHeight = 800; // Match the List height
      const threshold = 300; // Load when 300px from bottom

      // If scrolled near bottom, load more
      if (scrollOffset + viewportHeight > totalHeight - threshold) {
        loadMorePosts();
      }
    },
    [isLoadingMore, nextCursor, filteredPosts, getItemSize, loadMorePosts]
  );

  // Get post stats for profile mode
  const postCount = profileMode ? (userFeed?.posts?.length ?? 0) : (feed?.posts?.length ?? 0);
  const totalPosts = allPosts.length;

  return (
    <div className="touch-pan-y space-y-6 lg:space-y-8">
      {/* Profile Mode: Activity Feed Header */}
      {profileMode && countryOwnerClerkUserId && (
        <div className="glass-hierarchy-child overflow-hidden rounded-xl">
          {/* Header Section */}
          <div className="border-b border-white/10 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
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
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setIsAccountModalOpen(true)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Manage Accounts</span>
                    <span className="sm:hidden">Accounts</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => refetchDisplayFeed()}
                  disabled={isLoadingDisplayFeed}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingDisplayFeed ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 bg-white/5 px-4 py-3 text-sm md:px-6">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{totalPosts}</span>
              <span className="text-muted-foreground">{totalPosts === 1 ? "Post" : "Posts"}</span>
            </div>
            {totalPosts > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <div className="text-muted-foreground">Latest activity from official accounts</div>
              </>
            )}
          </div>

          {/* Tips for owners with no posts */}
          {isOwner && totalPosts === 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4 md:p-6">
              <div className="flex gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <h4 className="mb-1 font-semibold text-blue-200">Get started with ThinkPages</h4>
                  <p className="mb-3 text-sm text-blue-200/80">
                    Share updates, announcements, and engage with other nations on the global stage.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full border-blue-400/30 hover:bg-blue-400/10"
                    onClick={() => setIsAccountModalOpen(true)}
                  >
                    Create Your First Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={profileMode ? "w-full" : "grid grid-cols-1 gap-6 lg:grid-cols-3"}>
        {/* Main Feed - Takes up most space */}
        <div className={profileMode ? "w-full" : "space-y-4 lg:col-span-2"}>
          {!profileMode && (
            <Card className="glass-hierarchy-child">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                  <div className="relative w-full md:max-w-md">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search posts across all nations..."
                      className="h-11 rounded-xl pr-4 pl-10"
                      inputMode="search"
                    />
                  </div>

                  <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end md:gap-4">
                    <ToggleGroup
                      type="single"
                      value={feedFilter}
                      onValueChange={(value) => value && setFeedFilter(value as typeof feedFilter)}
                      className="flex w-full flex-wrap justify-center gap-2 rounded-full bg-white/5 p-1 [-webkit-overflow-scrolling:touch] sm:w-auto sm:flex-nowrap sm:gap-1 [&::-webkit-scrollbar]:hidden"
                    >
                      {(["recent", "trending", "hot"] as const).map((filter) => (
                        <ToggleGroupItem
                          key={filter}
                          value={filter}
                          className="data-[state=on]:border-primary data-[state=on]:bg-primary/10 flex min-w-[90px] items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all sm:min-w-[80px]"
                        >
                          {filter}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full sm:h-10 sm:flex-none"
                        onClick={() => refetchFeed()}
                      >
                        {isLoadingFeed ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full sm:h-10 sm:flex-none"
                        onClick={() => calculateTrendingMutation.mutate()}
                      >
                        {calculateTrendingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full sm:h-10 sm:flex-none"
                        onClick={() => {
                          console.log("Accounts button clicked, setting modal to true");
                          setIsAccountModalOpen(true);
                        }}
                      >
                        <Users className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Accounts</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Glass Canvas Composer - Only show when account is selected and not in profile mode */}
          {!profileMode && selectedAccount && (
            <GlassCanvasComposer
              account={selectedAccount}
              onPost={() => {
                toast.success("Posted successfully!");
                refetchDisplayFeed();
              }}
              placeholder="What's happening across the nations?"
              countryId={countryId}
              accounts={[]}
              isOwner={false}
            />
          )}

          {/* Account Selection Prompt - Only show when not in profile mode */}
          {!profileMode && !selectedAccount && !isAccountModalOpen && (
            <Card className="glass-hierarchy-child">
              <CardContent className="p-6 text-center">
                <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">Select an Account to Compose</h3>
                <p className="text-muted-foreground mb-4">
                  Choose an account to start posting on ThinkPages
                </p>
                <Button
                  onClick={() => {
                    console.log("Manage Accounts clicked, setting modal to true");
                    setIsAccountModalOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Manage Accounts
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {profileMode && !countryOwnerClerkUserId ? (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-8 text-center">
                  <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">No Owner Found</h3>
                  <p className="text-muted-foreground">
                    This country hasn't been claimed yet. Once claimed, ThinkPages posts will appear
                    here.
                  </p>
                </CardContent>
              </Card>
            ) : isLoadingDisplayFeed ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredPosts && filteredPosts.length > 0 ? (
              <>
                <VariableSizeList
                  ref={listRef}
                  height={800}
                  itemCount={filteredPosts.length}
                  itemSize={getItemSize}
                  width="100%"
                  overscanCount={3}
                  onScroll={handleScroll}
                  className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                  {({ index, style }) => {
                    const post = filteredPosts[index];
                    if (!post) return null;

                    return (
                      <div style={style} className="px-1 pb-4">
                        <ThinkpagesPost
                          post={post}
                          currentUserAccountId={selectedAccount?.id || ""}
                          accounts={accounts}
                          countryId={countryId}
                          isOwner={isOwner}
                          onAccountSelect={onAccountSelect}
                          onAccountSettings={onAccountSettings}
                          onCreateAccount={onCreateAccount}
                          onLike={(postId) => {
                            console.log("🎯 ThinkpagesSocialPlatform onLike called:", {
                              postId,
                              selectedAccount: !!selectedAccount,
                              accountId: selectedAccount?.id,
                              accountName:
                                selectedAccount?.username || selectedAccount?.displayName,
                            });

                            if (selectedAccount) {
                              console.log("✅ Adding like reaction via mutation");
                              addReactionMutation.mutate({
                                postId,
                                accountId: selectedAccount.id,
                                reactionType: "like",
                              });
                            } else {
                              console.warn("❌ No selected account for like reaction");
                              toast.error("Please select an account first");
                            }
                          }}
                          onRepost={(postId) => {
                            if (selectedAccount) {
                              const postToRepost = filteredPosts?.find((p) => p.id === postId);
                              if (postToRepost) {
                                setRepostingPost(postToRepost);
                                setIsRepostModalOpen(true);
                              }
                            } else {
                              toast.error("Please select an account first");
                            }
                          }}
                          onReply={(postId) => {
                            // Reply functionality is handled directly in ThinkpagesPost component
                            // This callback is kept for consistency but not actively used
                            if (!selectedAccount) {
                              toast.error("Please select an account first");
                            }
                          }}
                          onShare={(postId) => {
                            if (navigator.share) {
                              navigator.share({
                                title: "ThinkPages Post",
                                text: "Check out this post on ThinkPages",
                                url: window.location.href,
                              });
                            } else {
                              navigator.clipboard.writeText(window.location.href);
                              toast.success("Link copied to clipboard!");
                            }
                          }}
                          onReaction={(postId, reactionType) => {
                            console.log("🎭 ThinkpagesSocialPlatform onReaction called:", {
                              postId,
                              reactionType,
                              selectedAccount: !!selectedAccount,
                              accountId: selectedAccount?.id,
                              accountName:
                                selectedAccount?.username || selectedAccount?.displayName,
                            });

                            if (selectedAccount) {
                              // Validate and cast reaction type to enum
                              const validReactions = [
                                "like",
                                "laugh",
                                "angry",
                                "sad",
                                "fire",
                                "thumbsup",
                                "thumbsdown",
                              ] as const;
                              type ValidReaction = (typeof validReactions)[number];

                              if (validReactions.includes(reactionType as ValidReaction)) {
                                console.log("✅ Adding reaction via mutation:", {
                                  postId,
                                  accountId: selectedAccount.id,
                                  reactionType,
                                });
                                addReactionMutation.mutate({
                                  postId,
                                  accountId: selectedAccount.id,
                                  reactionType: reactionType as ValidReaction,
                                });
                              } else {
                                console.warn("❌ Invalid reaction type:", reactionType);
                              }
                            } else {
                              console.warn("❌ No selected account for reaction");
                              toast.error("Please select an account first");
                            }
                          }}
                          onAccountClick={(accountId) => {
                            toast.info("Account profile view coming soon!");
                          }}
                          showThread={true}
                        />
                      </div>
                    );
                  }}
                </VariableSizeList>

                {/* Loading indicator for infinite scroll */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    <span className="text-muted-foreground text-sm">Loading more posts...</span>
                  </div>
                )}

                {/* End of feed indicator */}
                {!nextCursor && !isLoadingMore && filteredPosts.length > 0 && (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    You've reached the end of the feed
                  </div>
                )}
              </>
            ) : (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-8 text-center">
                  <Rss className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">
                    {profileMode ? "No Posts Yet" : "No Posts Found"}
                  </h3>
                  <p className="text-muted-foreground">
                    {profileMode
                      ? `${countryName.replace(/_/g, " ")} hasn't shared any posts yet.`
                      : searchQuery
                        ? "No posts match your search criteria."
                        : "Be the first to share something on ThinkPages!"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Trending & Live Events - Only show when not in profile mode */}
        {!profileMode && (
          <div className="space-y-4 lg:col-span-1">
            {/* Trending Topics */}
            <Card className="glass-hierarchy-child">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Trending Topics
                </CardTitle>
                <p className="text-muted-foreground text-xs">What's happening across the network</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingTrending ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                    {trendingTopics?.map((topic, index) => (
                      <BlurFade key={topic.hashtag} delay={0.1 + 0.03 * index}>
                        <button className="bg-background/40 hover:border-border hover:bg-accent/50 focus-visible:ring-ring flex min-w-[200px] items-center justify-between rounded-lg border border-transparent p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fcc309]/20 text-xs font-bold text-[#800000]">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm leading-tight font-medium">
                                #{topic.hashtag}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {topic.postCount} thinks
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium text-green-600">
                              {topic.engagement > 0
                                ? `${Math.round((topic.engagement / topic.postCount) * 10)}`
                                : "0"}{" "}
                              eng
                            </span>
                          </div>
                        </button>
                      </BlurFade>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Events Feed */}
            <LiveEventsFeed
              countryId={countryId}
              onEventClick={(eventId) => console.log("Event clicked:", eventId)}
            />

            {/* ThinkPages Guide */}
            <ThinkPagesGuide />
          </div>
        )}
      </div>

      {/* Account Manager Modal */}
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

      {/* Repost Modal */}
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
            toast.success("Reposted successfully!");
            refetchFeed();
            setIsRepostModalOpen(false);
            setRepostingPost(null);
          }}
        />
      )}
    </div>
  );
}
