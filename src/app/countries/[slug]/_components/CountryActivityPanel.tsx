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

type Icon = typeof Activity;

const isPost = (i: CountryActivityItem) => i.type === "social" || i.source === "thinkpages";

const FILTERS: {
  value: ActivityFilter;
  label: string;
  icon: Icon;
  test: (i: CountryActivityItem) => boolean;
}[] = [
  { value: "all", label: "All", icon: Activity, test: () => true },
  { value: "posts", label: "Posts", icon: Rss, test: isPost },
  { value: "economic", label: "Economic", icon: TrendingUp, test: (i) => i.type === "economic" },
  { value: "diplomatic", label: "Diplomatic", icon: Globe, test: (i) => i.type === "diplomatic" },
  { value: "social", label: "Social", icon: MessageSquare, test: isPost },
];

const TYPE_ICON: Record<string, Icon> = {
  achievement: Trophy,
  milestone: Trophy,
  economic: TrendingUp,
  diplomatic: Globe,
  social: MessageSquare,
  event: Zap,
};

const ENGAGEMENT_ICON = { likes: Heart, comments: MessageSquare, shares: Share2 } as const;

function ActivityRow({ item }: { item: CountryActivityItem }) {
  const Icon =
    item.source === "thinkpages" || item.type === "post" ? Rss : (TYPE_ICON[item.type] ?? Activity);
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon aria-hidden className="text-label-secondary size-4" />
            <p
              className="text-headline text-label truncate"
              dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.title) }}
            />
          </div>
          {item.source === "thinkpages" && <Badge variant="outline">ThinkPages</Badge>}
        </div>
        <p className="text-callout text-label-secondary mt-1 line-clamp-2">
          <span dangerouslySetInnerHTML={{ __html: renderWithEmojis(item.description) }} />
        </p>
        <div className="text-footnote text-label-secondary mt-2 flex items-center gap-3 tabular-nums">
          <span className="flex items-center gap-1">
            <Clock aria-hidden className="size-3" />
            {isValid(item.timestamp)
              ? formatDistanceToNow(item.timestamp, { addSuffix: true })
              : "recently"}
          </span>
          {Object.entries(ENGAGEMENT_ICON).map(([key, EngagementIcon]) => {
            const count = item.engagement?.[key as keyof typeof ENGAGEMENT_ICON] ?? 0;
            return (
              count > 0 && (
                <span key={key} className="flex items-center gap-1">
                  <EngagementIcon aria-hidden className="size-3" />
                  {count}
                </span>
              )
            );
          })}
        </div>
      </div>
    </li>
  );
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

    return items.filter(FILTERS.find((f) => f.value === filter)?.test ?? (() => true));
  }, [activityData, filter]);

  const summary = [
    { label: "Total items", value: feed.length },
    ...(["posts", "economic", "diplomatic"] as const).map((value) => {
      const { label, test } = FILTERS.find((f) => f.value === value)!;
      return { label, value: feed.filter(test).length };
    }),
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
              options={FILTERS.map(({ value, label, icon: Icon }) => ({
                value,
                label,
                icon: <Icon aria-hidden />,
              }))}
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
                  <ActivityRow key={item.id} item={item} />
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
