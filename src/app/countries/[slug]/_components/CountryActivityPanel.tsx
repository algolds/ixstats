"use client";

import React, { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  Activity,
  StatUp as TrendingUp,
  Trophy,
  ChatBubble as MessageSquare,
  Heart,
  ShareAndroid as Share2,
  Clock,
  Globe,
  Flash as Zap,
  NavArrowDown as ChevronDown,
  RssFeed as Rss,
  OpenBook as BookOpen,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { formatDistanceToNow, isValid } from "date-fns";
import { WikiLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { escapeHtml, sanitizeUserContent } from "~/lib/utils";
import type { ActivityFilter, ActivityTimeRange, CountryActivityItem } from "../_types";
import { Card } from "~/components/ui/card";

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
    if (source === "thinkpages" || type === "post")
      return <Rss aria-hidden className="text-label-secondary size-4" />;
    switch (type) {
      case "achievement":
      case "milestone":
        return <Trophy aria-hidden className="text-label-secondary size-4" />;
      case "economic":
        return <TrendingUp aria-hidden className="text-label-secondary size-4" />;
      case "diplomatic":
        return <Globe aria-hidden className="text-label-secondary size-4" />;
      case "social":
        return <MessageSquare aria-hidden className="text-label-secondary size-4" />;
      case "event":
        return <Zap aria-hidden className="text-label-secondary size-4" />;
      default:
        return <Activity aria-hidden className="text-label-secondary size-4" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "thinkpages":
        return <Badge variant="outline">ThinkPages</Badge>;
      default:
        return null;
    }
  };

  const summary = [
    { label: "Total items", value: feed.length },
    {
      label: "Posts",
      value: feed.filter((i) => i.type === "social" || i.source === "thinkpages").length,
    },
    { label: "Economic", value: feed.filter((i) => i.type === "economic").length },
    { label: "Diplomatic", value: feed.filter((i) => i.type === "diplomatic").length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Main feed */}
        <div className="space-y-4 lg:col-span-3">
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-title-3 text-label">Activity feed</h2>
              </div>
              <SegmentedControl
                aria-label="Time range"
                size="sm"
                value={timeRange}
                onValueChange={setTimeRange}
                options={[
                  { value: "7d", label: "7 days" },
                  { value: "30d", label: "30 days" },
                  { value: "90d", label: "90 days" },
                ]}
              />
            </div>
            <SegmentedControl
              aria-label="Activity type"
              size="sm"
              value={filter}
              onValueChange={setFilter}
              options={filterOptions.map((opt) => {
                const Icon = opt.icon;
                return { value: opt.value, label: opt.label, icon: <Icon aria-hidden /> };
              })}
            />
          </Card>

          {isLoading ? (
            <Card padding="md" className="space-y-4" role="status" aria-label="Loading activity">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </Card>
          ) : feed.length > 0 ? (
            <Card padding="md">
              <ul className="divide-separator divide-y">
                {feed.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {getItemIcon(item.type, item.source)}
                          <p
                            className="text-headline text-label truncate"
                            dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.title) }}
                          />
                        </div>
                        {getSourceBadge(item.source)}
                      </div>
                      <p className="text-callout text-label-secondary mt-1 line-clamp-2">
                        <span
                          dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.description) }}
                        />
                      </p>
                      <div className="text-footnote text-label-secondary mt-2 flex items-center gap-3 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Clock aria-hidden className="size-3" />
                          {isValid(item.timestamp)
                            ? formatDistanceToNow(item.timestamp, { addSuffix: true })
                            : "recently"}
                        </span>
                        {item.engagement && (
                          <>
                            {(item.engagement.likes ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Heart aria-hidden className="size-3" />
                                {item.engagement.likes}
                              </span>
                            )}
                            {(item.engagement.comments ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare aria-hidden className="size-3" />
                                {item.engagement.comments}
                              </span>
                            )}
                            {item.engagement.shares && item.engagement.shares > 0 && (
                              <span className="flex items-center gap-1">
                                <Share2 aria-hidden className="size-3" />
                                {item.engagement.shares}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {!showMore && feed.length >= 15 && (
                <div className="pt-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowMore(true)}>
                    <ChevronDown aria-hidden />
                    Load more activity
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={<Activity />}
                title="No activity in this period"
                message="Try a longer time range or a different type."
              />
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <FacetList>
            <FacetListSection header="Activity summary">
              {summary.map((row) => (
                <FacetRow key={row.label} title={row.label} trailing={row.value} />
              ))}
            </FacetListSection>
            <FacetListSection>
              <WikiLinkPreview title={countryName}>
                <FacetRow
                  href={`/wiki/${encodeURIComponent(countryName.replace(/ /g, "_"))}`}
                  leading={<BookOpen className="size-4" />}
                  title="View on IxWiki"
                />
              </WikiLinkPreview>
            </FacetListSection>
          </FacetList>
        </div>
      </div>
    </div>
  );
}
