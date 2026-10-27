import type { CountryActivityItem } from "~/app/countries/[slug]/_types";
import type { ChronicleEntry } from "~/app/countries/[slug]/_utils/profileLayer";

/** History's filter chips: All, the chronicle (Record), and the feed's own types. */
export type TimelineFilter = "all" | "record" | "posts" | "economic" | "diplomatic" | "social";

interface TimelineItem {
  id: string;
  /** In-game fractional year, the timeline's one calendar. */
  at: number;
  /** The chips (besides All) the item shows under. */
  tags: readonly TimelineFilter[];
  chronicle?: ChronicleEntry;
  activity?: CountryActivityItem;
}

const isPost = (i: CountryActivityItem) => i.type === "social" || i.source === "thinkpages";

function activityTags(item: CountryActivityItem): TimelineFilter[] {
  if (isPost(item)) return ["posts", "social"];
  if (item.type === "economic" || item.type === "diplomatic") return [item.type];
  return [];
}

/**
 * The chronicle (all time, in-game dates) and the activity feed (real timestamps, converted by
 * `toYear`) as one timeline, newest first; on the same date a feed item comes first, then ids.
 */
export function mergeTimeline(
  chronicle: readonly ChronicleEntry[],
  activity: readonly CountryActivityItem[],
  toYear: (ms: number) => number
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...chronicle.map((entry) => ({
      id: entry.id,
      at: entry.year,
      tags:
        entry.kind === "diplomacy" ? (["record", "diplomatic"] as const) : (["record"] as const),
      chronicle: entry,
    })),
    ...activity.map((item) => ({
      id: item.id,
      at: toYear(item.timestamp.getTime()),
      tags: activityTags(item),
      activity: item,
    })),
  ];
  return items.sort(
    (a, b) =>
      b.at - a.at ||
      Number(Boolean(b.activity)) - Number(Boolean(a.activity)) ||
      a.id.localeCompare(b.id)
  );
}

export function filterTimeline(
  items: readonly TimelineItem[],
  filter: TimelineFilter
): TimelineItem[] {
  return filter === "all" ? [...items] : items.filter((i) => i.tags.includes(filter));
}
