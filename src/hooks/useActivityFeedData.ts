"use client";

import { api } from "~/trpc/react";
import type { ActivityTab, ActivityFilterType } from "~/lib/activity-data-transformer";

/**
 * Fetches the live data backing the platform activity feed: the global activity
 * feed, ThinkPages posts, trending topics, and the current user's per-activity
 * engagement state. Extracted from PlatformActivityFeed.tsx (audit C1).
 *
 * Note (audit F8): `getUserEngagement` necessarily depends on the activity IDs
 * returned by `getGlobalFeed`, so it runs after the feed resolves. It is gated by
 * `enabled` and never blocks the initial render, so the dependency is harmless.
 */
export function useActivityFeedData(params: {
  activeTab: ActivityTab;
  filterType: ActivityFilterType;
  userId?: string;
}) {
  const { activeTab, filterType, userId } = params;

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = api.activities.getGlobalFeed.useQuery({
    limit: 20,
    filter: activeTab === "achievements" ? "achievements" : "all",
    category: filterType,
  });

  const { data: thinkpagesFeed } = api.thinkpages.getFeed.useQuery({
    filter: "recent",
    limit: 10,
  });

  const { data: trendingData, isLoading: trendingLoading } =
    api.activities.getTrendingTopics.useQuery({
      limit: 6,
      timeRange: "24h",
    });

  const activityIds = activitiesData?.activities?.map((a: { id: string }) => a.id) || [];
  const { data: userEngagement } = api.activities.getUserEngagement.useQuery(
    {
      activityIds,
      userId: userId || "placeholder-disabled",
    },
    {
      enabled: !!userId && activityIds.length > 0,
      refetchOnWindowFocus: false,
    }
  );

  return {
    activitiesData,
    thinkpagesFeed,
    trendingData,
    userEngagement,
    activitiesLoading,
    trendingLoading,
    refetchActivities,
  };
}
