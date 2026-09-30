/**
 * ThinkPages trending: pure scoring used by the `thinkpages-trending` cron job
 * (./trending-cron.ts) and by the readers of its output.
 *
 * A post's score is the sum of its engagement events inside the window, each weighted by kind
 * and halved every `halfLifeHours`. Only engagement from *other* users counts: reactions,
 * replies and reposts made by any persona owned by the post author's Clerk user are ignored,
 * and each user counts at most once per kind per post (so one person cannot reply a post into
 * trending).
 */

export const TRENDING_CONFIG = {
  /** Engagement older than this is ignored. */
  windowHours: 72,
  /** An event's weight halves every this many hours. */
  halfLifeHours: 12,
  weights: { reaction: 1, reply: 2, repost: 3 },
  /** Posts flagged `trending`. */
  maxPosts: 25,
  /** A post needs at least this score to trend (≈ three fresh reactions from other users). */
  minPostScore: 3,
  /** Hashtags kept active in `TrendingTopic`. */
  maxTopics: 10,
  /** A hashtag needs this many posts in the window... */
  minTopicPosts: 2,
  /** ...by at least this many different users to trend. */
  minTopicAuthors: 2,
  /** A topic whose rank reached a new high this recently reads as rising. */
  risingHours: 6,
} as const;

export type EngagementKind = keyof typeof TRENDING_CONFIG.weights;

export interface EngagementEvent {
  /** The post that received the engagement. */
  postId: string;
  kind: EngagementKind;
  at: Date;
  /** Clerk user id owning the persona that engaged (falls back to the persona id). */
  actorId: string;
}

export interface PostEngagement {
  /** Decayed, weighted score. */
  score: number;
  /** Undecayed weighted engagement count (reactions + 2·replies + 3·reposts). */
  weighted: number;
}

const HOUR_MS = 60 * 60 * 1000;

export function decayFactor(ageHours: number, halfLifeHours = TRENDING_CONFIG.halfLifeHours) {
  return Math.pow(0.5, Math.max(0, ageHours) / halfLifeHours);
}

/**
 * Score every post that received engagement. `authorOf` maps a post id to its author's Clerk
 * user id; events whose actor is the author are dropped.
 */
export function scoreEngagement(
  events: EngagementEvent[],
  authorOf: Map<string, string>,
  now: Date,
  config: typeof TRENDING_CONFIG = TRENDING_CONFIG
): Map<string, PostEngagement> {
  const since = now.getTime() - config.windowHours * HOUR_MS;
  // One event per (post, kind, actor): keep the most recent.
  const latest = new Map<string, EngagementEvent>();
  for (const event of events) {
    const at = event.at.getTime();
    if (Number.isNaN(at) || at < since || at > now.getTime()) continue;
    if (authorOf.get(event.postId) === event.actorId) continue;
    const key = `${event.postId}\u0000${event.kind}\u0000${event.actorId}`;
    const previous = latest.get(key);
    if (!previous || previous.at.getTime() < at) latest.set(key, event);
  }

  const scores = new Map<string, PostEngagement>();
  for (const event of latest.values()) {
    const weight = config.weights[event.kind];
    const ageHours = (now.getTime() - event.at.getTime()) / HOUR_MS;
    const entry = scores.get(event.postId) ?? { score: 0, weighted: 0 };
    entry.score += weight * decayFactor(ageHours, config.halfLifeHours);
    entry.weighted += weight;
    scores.set(event.postId, entry);
  }
  return scores;
}

export interface TrendingCandidate {
  id: string;
  visibility: string;
  postType: string;
  content: string;
  parentPostId: string | null;
}

/** Public, top-level posts can trend; replies and plain (content-less) reposts cannot. */
export function isTrendingEligible(post: TrendingCandidate): boolean {
  if (post.visibility !== "public") return false;
  if (post.parentPostId) return false;
  if (post.postType === "repost" && !post.content.trim()) return false;
  return true;
}

/** Ids of the posts to flag `trending`, best first. */
export function selectTrendingPosts(
  candidates: TrendingCandidate[],
  scores: Map<string, PostEngagement>,
  config: typeof TRENDING_CONFIG = TRENDING_CONFIG
): string[] {
  return candidates
    .filter(isTrendingEligible)
    .map((post) => ({ id: post.id, score: scores.get(post.id)?.score ?? 0 }))
    .filter((entry) => entry.score >= config.minPostScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, config.maxPosts)
    .map((entry) => entry.id);
}

/** Hashtags stored on a post (JSON array), without `#`, skipping ThinkTank `group:` tags. */
export function parseHashtags(stored: string | null | undefined): string[] {
  if (!stored) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const tags = parsed
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag.length > 0 && !tag.startsWith("group:"));
  return [...new Set(tags)];
}

export interface TopicSourcePost {
  id: string;
  hashtags: string | null;
  authorId: string;
}

export interface ComputedTopic {
  /** Display spelling (most used), also the `/hashtags/<tag>` path segment. */
  hashtag: string;
  postCount: number;
  authorCount: number;
  engagement: number;
}

/** Rank used both to pick the active topics and to order them for readers. */
export function topicRank(topic: { postCount: number; engagement: number }): number {
  return topic.postCount + topic.engagement;
}

/**
 * Trending hashtags from the posts created in the window. Tags are grouped case-insensitively;
 * `engagement` is the undecayed weighted engagement those posts received.
 */
export function computeTrendingTopics(
  posts: TopicSourcePost[],
  scores: Map<string, PostEngagement>,
  config: typeof TRENDING_CONFIG = TRENDING_CONFIG
): ComputedTopic[] {
  const groups = new Map<
    string,
    { spellings: Map<string, number>; posts: Set<string>; authors: Set<string>; engagement: number }
  >();
  for (const post of posts) {
    for (const tag of parseHashtags(post.hashtags)) {
      const key = tag.toLowerCase();
      const group = groups.get(key) ?? {
        spellings: new Map<string, number>(),
        posts: new Set<string>(),
        authors: new Set<string>(),
        engagement: 0,
      };
      if (group.posts.has(post.id)) continue;
      group.spellings.set(tag, (group.spellings.get(tag) ?? 0) + 1);
      group.posts.add(post.id);
      group.authors.add(post.authorId);
      group.engagement += scores.get(post.id)?.weighted ?? 0;
      groups.set(key, group);
    }
  }

  const topics: ComputedTopic[] = [];
  for (const group of groups.values()) {
    if (group.posts.size < config.minTopicPosts) continue;
    if (group.authors.size < config.minTopicAuthors) continue;
    const [hashtag] = [...group.spellings.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0]!;
    topics.push({
      hashtag,
      postCount: group.posts.size,
      authorCount: group.authors.size,
      engagement: group.engagement,
    });
  }
  return topics
    .sort((a, b) => topicRank(b) - topicRank(a) || a.hashtag.localeCompare(b.hashtag))
    .slice(0, config.maxTopics);
}
