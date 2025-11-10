"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, Zap, RefreshCw, Filter } from "lucide-react";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { ActivityFilters } from "./ActivityFilters";
import { TrendingTopics } from "./TrendingTopics";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

type ActivityFilter = "all" | "achievements" | "diplomatic" | "economic" | "social" | "meta";
type ActivityCategory = "all" | "game" | "platform" | "social";

export function ActivityFeedContainer() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [category, setCategory] = useState<ActivityCategory>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch global activity feed
  const {
    data: feedData,
    isLoading,
    refetch,
    isFetching,
  } = api.activities.getGlobalFeed.useQuery(
    {
      limit: 20,
      filter,
      category,
    },
    {
      refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    }
  );

  // Fetch activity stats
  const { data: stats } = api.activities.getActivityStats.useQuery({
    timeRange: "24h",
  });

  // Type-cast activities to ensure type safety
  const activities = (feedData?.activities || []).map(activity => ({
    ...activity,
    type: activity.type as "achievement" | "diplomatic" | "economic" | "social" | "meta"
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Activity Feed</h1>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Real-time platform activity and updates
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="hidden sm:flex"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-xs">Total Activities</div>
              <div className="text-foreground text-2xl font-bold">{stats.totalActivities}</div>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-xs">Likes</div>
              <div className="text-foreground text-2xl font-bold">{stats.totalLikes}</div>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-xs">Comments</div>
              <div className="text-foreground text-2xl font-bold">{stats.totalComments}</div>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-xs">Shares</div>
              <div className="text-foreground text-2xl font-bold">{stats.totalShares}</div>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-xs">Views</div>
              <div className="text-foreground text-2xl font-bold">
                {(stats.totalViews / 1000).toFixed(1)}k
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Feed */}
        <div className="lg:col-span-2">
          {/* Mobile Filter Button */}
          <div className="mb-4 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <ActivityFilters
                filter={filter}
                category={category}
                onFilterChange={setFilter}
                onCategoryChange={setCategory}
                autoRefresh={autoRefresh}
                onAutoRefreshChange={setAutoRefresh}
              />
            </motion.div>
          )}

          {/* Activity List */}
          <div className="space-y-4">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-hierarchy-child animate-pulse rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              // Empty state
              <div className="glass-hierarchy-child rounded-lg p-12 text-center">
                <Activity className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="text-foreground mb-2 text-xl font-semibold">No activities yet</h3>
                <p className="text-muted-foreground">
                  Check back soon for updates from the IxStats community
                </p>
              </div>
            ) : (
              // Activity items
              activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ActivityFeedItem activity={activity} />
                </motion.div>
              ))
            )}
          </div>

          {/* Load More */}
          {feedData?.nextCursor && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => refetch()}>
                Load More
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TrendingTopics />

          {/* Auto-Refresh Toggle */}
          <div className="glass-hierarchy-child rounded-lg p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground text-sm font-medium">Auto-Refresh</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              Automatically refresh every 30 seconds
            </p>
          </div>

          {/* Quick Stats */}
          <div className="glass-hierarchy-child rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-foreground font-semibold">Platform Pulse</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Active Users</span>
                <span className="text-foreground text-sm font-medium">
                  {activities.length > 0 ? `${activities.length * 3}+` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Recent Posts</span>
                <span className="text-foreground text-sm font-medium">{activities.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Engagement Rate</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  <TrendingUp className="inline h-3 w-3" /> High
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
