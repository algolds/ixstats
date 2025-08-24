"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Icons
import { 
  Activity, 
  Users, 
  Globe, 
  TrendingUp, 
  Trophy, 
  Star,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Crown,
  Zap,
  Target,
  Eye,
  UserPlus,
  Handshake,
  Briefcase,
  Award,
  Clock,
  Filter,
  Search
} from "lucide-react";

// Utils
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import { unifiedFlagService } from "~/lib/unified-flag-service";

interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  participants: number;
  trend: 'up' | 'down' | 'stable';
}

interface ActivityFeedItem {
  id: string;
  type: 'achievement' | 'milestone' | 'social' | 'diplomatic' | 'economic' | 'meta';
  category: 'game' | 'platform' | 'social';
  user: {
    id: string;
    name: string;
    avatar?: string;
    countryName?: string;
    countryFlag?: string;
  };
  content: {
    title: string;
    description: string;
    metadata?: Record<string, any>;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  visibility: 'public' | 'followers' | 'friends';
  relatedCountries?: string[];
  attachments?: {
    type: 'image' | 'chart' | 'document';
    url: string;
    caption?: string;
  }[];
}

interface UserProfile {
  id: string;
  countryId?: string;
  followingCountries?: string[];
  friends?: string[];
  achievements?: number;
  influence?: number;
}

interface PlatformActivityFeedProps {
  userProfile?: UserProfile;
  className?: string;
}

export function PlatformActivityFeed({ userProfile, className }: PlatformActivityFeedProps) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'friends' | 'achievements'>('all');
  const [filterType, setFilterType] = useState<'all' | 'game' | 'platform' | 'social'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [flagUrls, setFlagUrls] = useState<Record<string, string>>({});
  const [showTrending, setShowTrending] = useState(false);

