"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Activity,
  TrendingUp,
  Trophy,
  MessageSquare,
  Heart,
  Share2,
  Clock,
  Globe,
  Zap,
  ChevronDown,
  ExternalLink,
  Rss,
} from "lucide-react";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";

type ActivityFilter = "all" | "posts" | "economic" | "diplomatic" | "milestones" | "events";

interface CountryActivityPanelProps {
  countryId: string;
  countryName: string;
}

export function CountryActivityPanel({ countryId, countryName }: CountryActivityPanelProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [showMore, setShowMore] = useState(false);

  const { data: activityData, isLoading: activityLoading } =
    api.activities.getCountryActivity.useQuery({
      countryId,
      limit: showMore ? 50 : 20,
      timeRange,
    });

  const { data: milestones } = api.countries.getEconomicMilestones.useQuery({
    countryId,
    limit: 10,
  });

  const { data: liveEvents } = api.countries.getLiveEventsFeed.useQuery({
    countryId,
    limit: 15,
    hours: timeRange === "7d" ? 168 : timeRange === "30d" ? 720 : 2160,
  });

  const { data: thinkpagesFeed } = api.thinkpages.getFeed.useQuery({
    countryId,
    filter: "recent",
    limit: 15,
  });

  // Merge all sources into a unified feed
  const unifiedFeed = useMemo(() => {
    const items: Array<{
      id: string;
      type: "post" | "economic" | "diplomatic" | "achievement" | "social" | "event" | "milestone" | "meta";
      source: string;
      title: string;
      description: string;
      timestamp: Date;
      engagement?: { likes: number; comments: number; shares: number };
      metadata?: Record<string, any>;
    }> = [];

    // Activity feed entries (already merged activity + some thinkpages)
    if (activityData?.activities) {
      for (const activity of activityData.activities) {
        items.push({
          id: activity.id,
          type: activity.type as any,
          source: activity.source,
          title: activity.title,
          description: activity.description,
          timestamp: new Date(activity.timestamp),
          engagement: activity.engagement,
          metadata: activity.metadata,
        });
      }
    }

    // ThinkPages posts (deduplicate against activity feed)
    if (thinkpagesFeed?.posts) {
      const existingIds = new Set(items.map((i) => i.id));
      for (const post of thinkpagesFeed.posts) {
        if (existingIds.has(post.id)) continue;
        items.push({
          id: post.id,
          type: "post",
          source: "thinkpages",
          title: `@${post.account?.username ?? "unknown"} posted`,
          description: post.content ?? "",
          timestamp: new Date(post.createdAt),
          engagement: {
            likes: post.likeCount ?? 0,
            comments: post.replyCount ?? 0,
            shares: post.repostCount ?? 0,
          },
          metadata: {
            accountType: post.account?.accountType,
            verified: post.account?.verified,
            trending: post.trending,
          },
        });
      }
    }

    // Live events
    if (liveEvents && Array.isArray(liveEvents)) {
      const existingIds = new Set(items.map((i) => i.id));
      for (const event of liveEvents) {
        const eventId = `event-${event.id ?? event.title}`;
        if (existingIds.has(eventId)) continue;
        items.push({
          id: eventId,
          type: "event",
          source: "live-events",
          title: event.title ?? "Event",
          description: event.description ?? "",
          timestamp: new Date(event.timestamp ?? event.createdAt ?? Date.now()),
          metadata: { severity: event.severity, category: event.category },
        });
      }
    }

    // Milestones
    if (milestones && Array.isArray(milestones)) {
      const existingIds = new Set(items.map((i) => i.id));
      for (const milestone of milestones) {
        if (existingIds.has(milestone.id)) continue;
        items.push({
          id: milestone.id,
          type: "milestone",
          source: "milestones",
          title: milestone.title ?? "Milestone",
          description: milestone.description ?? "",
          timestamp: new Date(milestone.achievedAt ?? milestone.createdAt ?? Date.now()),
          metadata: { category: milestone.category, icon: milestone.icon },
        });
      }
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply filter
    if (filter === "all") return items;
    if (filter === "posts") return items.filter((i) => i.type === "post" || i.source === "thinkpages");
    if (filter === "economic") return items.filter((i) => i.type === "economic");
    if (filter === "diplomatic") return items.filter((i) => i.type === "diplomatic");
    if (filter === "milestones") return items.filter((i) => i.type === "milestone" || i.type === "achievement");
    if (filter === "events") return items.filter((i) => i.type === "event");
    return items;
  }, [activityData, thinkpagesFeed, liveEvents, milestones, filter]);

  const filterOptions: Array<{ value: ActivityFilter; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: "all", label: "All", icon: Activity },
    { value: "posts", label: "Posts", icon: Rss },
    { value: "economic", label: "Economic", icon: TrendingUp },
    { value: "diplomatic", label: "Diplomatic", icon: Globe },
    { value: "milestones", label: "Milestones", icon: Trophy },
    { value: "events", label: "Events", icon: Zap },
  ];

  const getItemIcon = (type: string, source: string) => {
    if (source === "thinkpages" || type === "post") return <Rss className="h-4 w-4 text-sky-500" />;
    switch (type) {
      case "achievement":
      case "milestone":
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "economic":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "diplomatic":
        return <Globe className="h-4 w-4 text-purple-500" />;
      case "social":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "event":
        return <Zap className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="text-muted-foreground h-4 w-4" />;
    }
  };

  const getItemDotColor = (type: string, source: string) => {
    if (source === "thinkpages" || type === "post") return "bg-sky-400";
    switch (type) {
      case "achievement":
      case "milestone":
        return "bg-yellow-400";
      case "economic":
        return "bg-emerald-400";
      case "diplomatic":
        return "bg-purple-400";
      case "social":
        return "bg-blue-400";
      case "event":
        return "bg-orange-400";
      default:
        return "bg-muted-foreground";
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "thinkpages":
        return <Badge variant="outline" className="text-xs">ThinkPages</Badge>;
      case "live-events":
        return <Badge variant="outline" className="border-orange-200 text-xs text-orange-600 dark:border-orange-800 dark:text-orange-400">Event</Badge>;
      case "milestones":
        return <Badge variant="outline" className="border-yellow-200 text-xs text-yellow-600 dark:border-yellow-800 dark:text-yellow-400">Milestone</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Main Feed */}
        <div className="space-y-4 lg:col-span-3">
          {/* Header */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity Feed
                  </CardTitle>
                  <CardDescription>
                    Posts, events, and milestones from {countryName.replace(/_/g, " ")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {(["7d", "30d", "90d"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={timeRange === range ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTimeRange(range)}
                      className="text-xs"
                    >
                      {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <Button
                      key={opt.value}
                      variant={filter === opt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(opt.value)}
                      className="text-xs"
                    >
                      <Icon className="mr-1.5 h-3 w-3" />
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Feed Items */}
          {activityLoading ? (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="space-y-4 pt-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex animate-pulse items-start gap-3">
                    <div className="bg-muted mt-2 h-2 w-2 flex-shrink-0 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : unifiedFeed.length > 0 ? (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="space-y-1 pt-6">
                {unifiedFeed.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 py-3 ${
                      idx < unifiedFeed.length - 1 ? "border-border/50 border-b" : ""
                    }`}
                  >
                    <div className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${getItemDotColor(item.type, item.source)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {getItemIcon(item.type, item.source)}
                          <p className="truncate text-sm font-medium">{item.title}</p>
                        </div>
                        {getSourceBadge(item.source)}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {item.description}
                      </p>
                      <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                        </div>
                        {item.engagement && (
                          <>
                            {item.engagement.likes > 0 && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {item.engagement.likes}
                              </span>
                            )}
                            {item.engagement.comments > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {item.engagement.comments}
                              </span>
                            )}
                            {item.engagement.shares > 0 && (
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {item.engagement.shares}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!showMore && unifiedFeed.length >= 15 && (
                  <div className="pt-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMore(true)}
                      className="text-xs"
                    >
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Load more activity
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="py-12 text-center">
                <Activity className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  No activity found for this time period.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Try expanding the time range or removing filters.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Total Items</span>
                <span className="text-sm font-semibold">{unifiedFeed.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Posts</span>
                <span className="text-sm font-semibold">
                  {unifiedFeed.filter((i) => i.type === "post" || i.source === "thinkpages").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Economic</span>
                <span className="text-sm font-semibold">
                  {unifiedFeed.filter((i) => i.type === "economic").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Diplomatic</span>
                <span className="text-sm font-semibold">
                  {unifiedFeed.filter((i) => i.type === "diplomatic").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Milestones</span>
                <span className="text-sm font-semibold">
                  {unifiedFeed.filter((i) => i.type === "milestone" || i.type === "achievement").length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Milestones Highlight */}
          {milestones && milestones.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Recent Milestones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {milestones.slice(0, 5).map((milestone: any) => (
                  <div
                    key={milestone.id}
                    className="flex items-start gap-2 rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-2 dark:border-yellow-900/30 dark:bg-yellow-900/10"
                  >
                    <Trophy className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{milestone.title}</p>
                      <p className="text-muted-foreground line-clamp-1 text-xs">
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Wiki Link */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <WikiLinkPreview title={countryName}>
                <a
                  href={`https://ixwiki.com/wiki/${countryName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex items-center gap-2 text-sm hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on IxWiki
                </a>
              </WikiLinkPreview>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
