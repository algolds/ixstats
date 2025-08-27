"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  RiTimeLine,
  RiShakeHandsLine,
  RiExchangeLine,
  RiGlobalLine,
  RiStarLine,
  RiAlarmWarningLine,
  RiFileTextLine,
  RiUserAddLine,
  RiHeartLine,
  RiChat3Line,
  RiShareLine,
  RiMoreLine,
  RiFlagLine,
  RiTrophyLine,
  RiFireLine,
  RiThumbUpLine,
  RiEyeLine,
  RiFilterLine,
  RiRefreshLine,
  RiBookmarkLine
} from "react-icons/ri";

interface SocialActivityFeedProps {
  countryId?: string;
  feedType?: 'global' | 'country' | 'following' | 'achievements';
  compact?: boolean;
  maxItems?: number;
  showInteractions?: boolean;
  className?: string;
}

interface ActivityItem {
  id: string;
  type: 'embassy_established' | 'trade_agreement' | 'cultural_exchange' | 'achievement_unlocked' | 
        'diplomatic_crisis' | 'intelligence_briefing' | 'alliance_formed' | 'summit_hosted' | 
        'award_received' | 'milestone_reached' | 'treaty_signed' | 'delegation_visit';
  timestamp: string;
  primaryCountry: {
    id: string;
    name: string;
    code: string;
    flag?: string;
  };
  secondaryCountry?: {
    id: string;
    name: string;
    code: string;
    flag?: string;
  };
  title: string;
  description: string;
  details?: string;
  metrics?: {
    impact: number; // 1-100
    significance: 'low' | 'medium' | 'high' | 'critical';
    visibility: 'public' | 'restricted' | 'confidential';
  };
  interactions: {
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
  };
  tags: string[];
  relatedAchievements?: string[];
  media?: {
    type: 'image' | 'document' | 'video';
    url: string;
    caption?: string;
  }[];
  trend?: 'trending' | 'breaking' | 'developing';
}

const ACTIVITY_TYPES = {
  embassy_established: {
    icon: RiShakeHandsLine,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'Embassy Established'
  },
  trade_agreement: {
    icon: RiExchangeLine,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    label: 'Trade Agreement'
  },
  cultural_exchange: {
    icon: RiGlobalLine,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    label: 'Cultural Exchange'
  },
  achievement_unlocked: {
    icon: RiStarLine,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    label: 'Achievement Unlocked'
  },
  diplomatic_crisis: {
    icon: RiAlarmWarningLine,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Diplomatic Crisis'
  },
  intelligence_briefing: {
    icon: RiFileTextLine,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    label: 'Intelligence Briefing'
  },
  alliance_formed: {
    icon: RiUserAddLine,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    label: 'Alliance Formed'
  },
  summit_hosted: {
    icon: RiFlagLine,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    label: 'Summit Hosted'
  },
  award_received: {
    icon: RiTrophyLine,
    color: 'text-gold-400',
    bgColor: 'bg-yellow-500/20',
    label: 'Award Received'
  },
  milestone_reached: {
    icon: RiFireLine,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    label: 'Milestone Reached'
  },
  treaty_signed: {
    icon: RiFileTextLine,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    label: 'Treaty Signed'
  },
  delegation_visit: {
    icon: RiUserAddLine,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
    label: 'Delegation Visit'
  }
} as const;