  // Fetch real data
  const { data: allCountries } = api.countries.getAll.useQuery();
  const { data: globalStats } = api.countries.getGlobalStats.useQuery();
  const { data: userCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Generate trending topics from real data
  const trendingTopics: TrendingTopic[] = useMemo(() => {
    if (!allCountries?.countries) return [];
    const countries = allCountries.countries;
    const topics: TrendingTopic[] = [];
    
    // Economic achievements
    const extravagantCountries = countries.filter(c => c.economicTier === 'Extravagant').length;
    if (extravagantCountries > 0) {
      topics.push({ id: '1', title: 'Economic Powerhouse Achievement', category: 'Achievement', participants: extravagantCountries, trend: 'up' });
    }
    
    // Growth trends
    const highGrowthCountries = countries.filter(c => (c.adjustedGdpGrowth || 0) > 0.04).length;
    if (highGrowthCountries > 0) {
      topics.push({ id: '2', title: 'High Growth Nations', category: 'Economics', participants: highGrowthCountries, trend: 'up' });
    }
    
    // Population milestones
    const largePopulationCountries = countries.filter(c => (c.currentPopulation || 0) > 50000000).length;
    if (largePopulationCountries > 0) {
      topics.push({ id: '3', title: 'Population Milestones', category: 'Demographics', participants: largePopulationCountries, trend: 'stable' });
    }
    
    return topics;
  }, [allCountries]);

  // Generate realistic activity feed
  const activityFeed = useMemo((): ActivityFeedItem[] => {
    if (!allCountries?.countries) return [];

    const countries = allCountries.countries;
    const activities: ActivityFeedItem[] = [];
    const now = new Date();

    // Generate achievement activities
    const topPerformers = [...countries]
      .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
      .slice(0, 10);

    topPerformers.forEach((country, index) => {
      if (Math.random() > 0.6) { // 40% chance of recent activity
        activities.push({
          id: `achievement-${country.id}-${index}`,
          type: 'achievement',
          category: 'game',
          user: {
            id: `user-${country.id}`,
            name: country.leader || `Leader of ${country.name}`,
            countryName: country.name,
            countryFlag: flagUrls[country.name]
          },
          content: {
            title: 'Economic Milestone Reached',
            description: `${country.name} has achieved ${formatCurrency(country.currentTotalGdp || 0)} total GDP, entering the ${country.economicTier} tier!`,
            metadata: {
              gdp: country.currentTotalGdp,
              tier: country.economicTier,
              growth: country.adjustedGdpGrowth
            }
          },
          engagement: {
            likes: Math.floor(Math.random() * 50) + 10,
            comments: Math.floor(Math.random() * 20) + 2,
            shares: Math.floor(Math.random() * 15) + 1,
            views: Math.floor(Math.random() * 200) + 50
          },
          timestamp: new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000),
          priority: country.economicTier === 'Extravagant' ? 'critical' : 'high',
          visibility: 'public',
          relatedCountries: [country.id]
        });
      }
    });

    // Generate social activities
    if (userProfile?.countryId) {
      activities.push({
        id: 'social-follow-1',
        type: 'social',
        category: 'social',
        user: {
          id: 'user-random-1',
          name: 'Alexandra Chen',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=100',
          countryName: 'Valorheim',
          countryFlag: flagUrls['Valorheim']
        },
        content: {
          title: 'New Follower',
          description: `Started following ${userCountry?.name || 'your country'} and added them to their watchlist`,
          metadata: {
            followType: 'country'
          }
        },
        engagement: {
          likes: 5,
          comments: 1,
          shares: 0,
          views: 23
        },
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        priority: 'medium',
        visibility: 'public'
      });
    }

    // Generate diplomatic activities
    activities.push({
      id: 'diplomatic-1',
      type: 'diplomatic',
      category: 'game',
      user: {
        id: 'system',
        name: 'IxStats System',
        avatar: undefined
      },
      content: {
        title: 'New Trade Alliance Formed',
        description: 'Lysandria and Crystalia have established a comprehensive trade agreement, boosting both economies',
        metadata: {
          countries: ['Lysandria', 'Crystalia'],
          tradeValue: 50000000000,
          agreementType: 'trade'
        }
      },
      engagement: {
        likes: 34,
        comments: 8,
        shares: 12,
        views: 156
      },
      timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
      priority: 'high',
      visibility: 'public',
      relatedCountries: ['lysandria', 'crystalia']
    });

    // Generate meta/platform activities
    activities.push({
      id: 'meta-1',
      type: 'meta',
      category: 'platform',
      user: {
        id: 'platform-team',
        name: 'IxStats Team',
        avatar: undefined
      },
      content: {
        title: 'New Feature: Enhanced Activity Feed',
        description: 'Introducing the new social activity feed with real-time updates, friend following, and diplomatic intelligence',
        metadata: {
          version: '2.1.0',
          features: ['Social Feed', 'Friend System', 'Diplomatic Tracking']
        }
      },
      engagement: {
        likes: 128,
        comments: 23,
        shares: 45,
        views: 892
      },
      timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      priority: 'medium',
      visibility: 'public'
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [allCountries, userProfile, userCountry, flagUrls]);

  // Load flags
  useEffect(() => {
    if (allCountries?.countries) {
      const countryNames = allCountries.countries.map(c => c.name);
      unifiedFlagService.batchGetFlags(countryNames).then((flags) => {
        const filteredFlags: Record<string, string> = {};
        Object.entries(flags).forEach(([key, value]) => {
          if (value !== null) {
            filteredFlags[key] = value;
          }
        });
        setFlagUrls(filteredFlags);
      });
    }
  }, [allCountries]);

  const getActivityIcon = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'achievement': return Trophy;
      case 'milestone': return Target;
      case 'social': return Users;
      case 'diplomatic': return Handshake;
      case 'economic': return TrendingUp;
      case 'meta': return Zap;
      default: return Activity;
    }
  };

  const getActivityColor = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'achievement': return 'text-yellow-500';
      case 'milestone': return 'text-blue-500';
      case 'social': return 'text-green-500';
      case 'diplomatic': return 'text-purple-500';
      case 'economic': return 'text-emerald-500';
      case 'meta': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityBorder = (priority: ActivityFeedItem['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-4 border-l-red-500';
      case 'high': return 'border-l-4 border-l-yellow-500';
      case 'medium': return 'border-l-2 border-l-blue-500';
      default: return 'border-l border-l-gray-300';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredActivities = activityFeed.filter(activity => {
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'following' && userProfile?.followingCountries?.some(id => 
        activity.relatedCountries?.includes(id))) ||
      (activeTab === 'friends' && userProfile?.friends?.includes(activity.user.id)) ||
      (activeTab === 'achievements' && activity.type === 'achievement');

    const matchesFilter = filterType === 'all' || activity.category === filterType;

    const matchesSearch = searchQuery === '' || 
      activity.content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.content.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesFilter && matchesSearch;
  });

  if (!allCountries) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Platform Activity
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 glass-hierarchy-child rounded-xl">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full glass-hierarchy-parent", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Platform Activity Feed
            <Badge variant="secondary" className="ml-2">Live</Badge>
          </CardTitle>
          
          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm glass-hierarchy-interactive rounded-lg w-48"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTrending(!showTrending)}
              className={cn("flex items-center gap-2", showTrending && "bg-accent")}
            >
              <TrendingUp className="h-4 w-4" />
              Trending
            </Button>
          </div>
        </div>

        {/* Activity Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              All Activity
            </TabsTrigger>
            <TabsTrigger value="following" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Following
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {/* Trending Topics Section */}
        <AnimatePresence>
          {showTrending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className="glass-hierarchy-child rounded-xl p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Trending Topics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trendingTopics.map((topic) => (
                    <div 
                      key={topic.id} 
                      className="flex items-center justify-between p-3 glass-hierarchy-interactive rounded-lg hover:scale-[1.01] transition-transform cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm truncate">
                          {topic.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {topic.category} • {topic.participants} participants
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn(
                          "h-4 w-4",
                          topic.trend === 'up' ? 'text-green-500' : 
                          topic.trend === 'down' ? 'text-red-500' : 'text-gray-500'
                        )} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <AnimatePresence>
            {filteredActivities.map((activity, index) => {
              const IconComponent = getActivityIcon(activity.type);
              const iconColor = getActivityColor(activity.type);
              const priorityBorder = getPriorityBorder(activity.priority);

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "glass-hierarchy-child rounded-xl p-4 hover:scale-[1.01] transition-all duration-200 group",
                    priorityBorder
                  )}
                >
                  <div className="flex gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={activity.user.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {activity.user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {activity.user.countryFlag && (
                        <img 
                          src={activity.user.countryFlag} 
                          alt="Country flag" 
                          className="w-8 h-6 rounded-sm border-2 border-white/20 absolute -bottom-2 -right-2 shadow-lg"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">
                            {activity.user.name}
                          </h4>
                          {activity.user.countryName && (
                            <Badge variant="outline" className="text-xs">
                              {activity.user.countryName}
                            </Badge>
                          )}
                          <IconComponent className={cn("h-4 w-4", iconColor)} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>

                      <h5 className="font-medium text-foreground mb-1">
                        {activity.content.title}
                      </h5>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {activity.content.description}
                      </p>

                      {/* Metadata Display */}
                      {activity.content.metadata && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Object.entries(activity.content.metadata).map(([key, value]) => {
                            if (key === 'gdp' && typeof value === 'number') {
                              return (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  GDP: {formatCurrency(value)}
                                </Badge>
                              );
                            }
                            if (key === 'tier' && typeof value === 'string') {
                              return (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {value}
                                </Badge>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}

                      {/* Engagement Actions */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                          <Heart className="h-4 w-4" />
                          {activity.engagement.likes}
                        </button>
                        <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                          <MessageSquare className="h-4 w-4" />
                          {activity.engagement.comments}
                        </button>
                        <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
                          <Share2 className="h-4 w-4" />
                          {activity.engagement.shares}
                        </button>
                        <button className="flex items-center gap-1 hover:text-purple-500 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
                        {activity.engagement.views && (
                          <span className="flex items-center gap-1 ml-auto">
                            <Eye className="h-4 w-4" />
                            {activity.engagement.views}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredActivities.length === 0 && (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Activity Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search terms' : 'Activity will appear here as it happens'}
              </p>
            </div>
          )}

          {/* Load More */}
          {filteredActivities.length > 0 && (
            <div className="text-center pt-6">
              <Button variant="outline" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Load More Activity
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}