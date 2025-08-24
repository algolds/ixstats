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

  // tRPC mutations for engagement
  const engageWithActivityMutation = api.activities.engageWithActivity.useMutation();

  // Fetch live data from tRPC APIs
  const { data: activitiesData, isLoading: activitiesLoading, refetch: refetchActivities } = api.activities.getGlobalFeed.useQuery({
    limit: 20,
    filter: activeTab === 'achievements' ? 'achievements' : 'all',
    category: filterType,
  });

  const { data: trendingData, isLoading: trendingLoading } = api.activities.getTrendingTopics.useQuery({
    limit: 6,
    timeRange: '24h',
  });

  const { data: userCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Transform trending data
  const trendingTopics: TrendingTopic[] = useMemo(() => {
    if (!trendingData) return [];
    return trendingData.map(topic => ({
      id: topic.id,
      title: topic.title,
      category: topic.category,
      participants: topic.participants,
      trend: topic.trend,
    }));
  }, [trendingData]);

  // Transform activity feed data
  const activityFeed = useMemo((): ActivityFeedItem[] => {
    if (!activitiesData?.activities) return [];

    return activitiesData.activities.map((activity) => ({
      id: activity.id,
      type: activity.type as ActivityFeedItem['type'],
      category: activity.category as ActivityFeedItem['category'],
      user: {
        id: activity.user.id,
        name: activity.user.name,
        avatar: undefined, // No placeholder avatars - only real user avatars
        countryName: activity.user.countryName,
        countryFlag: activity.user.countryName ? flagUrls[activity.user.countryName] : undefined,
      },
      content: {
        title: activity.content.title,
        description: activity.content.description,
        metadata: activity.content.metadata,
      },
      engagement: {
        likes: activity.engagement.likes,
        comments: activity.engagement.comments,
        shares: activity.engagement.shares,
        views: activity.engagement.views || 0,
      },
      timestamp: new Date(activity.timestamp),
      priority: activity.priority as ActivityFeedItem['priority'],
      visibility: activity.visibility as ActivityFeedItem['visibility'],
      relatedCountries: activity.relatedCountries || [],
    }));
  }, [activitiesData, flagUrls]);

  // Load flags for countries mentioned in activities
  useEffect(() => {
    if (activitiesData?.activities) {
      const countryNames = new Set<string>();
      
      activitiesData.activities.forEach(activity => {
        if (activity.user.countryName) {
          countryNames.add(activity.user.countryName);
        }
      });
      
      if (countryNames.size > 0) {
        unifiedFlagService.batchGetFlags(Array.from(countryNames)).then((flags) => {
          const filteredFlags: Record<string, string> = {};
          Object.entries(flags).forEach(([key, value]) => {
            if (value !== null) {
              filteredFlags[key] = value;
            }
          });
          setFlagUrls(filteredFlags);
        });
      }
    }
  }, [activitiesData]);

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

  const handleEngagement = async (activityId: string, action: 'like' | 'comment' | 'share' | 'view') => {
    if (!user?.id) return;
    
    try {
      await engageWithActivityMutation.mutateAsync({
        activityId,
        action,
        userId: user.id,
      });
      // Refetch the activities to show updated engagement numbers
      await refetchActivities();
    } catch (error) {
      console.error('Error engaging with activity:', error);
    }
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

  if (activitiesLoading || trendingLoading) {
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
             Activity Feed
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

                      {/* Engagement Actions - REAL DATA ONLY */}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <button 
                          className="flex items-center gap-1 hover:text-red-500 transition-colors disabled:opacity-50"
                          onClick={() => handleEngagement(activity.id, 'like')}
                          disabled={engageWithActivityMutation.isLoading}
                        >
                          <Heart className="h-4 w-4" />
                          0
                        </button>
                        <button 
                          className="flex items-center gap-1 hover:text-blue-500 transition-colors disabled:opacity-50"
                          onClick={() => handleEngagement(activity.id, 'comment')}
                          disabled={engageWithActivityMutation.isLoading}
                        >
                          <MessageSquare className="h-4 w-4" />
                          0
                        </button>
                        <button 
                          className="flex items-center gap-1 hover:text-green-500 transition-colors disabled:opacity-50"
                          onClick={() => handleEngagement(activity.id, 'share')}
                          disabled={engageWithActivityMutation.isLoading}
                        >
                          <Share2 className="h-4 w-4" />
                          0
                        </button>
                        <button className="flex items-center gap-1 hover:text-purple-500 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
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