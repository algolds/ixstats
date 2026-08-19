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
  Rss,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { formatDistanceToNow, isValid } from "date-fns";
import { WikiLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { escapeHtml, sanitizeUserContent } from "~/lib/utils";
import type { ActivityFilter, ActivityTimeRange, CountryActivityItem } from "../_types";

/**
 * Render text that may contain Discord custom emoji markup.
 * Extracts Discord emoji patterns as placeholders BEFORE HTML escaping,
 * converts them to <img> tags, then restores after sanitization.
 */
function renderWithEmojis(text: string): string {
  if (!text) return "";
  const emojis: { placeholder: string; imgTag: string }[] = [];
  let idx = 0;
  const withPlaceholders = text.replace(
    /<(a)?:([a-zA-Z0-9_]+):(\d{17,20})>/g,
    (_match: string, animated: string, name: string, id: string) => {
      const ext = animated ? "gif" : "png";
      const imgTag = `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" class="inline-block h-5 w-5 align-text-bottom" loading="lazy" />`;
      const placeholder = `\u0000EMOJI${idx++}\u0000`;
      emojis.push({ placeholder, imgTag });
      return placeholder;
    }
  );
  let result = escapeHtml(withPlaceholders);
  for (const { placeholder, imgTag } of emojis) {
    result = result.replace(placeholder, imgTag);
  }
  return sanitizeUserContent(result);
}

/** Safely parse a value into a valid Date, falling back to now. */
function safeDate(value: unknown): Date {
  if (value instanceof Date && isValid(value)) return value;
  if (value == null) return new Date();
  const d = new Date(value as string | number);
  return isValid(d) ? d : new Date();
}

interface CountryActivityPanelProps {
  countryId: string;
  countryName: string;
}

interface FilterOption {
  value: ActivityFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function CountryActivityPanel({ countryId, countryName }: CountryActivityPanelProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("30d");
  const [showMore, setShowMore] = useState(false);

  // Single backend query — same endpoint used by the dashboard feed.
  const { data: activityData, isLoading } = api.activities.getCountryActivity.useQuery({
    countryId,
    limit: showMore ? 50 : 20,
    timeRange,
  });

  // Normalize and filter the backend response
  const feed: CountryActivityItem[] = useMemo(() => {
    if (!activityData?.activities) return [];

    const items: CountryActivityItem[] = activityData.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      source: activity.source,
      title: activity.title,
      description: activity.description,
      timestamp: safeDate(activity.timestamp),
      engagement: activity.engagement,
      metadata: activity.metadata as Record<string, unknown> | null,
    }));

    if (filter === "all") return items;
    if (filter === "posts")
      return items.filter((i) => i.type === "social" || i.source === "thinkpages");
    if (filter === "economic") return items.filter((i) => i.type === "economic");
    if (filter === "diplomatic") return items.filter((i) => i.type === "diplomatic");
    if (filter === "social")
      return items.filter((i) => i.type === "social" || i.source === "thinkpages");
    return items;
  }, [activityData, filter]);

  const filterOptions: FilterOption[] = [
    { value: "all", label: "All", icon: Activity },
    { value: "posts", label: "Posts", icon: Rss },
    { value: "economic", label: "Economic", icon: TrendingUp },
    { value: "diplomatic", label: "Diplomatic", icon: Globe },
    { value: "social", label: "Social", icon: MessageSquare },
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
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            ThinkPages
          </Badge>
        );
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
          <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                    <Activity className="text-primary h-5 w-5" />
                    Activity Feed
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Posts, events, and milestones from {countryName.replace(/_/g, " ")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["7d", "30d", "90d"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={timeRange === range ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTimeRange(range)}
                      className="h-7 px-2.5 text-xs font-semibold transition-transform duration-100 active:scale-95"
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
                      className="h-7 px-3 text-xs font-semibold transition-transform duration-100 active:scale-95"
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
          {isLoading ? (
            <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl">
              <CardContent className="space-y-4 pt-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex animate-pulse items-start gap-3">
                    <div className="bg-muted mt-2 h-2 w-2 shrink-0 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : feed.length > 0 ? (
            <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl">
              <CardContent className="space-y-1 pt-6">
                {feed.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-white/[0.03] ${
                      idx < feed.length - 1 ? "border-border/40 border-b" : ""
                    }`}
                  >
                    <div
                      className={`mt-2 h-2 w-2 shrink-0 rounded-full ${getItemDotColor(item.type, item.source)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {getItemIcon(item.type, item.source)}
                          <p
                            className="truncate text-sm font-semibold"
                            dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.title) }}
                          />
                        </div>
                        {getSourceBadge(item.source)}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        <span
                          dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.description) }}
                        />
                      </p>
                      <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isValid(item.timestamp)
                            ? formatDistanceToNow(item.timestamp, { addSuffix: true })
                            : "recently"}
                        </div>
                        {item.engagement && (
                          <>
                            {(item.engagement.likes ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3 text-rose-500" />
                                {item.engagement.likes}
                              </span>
                            )}
                            {(item.engagement.comments ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3 text-sky-500" />
                                {item.engagement.comments}
                              </span>
                            )}
                            {item.engagement.shares && item.engagement.shares > 0 && (
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3 text-emerald-500" />
                                {item.engagement.shares}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!showMore && feed.length >= 15 && (
                  <div className="pt-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMore(true)}
                      className="text-xs font-semibold transition-transform duration-100 active:scale-95"
                    >
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Load more activity
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl">
              <CardContent className="py-12 text-center">
                <Activity className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                <p className="text-muted-foreground text-sm font-semibold">
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
          <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-extrabold tracking-wider uppercase">
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Total Items</span>
                <span className="text-sm font-extrabold">{feed.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Posts</span>
                <span className="text-sm font-bold">
                  {feed.filter((i) => i.type === "social" || i.source === "thinkpages").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Economic</span>
                <span className="text-sm font-bold">
                  {feed.filter((i) => i.type === "economic").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Diplomatic</span>
                <span className="text-sm font-bold">
                  {feed.filter((i) => i.type === "diplomatic").length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Wiki Link */}
          <Card className="bg-card/40 border-white/10 saturate-180 backdrop-blur-xl transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]">
            <CardContent className="pt-6">
              <WikiLinkPreview title={countryName}>
                <Link
                  href={`/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}`}
                  className="text-primary flex items-center gap-2 text-sm font-bold hover:underline"
                >
                  <BookOpen className="h-4 w-4" />
                  View on IxWiki
                </Link>
              </WikiLinkPreview>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