// Mock data - in production this would come from tRPC APIs
const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'embassy_established',
    timestamp: '2024-01-15T14:30:00Z',
    primaryCountry: { id: '1', name: 'Federal Republic of Astoria', code: 'AST' },
    secondaryCountry: { id: '2', name: 'Kingdom of Valoria', code: 'VAL' },
    title: 'Astoria establishes embassy in Valoria',
    description: 'First diplomatic mission established to strengthen bilateral relations',
    details: 'The embassy will focus on trade cooperation and cultural exchange programs.',
    metrics: {
      impact: 85,
      significance: 'high',
      visibility: 'public'
    },
    interactions: { likes: 142, comments: 23, shares: 31, bookmarks: 18 },
    tags: ['diplomacy', 'bilateral', 'embassy'],
    trend: 'trending'
  },
  {
    id: '2',
    type: 'achievement_unlocked',
    timestamp: '2024-01-15T12:15:00Z',
    primaryCountry: { id: '3', name: 'United Provinces of Meridia', code: 'MER' },
    title: 'Meridia unlocks "Peace Architect" achievement',
    description: 'Successfully mediated 10 international disputes',
    metrics: {
      impact: 70,
      significance: 'medium',
      visibility: 'public'
    },
    interactions: { likes: 89, comments: 12, shares: 15, bookmarks: 7 },
    tags: ['achievement', 'peace', 'mediation'],
    relatedAchievements: ['peace_architect'],
    trend: 'breaking'
  },
  {
    id: '3',
    type: 'trade_agreement',
    timestamp: '2024-01-15T10:45:00Z',
    primaryCountry: { id: '4', name: 'Republic of Nordica', code: 'NOR' },
    secondaryCountry: { id: '5', name: 'Empire of Solaris', code: 'SOL' },
    title: 'Major trade pact signed between Nordica and Solaris',
    description: 'Comprehensive agreement covering energy, technology, and agricultural sectors',
    details: 'Expected to increase bilateral trade by 40% over the next three years.',
    metrics: {
      impact: 92,
      significance: 'critical',
      visibility: 'public'
    },
    interactions: { likes: 267, comments: 45, shares: 78, bookmarks: 34 },
    tags: ['trade', 'economy', 'bilateral', 'energy'],
    trend: 'trending'
  }
];

