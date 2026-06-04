"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useUser } from "~/context/auth-context";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Activity, Clock } from "lucide-react";
import { cn } from "~/lib/utils";

import type { ActivityUserProfile } from "~/lib/activity-formatting";
import {
  buildActivityFeed,
  buildTrendingTopics,
  filterActivities,
  type ActivityTab,
  type ActivityFilterType,
} from "~/lib/activity-data-transformer";
import { useActivityFeedData } from "~/hooks/useActivityFeedData";
import { useActivityFlags } from "~/hooks/useActivityFlags";
import { useActivityEngagement } from "~/hooks/useActivityEngagement";
import { ActivityFeedHeader } from "~/components/activity/ActivityFeedHeader";
import { TrendingTopicsSection } from "~/components/activity/TrendingTopicsSection";
import { ActivityItem } from "~/components/activity/ActivityItem";

interface PlatformActivityFeedProps {
  userProfile?: ActivityUserProfile;
  className?: string;
}

/**
 * Platform activity feed. Thin orchestrator composing data/engagement/flag hooks
 * (`~/hooks/useActivity*`), pure transforms (`~/lib/activity-*`), and presentation
 * components (`~/components/activity/*`). Refactored from a 894-line monolith (audit C1).
 */
export function PlatformActivityFeed({ userProfile, className }: PlatformActivityFeedProps) {
  const { user } = useUser();

  // Filter / view state
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const [filterType] = useState<ActivityFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTrending, setShowTrending] = useState(false);

  // Data
  const {
    activitiesData,
    thinkpagesFeed,
    trendingData,
    userEngagement,
    activitiesLoading,
    trendingLoading,
    refetchActivities,
  } = useActivityFeedData({ activeTab, filterType, userId: user?.id });

  const flagUrls = useActivityFlags(activitiesData);

  const {
    showComments,
    newComment,
    setNewComment,
    comments,
    isEngagePending,
    isCommentPending,
    handleEngagement,
    handleComment,
    toggleComments,
  } = useActivityEngagement({ userId: user?.id, refetchActivities });

  // Derived view models
  const trendingTopics = useMemo(() => buildTrendingTopics(trendingData), [trendingData]);
  const activityFeed = useMemo(
    () => buildActivityFeed(activitiesData, thinkpagesFeed, flagUrls),
    [activitiesData, thinkpagesFeed, flagUrls]
  );
  const filteredActivities = useMemo(
    () => filterActivities(activityFeed, { activeTab, filterType, searchQuery }, userProfile),
    [activityFeed, activeTab, filterType, searchQuery, userProfile]
  );

  const currentUserInitials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

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
              <div key={i} className="glass-hierarchy-child flex gap-4 rounded-xl p-4">
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
    <Card className={cn("glass-hierarchy-parent w-full", className)}>
      <CardHeader>
        <ActivityFeedHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showTrending={showTrending}
          onToggleTrending={() => setShowTrending((prev) => !prev)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </CardHeader>

      <CardContent>
        <TrendingTopicsSection show={showTrending} topics={trendingTopics} />

        <div className="space-y-4">
          <AnimatePresence>
            {filteredActivities.map((activity, index) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                index={index}
                liked={!!userEngagement?.[activity.id]?.liked}
                shared={!!userEngagement?.[activity.id]?.shared}
                isAuthenticated={!!user?.id}
                isEngagePending={isEngagePending}
                isCommentPending={isCommentPending}
                showComments={!!showComments[activity.id]}
                commentDraft={newComment[activity.id] || ""}
                commentsList={comments[activity.id]}
                currentUserImageUrl={user?.imageUrl}
                currentUserInitials={currentUserInitials}
                onEngage={(action) => handleEngagement(activity.id, action)}
                onToggleComments={() => toggleComments(activity.id)}
                onCommentDraftChange={(value) =>
                  setNewComment((prev) => ({ ...prev, [activity.id]: value }))
                }
                onSubmitComment={() => handleComment(activity.id)}
              />
            ))}
          </AnimatePresence>

          {filteredActivities.length === 0 && (
            <div className="py-12 text-center">
              <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="text-foreground mb-2 text-lg font-medium">No Activity Found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Activity will appear here as it happens"}
              </p>
            </div>
          )}

          {filteredActivities.length > 0 && (
            <div className="pt-6 text-center">
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
