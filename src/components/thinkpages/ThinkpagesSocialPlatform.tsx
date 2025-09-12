"use client";

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  Users, 
  TrendingUp, 
  Search, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ThinkpagesPost } from './ThinkpagesPost';
import { LiveEventsFeed } from './LiveEventsFeed';
import { ThinkPagesGuide } from './ThinkPagesGuide';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { BlurFade } from '~/components/magicui/blur-fade';

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
  const [feedFilter, setFeedFilter] = useState<'recent' | 'trending' | 'hot'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: feed, isLoading: isLoadingFeed, refetch: refetchFeed } = api.thinkpages.getFeed.useQuery({ userId: countryId, filter: feedFilter });
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


  const filteredPosts = feed?.posts.filter(post => {
    // Only show posts from this country's accounts (account relation not available)
    // const isFromThisCountry = post.account?.countryId === countryId;
    
    // if (!isFromThisCountry) {
    //   return false;
    // }
    
    if (searchQuery) {
      return post.content.toLowerCase().includes(searchQuery.toLowerCase());
      // account properties not available: post.account.displayName, post.account.username
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Country Feed Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-[--intel-gold]">{countryName} ThinkPages</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed - Takes up most space */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-hierarchy-child">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${countryName} posts and accounts...`}
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


          <div className="space-y-4">
            <AnimatePresence>
              {isLoadingFeed ? <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : filteredPosts?.map((post, index) => (
                <BlurFade key={post.id} delay={0.05 * index} inView={true}>
                  <ThinkpagesPost
                    post={post}
                    currentUserAccountId={''}
                    onLike={(postId) => {
                      refetchFeed();
                    }}
                    onRepost={(postId) => {
                      refetchFeed();
                    }}
                    onReply={(postId) => {
                      console.log('Reply to:', postId);
                      refetchFeed();
                    }}
                    onShare={(postId) => {
                      console.log('Shared post:', postId);
                    }}
                    onReaction={(postId, reactionType) => {
                      console.log('Reaction:', reactionType, 'on post:', postId);
                      refetchFeed();
                    }}
                    onAccountClick={(accountId) => {
                      console.log('View account:', accountId);
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
                  <h3 className="text-lg font-semibold mb-2">No Posts from {countryName}</h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? "No posts from this country match your search criteria." 
                      : `This country hasn't posted anything on ThinkPages yet.`
                    }
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
                  <Loader2 className="animate-spin h-6 w-6"/>
                </div>
              ) : (
                trendingTopics?.map((topic, index) => (
                  <BlurFade key={topic.hashtag} delay={0.1 + 0.03 * index}>
                    <button
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
                  </BlurFade>
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

    </div>
  );
}