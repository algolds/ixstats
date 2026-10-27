/**
 * What a non-wiki Trending row is and where it goes. Wiki rows preview the article; the rest (ThinkPages posts,
 * forum threads, nation activity, crises) explain themselves with where they trend from, why they rank and when
 * they last moved, and every row with somewhere to go links there.
 */

export interface TrendingContextItem {
  source: string;
  url?: string;
  author?: string;
  timestamp: string;
  engagement?: { views?: number; replies?: number; likes?: number; reposts?: number };
}

export interface TrendingContext {
  /** Where the topic trends from, in one line. */
  origin: string;
  /** Why it ranks: the signals the trending score reads for this source. */
  signals: string[];
  /** Where clicking the row goes, or null when there is nowhere better than the row itself. */
  href: string | null;
  /** The call to action for `href`. */
  action: string | null;
}

const ORIGIN: Record<string, string> = {
  thinkpages: "A ThinkPages post climbing on reactions, replies, reposts and views",
  forum: "A forum thread drawing replies",
  ixstats: "Nation activity from the live IxStates feed",
  crisis: "An active international crisis awaiting a response",
};

const ACTION: Record<string, string> = {
  thinkpages: "Open post",
  forum: "Open thread",
  ixstats: "Open activity feed",
};

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function trendingContext(item: TrendingContextItem): TrendingContext {
  const e = item.engagement ?? {};
  const signals: string[] = [];
  if (item.source === "crisis") {
    if (e.views) signals.push(count(e.views, "casualty", "casualties"));
  } else {
    if (e.likes) signals.push(count(e.likes, "like"));
    if (e.replies) signals.push(count(e.replies, "reply", "replies"));
    if (e.reposts) signals.push(count(e.reposts, "repost"));
    if (e.views) signals.push(count(e.views, "view"));
  }

  // Nation activity has no page of its own; the activity feed is where it lives.
  const href = item.url ?? (item.source === "ixstats" ? "/feed" : null);
  return {
    origin: ORIGIN[item.source] ?? "Live activity across IxStates",
    signals,
    href,
    action: href ? (ACTION[item.source] ?? "Open") : null,
  };
}
