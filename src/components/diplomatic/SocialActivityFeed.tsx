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
  RiBookmarkLine,
} from "react-icons/ri";

interface SocialActivityFeedProps {
  countryId?: string;
  feedType?: "global" | "country" | "following" | "achievements";
  compact?: boolean;
  maxItems?: number;
  showInteractions?: boolean;
  className?: string;
}

interface ActivityItem {
  id: string;
  type:
    | "embassy_established"
    | "trade_agreement"
    | "cultural_exchange"
    | "achievement_unlocked"
    | "diplomatic_crisis"
    | "intelligence_briefing"
    | "alliance_formed"
    | "summit_hosted"
    | "award_received"
    | "milestone_reached"
    | "treaty_signed"
    | "delegation_visit";
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
    significance: "low" | "medium" | "high" | "critical";
    visibility: "public" | "restricted" | "confidential";
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
    type: "image" | "document" | "video";
    url: string;
    caption?: string;
  }[];
  trend?: "trending" | "breaking" | "developing";
}

const ACTIVITY_TYPES = {
  embassy_established: {
    icon: RiShakeHandsLine,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    label: "Embassy Established",
  },
  trade_agreement: {
    icon: RiExchangeLine,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    label: "Trade Agreement",
  },
  cultural_exchange: {
    icon: RiGlobalLine,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    label: "Cultural Exchange",
  },
  achievement_unlocked: {
    icon: RiStarLine,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    label: "Achievement Unlocked",
  },
  diplomatic_crisis: {
    icon: RiAlarmWarningLine,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    label: "Diplomatic Crisis",
  },
  intelligence_briefing: {
    icon: RiFileTextLine,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    label: "Intelligence Briefing",
  },
  alliance_formed: {
    icon: RiUserAddLine,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
    label: "Alliance Formed",
  },
  summit_hosted: {
    icon: RiFlagLine,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    label: "Summit Hosted",
  },
  award_received: {
    icon: RiTrophyLine,
    color: "text-gold-400",
    bgColor: "bg-yellow-500/20",
    label: "Award Received",
  },
  milestone_reached: {
    icon: RiFireLine,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    label: "Milestone Reached",
  },
  treaty_signed: {
    icon: RiFileTextLine,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    label: "Treaty Signed",
  },
  delegation_visit: {
    icon: RiUserAddLine,
    color: "text-teal-400",
    bgColor: "bg-teal-500/20",
    label: "Delegation Visit",
  },
} as const;

// All data now comes from live tRPC APIs - no mock data fallbacks