const SocialActivityFeedComponent: React.FC<SocialActivityFeedProps> = ({
  countryId,
  feedType = 'global',
  compact = false,
  maxItems = 50,
  showInteractions = true,
  className
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'impact'>('recent');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch live intelligence data
  const { data: intelligenceData, isLoading: loadingIntelligence } = api.intelligence.getFeed.useQuery();
  
  // Fetch diplomatic activity data if countryId is available
  const { data: activityData, isLoading: loadingActivity } = api.diplomaticIntelligence.getActivityIntelligence.useQuery(
    { 
      countryId: countryId || '', 
      clearanceLevel: 'RESTRICTED', // Default to RESTRICTED for more data
      limit: Math.min(maxItems, 50) 
    },
    { 
      enabled: !!countryId && feedType === 'country',
      refetchInterval: 30000 // Refetch every 30 seconds for live updates
    }
  );

  // Transform API data to ActivityItem format
  const transformedActivities = useMemo(() => {
    const activities: ActivityItem[] = [];

    // Transform intelligence feed data
    if (intelligenceData) {
      intelligenceData.forEach((item: any) => {
        activities.push({
          id: item.id,
          type: 'intelligence_briefing',
          timestamp: item.timestamp,
          primaryCountry: {
            id: 'system',
            name: item.source || 'Intelligence Division',
            code: 'INT'
          },
          title: item.title,
          description: item.content,
          details: item.description,
          metrics: {
            impact: item.priority === 'critical' ? 90 : 
                   item.priority === 'high' ? 70 : 
                   item.priority === 'medium' ? 50 : 30,
            significance: (item.priority === 'critical' ? 'critical' : 
                         item.priority === 'high' ? 'high' : 
                         item.priority === 'medium' ? 'medium' : 'low') as 'low' | 'medium' | 'high' | 'critical',
            visibility: 'public'
          },
          interactions: {
            likes: Math.floor(Math.random() * 50) + 10,
            comments: Math.floor(Math.random() * 20),
            shares: Math.floor(Math.random() * 15),
            bookmarks: Math.floor(Math.random() * 10)
          },
          tags: [item.type || 'intelligence', item.region || 'global'].filter(Boolean) as string[],
          trend: (item.priority === 'critical' ? 'breaking' : 
                 item.priority === 'high' ? 'trending' : undefined) as 'trending' | 'breaking' | 'developing' | undefined
        });
      });
    }

    // Transform activity data
    if (activityData) {
      activityData.forEach((activity: any) => {
        const activityType = activity.activityType === 'diplomatic' ? 'embassy_established' :
                           activity.activityType === 'economic' ? 'trade_agreement' :
                           activity.activityType === 'cultural' ? 'cultural_exchange' :
                           'intelligence_briefing';

        activities.push({
          id: activity.id,
          type: activityType,
          timestamp: activity.timestamp,
          primaryCountry: {
            id: activity.countryId,
            name: 'Country',  // Would need to fetch country name separately
            code: 'CTR'
          },
          title: `${activity.activityType} activity`,
          description: activity.description,
          metrics: {
            impact: activity.importance === 'high' ? 80 : 
                   activity.importance === 'medium' ? 60 : 40,
            significance: (activity.importance === 'high' ? 'high' : 
                         activity.importance === 'medium' ? 'medium' : 'low') as 'low' | 'medium' | 'high' | 'critical',
            visibility: (activity.classification?.toLowerCase() === 'confidential' ? 'confidential' : 
                       activity.classification?.toLowerCase() === 'restricted' ? 'restricted' : 'public') as 'public' | 'restricted' | 'confidential'
          },
          interactions: {
            likes: Math.floor(Math.random() * 30) + 5,
            comments: Math.floor(Math.random() * 15),
            shares: Math.floor(Math.random() * 10),
            bookmarks: Math.floor(Math.random() * 8)
          },
          tags: [activity.activityType, activity.classification.toLowerCase()] as string[],
          relatedAchievements: (activity.relatedCountries && activity.relatedCountries.length > 0) ? ['diplomatic_action'] : undefined
        });
      });
    }

    return activities;
  }, [intelligenceData, activityData]) as ActivityItem[];

  // Filter and sort activities
  const filteredActivities = useMemo((): ActivityItem[] => {
    let filtered = transformedActivities.length > 0 ? transformedActivities : MOCK_ACTIVITIES;

    // Apply type filter
    if (filter !== 'all') {
      filtered = filtered.filter(activity => activity.type === filter);
    }

    // Apply feed type filter
    if (feedType === 'country' && countryId) {
      filtered = filtered.filter(activity => 
        activity.primaryCountry.id === countryId || 
        activity.secondaryCountry?.id === countryId
      );
    }

    // Sort activities
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.interactions.likes + b.interactions.shares) - 
                 (a.interactions.likes + a.interactions.shares);
        case 'impact':
          return (b.metrics?.impact || 0) - (a.metrics?.impact || 0);
        case 'recent':
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

    return filtered.slice(0, maxItems);
  }, [filter, feedType, countryId, sortBy, maxItems, transformedActivities]);

  // Toggle item expansion
  const toggleExpansion = useCallback((itemId: string): void => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Get relative time
  const getRelativeTime = useCallback((timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  }, []);

  // Render activity item
  const renderActivityItem = (activity: ActivityItem, index: number): React.ReactElement => {
    const typeConfig = ACTIVITY_TYPES[activity.type];
    const IconComponent = typeConfig.icon;
    const isExpanded = expandedItems.has(activity.id);

    return (
      <motion.article
        key={activity.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          "glass-hierarchy-child rounded-lg p-4 hover:bg-white/10 transition-all duration-300",
          compact ? "p-3" : "p-4"
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Activity icon */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            typeConfig.bgColor
          )}>
            <IconComponent className={cn("w-5 h-5", typeConfig.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title and metadata */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white mb-1 leading-tight">
                  {activity.title}
                </h4>
                
                {/* Countries involved */}
                <div className="flex items-center gap-2 text-sm text-[--intel-silver] mb-1">
                  <span className="font-medium text-[--intel-gold]">
                    {activity.primaryCountry.name}
                  </span>
                  {activity.secondaryCountry && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-[--intel-gold]">
                        {activity.secondaryCountry.name}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Trend indicator */}
              {activity.trend && (
                <div className={cn(
                  "flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium",
                  activity.trend === 'trending' ? "bg-orange-500/20 text-orange-400" :
                  activity.trend === 'breaking' ? "bg-red-500/20 text-red-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  {activity.trend === 'trending' && <RiFireLine className="w-3 h-3 inline mr-1" />}
                  {activity.trend}
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-[--intel-silver] text-sm leading-relaxed mb-3">
              {activity.description}
            </p>

            {/* Expanded details */}
            <AnimatePresence>
              {isExpanded && activity.details && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3"
                >
                  <div className="p-3 bg-white/5 rounded-lg border-l-2 border-[--intel-gold]/30">
                    <p className="text-sm text-[--intel-silver]">{activity.details}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tags */}
            {activity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {activity.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-white/10 text-[--intel-silver] text-xs rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metrics */}
            {activity.metrics && !compact && (
              <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[--intel-silver]">Impact:</span>
                  <span className={cn(
                    "font-medium",
                    activity.metrics.impact >= 80 ? "text-green-400" :
                    activity.metrics.impact >= 60 ? "text-yellow-400" : "text-orange-400"
                  )}>
                    {activity.metrics.impact}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[--intel-silver]">Significance:</span>
                  <span className={cn(
                    "font-medium capitalize",
                    activity.metrics.significance === 'critical' ? "text-red-400" :
                    activity.metrics.significance === 'high' ? "text-orange-400" :
                    activity.metrics.significance === 'medium' ? "text-yellow-400" : "text-green-400"
                  )}>
                    {activity.metrics.significance}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
            <RiTimeLine className="w-3 h-3" />
            <span>{getRelativeTime(activity.timestamp)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {showInteractions && (
              <>
                {/* Like */}
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-[--intel-silver] hover:text-red-400 transition-colors rounded">
                  <RiHeartLine className="w-3 h-3" />
                  <span>{activity.interactions.likes}</span>
                </button>

                {/* Comment */}
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-[--intel-silver] hover:text-blue-400 transition-colors rounded">
                  <RiChat3Line className="w-3 h-3" />
                  <span>{activity.interactions.comments}</span>
                </button>

                {/* Share */}
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-[--intel-silver] hover:text-green-400 transition-colors rounded">
                  <RiShareLine className="w-3 h-3" />
                  <span>{activity.interactions.shares}</span>
                </button>

                {/* Bookmark */}
                <button className="p-1 text-[--intel-silver] hover:text-[--intel-gold] transition-colors rounded">
                  <RiBookmarkLine className="w-3 h-3" />
                </button>
              </>
            )}

            {/* Expand/collapse */}
            {activity.details && (
              <button
                onClick={() => toggleExpansion(activity.id)}
                className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded"
              >
                <RiMoreLine className={cn(
                  "w-3 h-3 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </button>
            )}

            {/* View details */}
            <button className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded">
              <RiEyeLine className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
              <RiTimeLine className="w-5 h-5" />
              Diplomatic Activity Feed
            </h3>
            <p className="text-[--intel-silver] text-sm mt-1">
              Latest diplomatic events and international activities
            </p>
          </div>

          <button className="p-2 text-[--intel-silver] hover:text-white transition-colors rounded-lg bg-white/10">
            <RiRefreshLine className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      {!compact && (
        <div className="flex flex-wrap gap-2 items-center">
          {/* Type filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="all" className="bg-[--intel-navy]">All Activities</option>
            {Object.entries(ACTIVITY_TYPES).map(([type, config]) => (
              <option key={type} value={type} className="bg-[--intel-navy]">
                {config.label}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'impact')}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="recent" className="bg-[--intel-navy]">Most Recent</option>
            <option value="popular" className="bg-[--intel-navy]">Most Popular</option>
            <option value="impact" className="bg-[--intel-navy]">Highest Impact</option>
          </select>
        </div>
      )}

      {/* Loading State */}
      {(loadingIntelligence || loadingActivity) ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/20 rounded w-3/4"></div>
                  <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Activity list */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredActivities.map(renderActivityItem)}
            </AnimatePresence>
          </div>

          {/* Load more */}
          {filteredActivities.length === maxItems && (
            <div className="text-center pt-4">
              <button className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-[--intel-silver] hover:text-white hover:bg-white/20 transition-colors">
                Load More Activities
              </button>
            </div>
          )}

          {/* No activities */}
          {filteredActivities.length === 0 && (
            <div className="text-center py-8 text-[--intel-silver]">
              <RiTimeLine className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No activities found. {countryId && feedType === 'country' ? 'Country-specific intelligence may require higher clearance.' : 'Loading intelligence feed...'}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

SocialActivityFeedComponent.displayName = 'SocialActivityFeed';

export const SocialActivityFeed = React.memo(SocialActivityFeedComponent);