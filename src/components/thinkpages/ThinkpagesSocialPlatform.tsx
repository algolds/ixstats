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
      <div className="flex items-center justify-between">
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-3 cursor-help">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  Thinkpages Social Platform
                </h2>
              </TooltipTrigger>
              <TooltipContent className="max-w-md p-4 bg-gray-100/80 text-gray-900 rounded-lg shadow-lg border border-gray-300 dark:bg-neutral-900/80 dark:text-white dark:border-neutral-700 backdrop-blur-sm">
                <p className="text-sm">
                  Thinkpages: An online social media and networking service, originally conceived in 2002 by military engineer Marcos Perle as a blog for Levantine Union forces. It evolved into a global platform, acquired by Valtari in 2022, now connecting billions worldwide. Share 'thinks,' photos, and videos, engage in groups, and communicate via Thinkshare.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-muted-foreground">
            {countryName} • Where Minds Meet
          </p>
        </div>

        {isOwner && (
          <Button
            onClick={() => setShowAccountCreation(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="glass-hierarchy-child">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Account Manager</CardTitle>
              <p className="text-sm text-muted-foreground">
                {accounts?.length || 0}/25 accounts created
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAccounts ? <Loader2 className="animate-spin"/> : <div className="space-y-3">
                <div className={cn("flex items-center justify-between p-3 rounded-lg border", getAccountTypeColor('government'))}>
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    <span className="font-medium">Government</span>
                  </div>
                  <Badge variant="outline">{getAccountTypeCount('government')}</Badge>
                </div>

                <div className={cn("flex items-center justify-between p-3 rounded-lg border", getAccountTypeColor('media'))}>
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4" />
                    <span className="font-medium">Media</span>
                  </div>
                  <Badge variant="outline">{getAccountTypeCount('media')}</Badge>
                </div>

                <div className={cn("flex items-center justify-between p-3 rounded-lg border", getAccountTypeColor('citizen'))}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">Citizens</span>
                  </div>
                  <Badge variant="outline">{getAccountTypeCount('citizen')}</Badge>
                </div>
              </div>}

              {isOwner && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Your Accounts</h4>
                  {accounts?.map(account => (
                    <div
                      key={account.id}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg transition-colors",
                        selectedAccount?.id === account.id 
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                          : "hover:bg-white/10"
                      )}
                    >
                      <button
                        onClick={() => setSelectedAccount(account)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <div className={cn("p-1 rounded", getAccountTypeColor(account.accountType))}>
                          {account.accountType === 'government' && <Crown className="h-3 w-3" />}
                          {account.accountType === 'media' && <Newspaper className="h-3 w-3" />}
                          {account.accountType === 'citizen' && <Users className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{account.displayName}</div>
                          <div className="text-xs text-muted-foreground">@{account.username}</div>
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedAccountForSettings(account); setShowAccountSettings(true); }}>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-child">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Trending Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingTrending ? <Loader2 className="animate-spin"/> : trendingTopics?.map((topic, index) => (
                <button
                  key={topic.hashtag}
                  className="w-full flex items-center justify-between p-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div>
                    <div className="font-medium text-sm">#{topic.hashtag}</div>
                    <div className="text-xs text-muted-foreground">
                      {topic.postCount} posts
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    #{index + 1}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
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
            <PostComposer
              account={selectedAccount}
              onPost={handlePost}
              placeholder="What's happening in your nation?"
            />
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {isLoadingFeed ? <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : filteredPosts?.map(post => (
                <ThinkpagesPost
                  key={post.id}
                  post={post}
                  currentUserAccountId={selectedAccount?.id}
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