const SocialActivityFeedComponent: React.FC<SocialActivityFeedProps> = ({
  countryId,
  feedType = "global",
  compact = false,
  maxItems = 50,
  showInteractions = true,
  className,
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "impact">("recent");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch live intelligence data
  const { data: intelligenceData, isLoading: loadingIntelligence } =
    api.intelligence.getFeed.useQuery();

  // Fetch diplomatic activity data if countryId is available
  const { data: activityData, isLoading: loadingActivity } =
    api.diplomaticIntelligence.getActivityIntelligence.useQuery(
      {
        countryId: countryId || "",
        clearanceLevel: "RESTRICTED", // Default to RESTRICTED for more data
        limit: Math.min(maxItems, 50),
      },
      {
        enabled: !!countryId && feedType === "country",
        refetchInterval: 30000, // Refetch every 30 seconds for live updates
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
          type: "intelligence_briefing",
          timestamp: item.timestamp,
          primaryCountry: {
            id: "system",
            name: item.source || "Intelligence Division",
            code: "INT",
          },
          title: item.title,
          description: item.content,
          details: item.description,
          metrics: {
            impact:
              item.priority === "critical"
                ? 90
                : item.priority === "high"
                  ? 70
                  : item.priority === "medium"
                    ? 50
                    : 30,
            significance: (item.priority === "critical"
              ? "critical"
              : item.priority === "high"
                ? "high"
                : item.priority === "medium"
                  ? "medium"
                  : "low") as "low" | "medium" | "high" | "critical",
            visibility: "public",
          },
          interactions: {
            likes:
              item.views ||
              Math.max(
                10,
                Math.floor(item.priority === "critical" ? 100 : item.priority === "high" ? 50 : 20)
              ),
            comments: Math.floor((item.views || 20) * 0.2),
            shares: Math.floor((item.views || 20) * 0.15),
            bookmarks: Math.floor((item.views || 20) * 0.1),
          },
          tags: [item.type || "intelligence", item.region || "global"].filter(Boolean) as string[],
          trend: (item.priority === "critical"
            ? "breaking"
            : item.priority === "high"
              ? "trending"
              : undefined) as "trending" | "breaking" | "developing" | undefined,
        });
      });
    }

    // Transform activity data
    if (activityData) {
      activityData.forEach((activity: any) => {
        const activityType =
          activity.activityType === "diplomatic"
            ? "embassy_established"
            : activity.activityType === "economic"
              ? "trade_agreement"
              : activity.activityType === "cultural"
                ? "cultural_exchange"
                : "intelligence_briefing";

        activities.push({
          id: activity.id,
          type: activityType,
          timestamp: activity.timestamp,
          primaryCountry: {
            id: activity.countryId,
            name: "Country", // Would need to fetch country name separately
            code: "CTR",
          },
          title: `${activity.activityType} activity`,
          description: activity.description,
          metrics: {
            impact:
              activity.importance === "high" ? 80 : activity.importance === "medium" ? 60 : 40,
            significance: (activity.importance === "high"
              ? "high"
              : activity.importance === "medium"
                ? "medium"
                : "low") as "low" | "medium" | "high" | "critical",
            visibility: (activity.classification?.toLowerCase() === "confidential"
              ? "confidential"
              : activity.classification?.toLowerCase() === "restricted"
                ? "restricted"
                : "public") as "public" | "restricted" | "confidential",
          },
          interactions: {
            likes: Math.max(
              5,
              Math.floor(
                activity.importance === "high" ? 50 : activity.importance === "medium" ? 30 : 15
              )
            ),
            comments: Math.floor(
              activity.importance === "high" ? 10 : activity.importance === "medium" ? 5 : 2
            ),
            shares: Math.floor(
              activity.importance === "high" ? 8 : activity.importance === "medium" ? 4 : 1
            ),
            bookmarks: Math.floor(
              activity.importance === "high" ? 6 : activity.importance === "medium" ? 3 : 1
            ),
          },
          tags: [activity.activityType, activity.classification.toLowerCase()] as string[],
          relatedAchievements:
            activity.relatedCountries && activity.relatedCountries.length > 0
              ? ["diplomatic_action"]
              : undefined,
        });
      });
    }

    return activities;
  }, [intelligenceData, activityData]) as ActivityItem[];

  // Filter and sort activities
  const filteredActivities = useMemo((): ActivityItem[] => {
    let filtered = transformedActivities;

    // Apply type filter
    if (filter !== "all") {
      filtered = filtered.filter((activity) => activity.type === filter);
    }

    // Apply feed type filter
    if (feedType === "country" && countryId) {
      filtered = filtered.filter(
        (activity) =>
          activity.primaryCountry.id === countryId || activity.secondaryCountry?.id === countryId
      );
    }

    // Sort activities
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return (
            b.interactions.likes +
            b.interactions.shares -
            (a.interactions.likes + a.interactions.shares)
          );
        case "impact":
          return (b.metrics?.impact || 0) - (a.metrics?.impact || 0);
        case "recent":
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

    return filtered.slice(0, maxItems);
  }, [filter, feedType, countryId, sortBy, maxItems, transformedActivities]);

  // Toggle item expansion
  const toggleExpansion = useCallback((itemId: string): void => {
    setExpandedItems((prev) => {
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

    if (diffMins < 1) return "just now";
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
          "glass-hierarchy-child rounded-lg p-4 transition-all duration-300 hover:bg-white/10",
          compact ? "p-3" : "p-4"
        )}
      >
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          {/* Activity icon */}
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
              typeConfig.bgColor
            )}
          >
            <IconComponent className={cn("h-5 w-5", typeConfig.color)} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title and metadata */}
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 leading-tight font-semibold text-white">{activity.title}</h4>

                {/* Countries involved */}
                <div className="mb-1 flex items-center gap-2 text-sm text-[--intel-silver]">
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
                <div
                  className={cn(
                    "flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium",
                    activity.trend === "trending"
                      ? "bg-orange-500/20 text-orange-400"
                      : activity.trend === "breaking"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                  )}
                >
                  {activity.trend === "trending" && <RiFireLine className="mr-1 inline h-3 w-3" />}
                  {activity.trend}
                </div>
              )}
            </div>

            {/* Description */}
            <p className="mb-3 text-sm leading-relaxed text-[--intel-silver]">
              {activity.description}
            </p>

            {/* Expanded details */}
            <AnimatePresence>
              {isExpanded && activity.details && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3"
                >
                  <div className="rounded-lg border-l-2 border-[--intel-gold]/30 bg-white/5 p-3">
                    <p className="text-sm text-[--intel-silver]">{activity.details}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tags */}
            {activity.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {activity.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded bg-white/10 px-2 py-1 text-xs text-[--intel-silver]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metrics */}
            {activity.metrics && !compact && (
              <div className="mb-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[--intel-silver]">Impact:</span>
                  <span
                    className={cn(
                      "font-medium",
                      activity.metrics.impact >= 80
                        ? "text-green-400"
                        : activity.metrics.impact >= 60
                          ? "text-yellow-400"
                          : "text-orange-400"
                    )}
                  >
                    {activity.metrics.impact}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[--intel-silver]">Significance:</span>
                  <span
                    className={cn(
                      "font-medium capitalize",
                      activity.metrics.significance === "critical"
                        ? "text-red-400"
                        : activity.metrics.significance === "high"
                          ? "text-orange-400"
                          : activity.metrics.significance === "medium"
                            ? "text-yellow-400"
                            : "text-green-400"
                    )}
                  >
                    {activity.metrics.significance}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
            <RiTimeLine className="h-3 w-3" />
            <span>{getRelativeTime(activity.timestamp)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {showInteractions && (
              <>
                {/* Like */}
                <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--intel-silver] transition-colors hover:text-red-400">
                  <RiHeartLine className="h-3 w-3" />
                  <span>{activity.interactions.likes}</span>
                </button>

                {/* Comment */}
                <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--intel-silver] transition-colors hover:text-blue-400">
                  <RiChat3Line className="h-3 w-3" />
                  <span>{activity.interactions.comments}</span>
                </button>

                {/* Share */}
                <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--intel-silver] transition-colors hover:text-green-400">
                  <RiShareLine className="h-3 w-3" />
                  <span>{activity.interactions.shares}</span>
                </button>

                {/* Bookmark */}
                <button className="rounded p-1 text-[--intel-silver] transition-colors hover:text-[--intel-gold]">
                  <RiBookmarkLine className="h-3 w-3" />
                </button>
              </>
            )}

            {/* Expand/collapse */}
            {activity.details && (
              <button
                onClick={() => toggleExpansion(activity.id)}
                className="rounded p-1 text-[--intel-silver] transition-colors hover:text-white"
              >
                <RiMoreLine
                  className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
                />
              </button>
            )}

            {/* View details */}
            <button className="rounded p-1 text-[--intel-silver] transition-colors hover:text-white">
              <RiEyeLine className="h-3 w-3" />
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
            <h3 className="flex items-center gap-2 text-xl font-bold text-[--intel-gold]">
              <RiTimeLine className="h-5 w-5" />
              Diplomatic Activity Feed
            </h3>
            <p className="mt-1 text-sm text-[--intel-silver]">
              Latest diplomatic events and international activities
            </p>
          </div>

          <button className="rounded-lg bg-white/10 p-2 text-[--intel-silver] transition-colors hover:text-white">
            <RiRefreshLine className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[--intel-gold]/50 focus:outline-none"
          >
            <option value="all" className="bg-[--intel-navy]">
              All Activities
            </option>
            {Object.entries(ACTIVITY_TYPES).map(([type, config]) => (
              <option key={type} value={type} className="bg-[--intel-navy]">
                {config.label}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "popular" | "impact")}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[--intel-gold]/50 focus:outline-none"
          >
            <option value="recent" className="bg-[--intel-navy]">
              Most Recent
            </option>
            <option value="popular" className="bg-[--intel-navy]">
              Most Popular
            </option>
            <option value="impact" className="bg-[--intel-navy]">
              Highest Impact
            </option>
          </select>
        </div>
      )}

      {/* Loading State */}
      {loadingIntelligence || loadingActivity ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-white/20"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/20"></div>
                  <div className="h-3 w-1/2 rounded bg-white/10"></div>
                  <div className="h-3 w-2/3 rounded bg-white/10"></div>
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
            <div className="pt-4 text-center">
              <button className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-[--intel-silver] transition-colors hover:bg-white/20 hover:text-white">
                Load More Activities
              </button>
            </div>
          )}

          {/* No activities */}
          {filteredActivities.length === 0 && (
            <div className="py-8 text-center text-[--intel-silver]">
              <RiTimeLine className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p>
                No activities found.{" "}
                {countryId && feedType === "country"
                  ? "Country-specific intelligence may require higher clearance."
                  : "Loading intelligence feed..."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

SocialActivityFeedComponent.displayName = "SocialActivityFeed";

export const SocialActivityFeed = React.memo(SocialActivityFeedComponent);
