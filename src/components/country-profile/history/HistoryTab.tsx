"use client";

import { useMemo, useState } from "react";
import { isValid } from "date-fns";
import {
  Activity,
  ChatBubble as MessageSquare,
  Clock,
  Globe,
  RssFeed as Rss,
  StatUp as TrendingUp,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { DiscussionCountsProvider } from "~/components/action-links/DiscussionCountsProvider";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { ActivityTimeRange, CountryActivityItem } from "~/app/countries/[slug]/_types";
import { ixTimeToYear } from "~/app/countries/[slug]/_utils/profileLayer";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";
import { filterTimeline, mergeTimeline, type TimelineFilter } from "./merge-timeline";
import { ActivityRow, ChronicleRow } from "./TimelineRows";

const FILTERS: { value: TimelineFilter; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All", icon: Activity },
  { value: "record", label: "Record", icon: Clock },
  { value: "posts", label: "Posts", icon: Rss },
  { value: "economic", label: "Economic", icon: TrendingUp },
  { value: "diplomatic", label: "Diplomatic", icon: Globe },
  { value: "social", label: "Social", icon: MessageSquare },
];

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const;

/** Items shown before Show more. */
const PREVIEW = 25;
/** The feed's first page; a full page means there may be more to fetch. */
const FEED_PAGE = 20;

/** A real timestamp's place on the in-game calendar (fractional year). */
const toYear = (ms: number) => ixTimeToYear(IxTime.convertToIxTime(ms));

function safeDate(value: string | number | Date | null | undefined): Date {
  const d = value instanceof Date ? value : new Date(value ?? Date.now());
  return isValid(d) ? d : new Date();
}

/**
 * HistoryTab — the country's history as one timeline, newest first: the chronicle (founding
 * dates, map stories, directives, decisions, diplomacy, on the in-game calendar) merged with the
 * activity feed. Record shows the chronicle alone; the range control narrows the feed only, so
 * the chronicle's all-time record stays.
 */
export function HistoryTab({ layer }: { layer: CountryProfileLayer }) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("30d");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = api.activities.getCountryActivity.useQuery({
    countryId: layer.countryId,
    limit: expanded ? 50 : FEED_PAGE,
    timeRange,
  });

  const items = useMemo(() => {
    const feed: CountryActivityItem[] = (data?.activities ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      source: a.source,
      title: a.title,
      description: a.description,
      timestamp: safeDate(a.timestamp),
      engagement: a.engagement,
    }));
    return filterTimeline(mergeTimeline(layer.chronicle, feed, toYear), filter);
  }, [data, layer.chronicle, filter]);

  const shown = expanded ? items : items.slice(0, PREVIEW);
  const feedMayHaveMore = (data?.activities.length ?? 0) >= FEED_PAGE;
  const activityIds = shown.flatMap((i) => (i.activity?.source === "activity" ? [i.id] : []));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="History type"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={FILTERS.map(({ value, label, icon: Icon }) => ({
            value,
            label,
            icon: <Icon aria-hidden />,
          }))}
        />
        <SegmentedControl
          aria-label="Feed range"
          size="sm"
          value={timeRange}
          onValueChange={setTimeRange}
          options={RANGES}
        />
      </div>
      {isLoading && items.length === 0 ? (
        <div className="space-y-3" role="status" aria-label="Loading history">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Clock />}
          title="Nothing in this period"
          message="Try a longer range or another type."
        />
      ) : (
        <DiscussionCountsProvider activityIds={activityIds}>
          <ol className="flex flex-col">
            {shown.map((i) =>
              i.chronicle ? (
                <ChronicleRow key={i.id} entry={i.chronicle} />
              ) : i.activity ? (
                <ActivityRow key={i.id} item={i.activity} />
              ) : null
            )}
          </ol>
        </DiscussionCountsProvider>
      )}
      {!expanded && (items.length > PREVIEW || feedMayHaveMore) && (
        <Button variant="ghost" size="sm" className="self-center" onClick={() => setExpanded(true)}>
          Show more
        </Button>
      )}
    </div>
  );
}
