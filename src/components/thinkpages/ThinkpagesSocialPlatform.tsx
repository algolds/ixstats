"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingUp, 
  Search, 
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ThinkpagesPost } from './ThinkpagesPost';
import { LiveEventsFeed } from './LiveEventsFeed';
import { ThinkPagesGuide } from './ThinkPagesGuide';
import { GlassCanvasComposer } from './GlassCanvasComposer';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { BlurFade } from '~/components/magicui/blur-fade';
import { EnhancedAccountManager } from './EnhancedAccountManager';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';

interface ThinkpagesSocialPlatformProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
  selectedAccount?: any;
  accounts?: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
}

export function ThinkpagesSocialPlatform({
  countryId,
  countryName,
  isOwner,
  selectedAccount,
  accounts = [],
  onAccountSelect,
  onAccountSettings,
  onCreateAccount
}: ThinkpagesSocialPlatformProps) {
  const [feedFilter, setFeedFilter] = useState<'recent' | 'trending' | 'hot'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(!selectedAccount);
  // Show all posts from all countries, not filtered by countryId
  const { data: feed, isLoading: isLoadingFeed, refetch: refetchFeed } = api.thinkpages.getFeed.useQuery({ filter: feedFilter });
  const { data: trendingTopics, isLoading: isLoadingTrending, refetch: refetchTrending } = api.thinkpages.getTrendingTopics.useQuery({ limit: 5 });
  const calculateTrendingMutation = api.thinkpages.calculateTrendingTopics.useMutation({
    onSuccess: () => {
      toast.success("Trending topics calculated successfully!");
      refetchTrending();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to calculate trending topics");
    }
  });

  useEffect(() => {
    if (!selectedAccount) {
      setIsAccountPanelOpen(true);
    }
  }, [selectedAccount]);

  const canManageAccounts = Boolean(
    isOwner &&
    (onAccountSelect || onAccountSettings || onCreateAccount)
  );

  const activeAccountName = selectedAccount
    ? (selectedAccount.displayName ??
       selectedAccount.username ??
       selectedAccount.accountName ??
       (selectedAccount.id ? `Account ${String(selectedAccount.id).slice(-4)}` : 'Active account'))
    : undefined;

  // Reaction mutation
  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onSuccess: () => {
      refetchFeed();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add reaction");
    }
  });


  const filteredPosts = feed?.posts.filter(post => {
    // Show all posts globally, only filter by search query if provided
    if (searchQuery) {
      return post.content.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6 lg:space-y-8 touch-pan-y">
      {/* ThinkPages Global Feed Header */}
      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed - Takes up most space */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="relative w-full md:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts across all nations..."
                    className="pl-10 pr-4 h-11 rounded-xl"
                    inputMode="search"
                  />
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end md:gap-4 w-full md:w-auto">
                  <ToggleGroup
                    type="single"
                    value={feedFilter}
                    onValueChange={(value) => value && setFeedFilter(value as typeof feedFilter)}
                    className="flex w-full flex-wrap justify-center gap-2 rounded-full bg-white/5 p-1 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden sm:w-auto sm:flex-nowrap sm:gap-1"
                  >
                    {(['recent', 'trending', 'hot'] as const).map((filter) => (
                      <ToggleGroupItem
                        key={filter}
                        value={filter}
                        className="flex min-w-[90px] items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all data-[state=on]:border-primary data-[state=on]:bg-primary/10 sm:min-w-[80px]"
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
                      {isLoadingFeed ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-full sm:h-10 sm:flex-none"
                      onClick={() => calculateTrendingMutation.mutate()}
                    >
                      {calculateTrendingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Glass Canvas Composer - Only show when account is selected */}
          {selectedAccount && (
            <GlassCanvasComposer
              account={selectedAccount}
              onPost={() => {
                toast.success('Posted successfully!');
                refetchFeed();
              }}
              placeholder="What's happening across the nations?"
              countryId={countryId}
            />
          )}

          {canManageAccounts && (
            <Card className="glass-hierarchy-child border border-dashed border-border/60">
              <CardContent className="p-0">
                <Collapsible open={isAccountPanelOpen} onOpenChange={setIsAccountPanelOpen}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedAccount ? 'Manage ThinkPages personas' : 'Select an account to start posting'}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Quickly switch personas or create new voices for {countryName}.
                      </p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Badge
                        variant={selectedAccount ? 'outline' : 'secondary'}
                        className="rounded-full px-3 py-1 text-xs font-medium justify-center"
                      >
                        {selectedAccount ? `Active: ${activeAccountName}` : 'No account selected'}
                      </Badge>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-2"
                          aria-expanded={isAccountPanelOpen}
                        >
                          {isAccountPanelOpen ? (
                            <>
                              Hide manager
                              <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Manage accounts
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="border-t border-border/60 p-4 sm:p-6">
                    <EnhancedAccountManager
                      countryId={countryId}
                      accounts={accounts}
                      selectedAccount={selectedAccount}
                      onAccountSelect={(account) => {
                        onAccountSelect?.(account);
                        setIsAccountPanelOpen(false);
                      }}
                      onAccountSettings={(account) => onAccountSettings?.(account)}
                      onCreateAccount={() => onCreateAccount?.()}
                      isOwner={isOwner}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {isLoadingFeed ? <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : filteredPosts?.map((post, index) => (
                <BlurFade key={post.id} delay={0.05 * index} inView={true}>
                  <ThinkpagesPost
                    post={post}
                    currentUserAccountId={selectedAccount?.id || ''}
                    onLike={(postId) => {
                      if (selectedAccount) {
                        addReactionMutation.mutate({ postId, accountId: selectedAccount.id, reactionType: 'like' });
                      } else {
                        toast.error('Please select an account first');
                      }
                    }}
                    onRepost={(postId) => {
                      if (selectedAccount) {
                        toast.info('Repost functionality coming soon!');
                      } else {
                        toast.error('Please select an account first');
                      }
                    }}
                    onReply={(postId) => {
                      if (selectedAccount) {
                        toast.info('Reply functionality coming soon!');
                      } else {
                        toast.error('Please select an account first');
                      }
                    }}
                    onShare={(postId) => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'ThinkPages Post',
                          text: 'Check out this post on ThinkPages',
                          url: window.location.href
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied to clipboard!');
                      }
                    }}
                    onReaction={(postId, reactionType) => {
                      if (selectedAccount) {
                        // Validate and cast reaction type to enum
                        const validReactions = ['like', 'laugh', 'angry', 'sad', 'fire', 'thumbsup', 'thumbsdown'] as const;
                        type ValidReaction = typeof validReactions[number];
                        
                        if (validReactions.includes(reactionType as ValidReaction)) {
                          addReactionMutation.mutate({ 
                            postId, 
                            accountId: selectedAccount.id, 
                            reactionType: reactionType as ValidReaction
                          });
                        }
                      } else {
                        toast.error('Please select an account first');
                      }
                    }}
                    onAccountClick={(accountId) => {
                      toast.info('Account profile view coming soon!');
                    }}
                    showThread={true}
                  />
                </BlurFade>
              ))}
            </AnimatePresence>

            {filteredPosts?.length === 0 && !isLoadingFeed && (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? "No posts match your search criteria." 
                      : "Be the first to share something on ThinkPages!"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Trending & Live Events */}
        <div className="lg:col-span-1 space-y-4">
          {/* Trending Topics */}
          <Card className="glass-hierarchy-child">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Trending Topics
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                What's happening across the network
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingTrending ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin h-6 w-6" />
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-col sm:overflow-visible [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
                  {trendingTopics?.map((topic, index) => (
                    <BlurFade key={topic.hashtag} delay={0.1 + 0.03 * index}>
                      <button
                        className="flex min-w-[200px] items-center justify-between rounded-lg border border-transparent bg-background/40 p-3 text-left transition-colors hover:border-border hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fcc309]/20 text-xs font-bold text-[#800000]">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-sm leading-tight">#{topic.hashtag}</div>
                            <div className="text-xs text-muted-foreground">
                              {topic.postCount} thinks
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="text-xs font-medium text-green-600">
                            +{Math.floor(Math.random() * 50 + 10)}%
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
            onEventClick={(eventId) => console.log('Event clicked:', eventId)}
          />

          {/* ThinkPages Guide */}
          <ThinkPagesGuide />
        </div>
      </div>

    </div>
  );
}
