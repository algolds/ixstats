"use client";

import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  Plus, 
  Crown, 
  Newspaper, 
  Users, 
  TrendingUp, 
  Search, 
  Settings, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { AccountSettingsModal } from './AccountSettingsModal';
import { AccountCreationModal } from './AccountCreationModal';
import { PostComposer } from './PostComposer';
import { ThinkpagesPost } from './ThinkpagesPost';
import { EnhancedAccountManager } from './EnhancedAccountManager';
import { GlassCanvasComposer } from './GlassCanvasComposer';
import { LiveEventsFeed } from './LiveEventsFeed';
import { ThinkPagesGuide } from './ThinkPagesGuide';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

interface ThinkpagesSocialPlatformProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
}

export function ThinkpagesSocialPlatform({
  countryId,
  countryName,
  isOwner
}: ThinkpagesSocialPlatformProps) {
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'recent' | 'trending' | 'hot'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedAccountForSettings, setSelectedAccountForSettings] = useState<any | null>(null);

  const { data: accounts, isLoading: isLoadingAccounts, refetch: refetchAccounts } = api.thinkpages.getAccountsByCountry.useQuery({ countryId });
  const { data: feed, isLoading: isLoadingFeed, refetch: refetchFeed } = api.thinkpages.getFeed.useQuery({ countryId, filter: feedFilter });
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

  const handleAccountCreated = useCallback(() => {
    refetchAccounts();
  }, [refetchAccounts]);

  const handlePost = useCallback(() => {
    refetchFeed();
  }, [refetchFeed]);

  const getAccountTypeCount = (type: string) => {
    return accounts?.filter(account => account.accountType === type).length || 0;
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'government': return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'media': return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      case 'citizen': return 'border-green-500/30 bg-green-500/10 text-green-400';
      default: return 'border-gray-500/30 bg-gray-500/10 text-gray-400';
    }
  };

  const filteredPosts = feed?.posts.filter(post => {
    if (searchQuery) {
      return post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
             post.account.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             post.account.username.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar - Account Manager */}
        <div className="lg:col-span-3 space-y-4">
          {isLoadingAccounts ? (
            <Card className="glass-hierarchy-child">
              <CardContent className="p-8 text-center">
                <Loader2 className="animate-spin h-8 w-8 mx-auto" />
              </CardContent>
            </Card>
          ) : (
            <EnhancedAccountManager
              countryId={countryId}
              accounts={accounts || []}
              selectedAccount={selectedAccount}
              onAccountSelect={setSelectedAccount}
              onAccountSettings={(account) => { setSelectedAccountForSettings(account); setShowAccountSettings(true); }}
              onCreateAccount={() => setShowAccountCreation(true)}
              isOwner={isOwner}
            />
          )}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-6 space-y-4">
          {/* Thinkpages Header with Canonical Design */}
          
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts, accounts, hashtags..."
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={feedFilter === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedFilter('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    variant={feedFilter === 'trending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedFilter('trending')}
                  >
                    Trending
                  </Button>
                  <Button
                    variant={feedFilter === 'hot' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedFilter('hot')}
                  >
                    Hot
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => refetchFeed()}>
                  {isLoadingFeed ? <Loader2 className="animate-spin h-4 w-4"/> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => calculateTrendingMutation.mutate()}>
                  {calculateTrendingMutation.isPending ? <Loader2 className="animate-spin h-4 w-4"/> : <TrendingUp className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isOwner && selectedAccount && (
            <GlassCanvasComposer
              account={selectedAccount}
              onPost={handlePost}
              placeholder="What's happening in your nation? Share with live economic data..."
              countryId={countryId}
            />
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {isLoadingFeed ? <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : filteredPosts?.map(post => (
                <ThinkpagesPost
                  key={post.id}
                  post={post}
                  currentUserAccountId={selectedAccount?.id || ''}
                  onLike={(postId) => console.log('Like:', postId)}
                  onRepost={(postId) => console.log('Repost:', postId)}
                  onReply={(postId) => console.log('Reply:', postId)}
                  onShare={(postId) => console.log('Share:', postId)}
                  onReaction={(postId, reaction) => console.log('Reaction:', postId, reaction)}
                  onAccountClick={(accountId) => console.log('Account:', accountId)}
                  showThread={true}
                />
              ))}
            </AnimatePresence>

            {filteredPosts?.length === 0 && !isLoadingFeed && (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Thoughts Found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? "No posts match your search criteria." 
                      : "Be the first to think something on Thinkpages!"
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Trending & Live Events */}
        <div className="lg:col-span-3 space-y-4">
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
                  <Loader2 className="animate-spin h-6 w-6"/>
                </div>
              ) : (
                trendingTopics?.map((topic, index) => (
                  <button
                    key={topic.hashtag}
                    className="w-full flex items-center justify-between p-3 hover:bg-accent/50 rounded-lg transition-colors text-left border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded bg-[#fcc309]/20 text-[#800000] text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">#{topic.hashtag}</div>
                        <div className="text-xs text-muted-foreground">
                          {topic.postCount} thinks
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">
                        +{Math.floor(Math.random() * 50 + 10)}%
                      </span>
                    </div>
                  </button>
                ))
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

      <AccountCreationModal
        isOpen={showAccountCreation}
        onClose={() => setShowAccountCreation(false)}
        onAccountCreated={handleAccountCreated}
        countryId={countryId}
        countryName={countryName}
        existingAccountCount={accounts?.length || 0}
      />

      {selectedAccountForSettings && (
        <AccountSettingsModal
          isOpen={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
          account={selectedAccountForSettings}
          onAccountUpdate={() => refetchAccounts()}
        />
      )}
    </div>
  );
}