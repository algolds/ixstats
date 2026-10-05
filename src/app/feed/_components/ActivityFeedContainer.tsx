"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { motion } from "motion/react";
import {
  Activity,
  StatUp as TrendingUp,
  Flash as Zap,
  Refresh as RefreshCw,
  Filter,
} from "iconoir-react";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { ActivityFilters } from "./ActivityFilters";
import { TrendingTopics } from "./TrendingTopics";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { EmptyState } from "~/components/ui/empty-state";
import { Switch } from "~/components/ui/switch";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";

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
  const activities = (feedData?.activities || []).map((activity) => ({
    ...activity,
    type: activity.type as "achievement" | "diplomatic" | "economic" | "social" | "meta",
  }));

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Activity feed"
        bleed
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="hidden sm:flex"
            >
              <Filter aria-hidden />
              Filters
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh feed"
              title="Refresh feed"
            >
              <RefreshCw aria-hidden className={isFetching ? "animate-spin" : ""} />
            </Button>
          </>
        }
      />
      <div className="mb-6 sm:mb-8">
        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {[
              ["Total activities", stats.totalActivities],
              ["Likes", stats.totalLikes],
              ["Comments", stats.totalComments],
              ["Shares", stats.totalShares],
              ["Views", `${(stats.totalViews / 1000).toFixed(1)}k`],
            ].map(([label, value], i) => (
              <Card
                key={String(label)}
                padding="sm"
                className={i === 4 ? "col-span-2 sm:col-span-1" : undefined}
              >
                <Stat label={String(label)} value={value} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Main Feed */}
        <div className="min-w-0 lg:col-span-2">
          {/* Mobile Filter Button */}
          <div className="mb-4 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full"
            >
              <Filter aria-hidden />
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
                <div
                  key={i}
                  className="bg-surface border-separator rounded-card shadow-card border p-6"
                >
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
              <Card>
                <EmptyState
                  icon={<Activity />}
                  title="No activities yet"
                  message="No one has posted or updated anything yet."
                />
              </Card>
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
                Load more
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <TrendingTopics />

          {/* Auto-Refresh Toggle */}
          <Card padding="md">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="feed-auto-refresh" className="text-headline text-label">
                Auto-Refresh
              </label>
              <Switch
                id="feed-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
            <p className="text-label-secondary text-footnote">
              Automatically refresh every 30 seconds
            </p>
          </Card>

          {/* Quick Stats */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <Zap aria-hidden className="text-tint h-5 w-5" />
              <h3 className="text-headline text-label">Platform pulse</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-label-secondary text-body">Active users</span>
                <span className="text-label text-body font-medium">
                  {activities.length > 0 ? `${activities.length * 3}+` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label-secondary text-body">Recent posts</span>
                <span className="text-label text-body font-medium">{activities.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-label-secondary text-body">Engagement rate</span>
                <span className="text-body text-green font-medium">
                  <TrendingUp className="inline h-3 w-3" /> High
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
