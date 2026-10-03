/**
 * `thinkpages-trending` cron job: scores recent ThinkPages engagement, flags the top posts
 * `trending` (clearing the rest), stores every post's `trendingScore` for the "hot" sort, writes
 * trending hashtags to `TrendingTopic`, and reconciles the denormalised engagement counters
 * (`likeCount`, `replyCount`, `repostCount`) with the real rows.
 */
import { resolveReactionCounts } from "~/server/api/routers/thinkpages/post-utils";
import {
  TRENDING_CONFIG,
  computeTrendingTopics,
  isTrendingEligible,
  scoreEngagement,
  selectTrendingPosts,
  topicRank,
  type EngagementEvent,
} from "./trending";

interface ThinkPagesTrendingResult {
  eventsConsidered: number;
  postsScored: number;
  trendingPosts: number;
  trendingTopics: number;
  countersFixed: number;
}

const HOUR_MS = 60 * 60 * 1000;
const RECONCILE_PAGE = 1000;
/** Engagement from these visibilities counts (a private reply is invisible to everyone else). */
const PUBLIC_VISIBILITIES = ["public", "unlisted"];

type Db = (typeof import("~/server/db"))["db"];

async function loadEvents(db: Db, since: Date): Promise<EngagementEvent[]> {
  const [reactions, replies, reposts] = await Promise.all([
    db.postReaction.findMany({
      where: { timestamp: { gte: since } },
      select: {
        postId: true,
        accountId: true,
        timestamp: true,
        account: { select: { clerkUserId: true } },
      },
    }),
    db.thinkpagesPost.findMany({
      where: {
        parentPostId: { not: null },
        createdAt: { gte: since },
        visibility: { in: PUBLIC_VISIBILITIES },
      },
      select: {
        parentPostId: true,
        accountId: true,
        createdAt: true,
        account: { select: { clerkUserId: true } },
      },
    }),
    db.thinkpagesPost.findMany({
      where: {
        repostOfId: { not: null },
        createdAt: { gte: since },
        visibility: { in: PUBLIC_VISIBILITIES },
      },
      select: {
        repostOfId: true,
        accountId: true,
        createdAt: true,
        account: { select: { clerkUserId: true } },
      },
    }),
  ]);

  const events: EngagementEvent[] = [];
  for (const r of reactions ?? []) {
    events.push({
      postId: r.postId,
      kind: "reaction",
      at: r.timestamp,
      actorId: r.account?.clerkUserId || r.accountId,
    });
  }
  for (const r of replies ?? []) {
    if (!r.parentPostId) continue;
    events.push({
      postId: r.parentPostId,
      kind: "reply",
      at: r.createdAt,
      actorId: r.account?.clerkUserId || r.accountId,
    });
  }
  for (const r of reposts ?? []) {
    if (!r.repostOfId) continue;
    events.push({
      postId: r.repostOfId,
      kind: "repost",
      at: r.createdAt,
      actorId: r.account?.clerkUserId || r.accountId,
    });
  }
  return events;
}

async function writePostScores(db: Db, now: Date, events: EngagementEvent[]) {
  const targetIds = [...new Set(events.map((e) => e.postId))];
  const targets = targetIds.length
    ? ((await db.thinkpagesPost.findMany({
        where: { id: { in: targetIds } },
        select: {
          id: true,
          visibility: true,
          postType: true,
          content: true,
          parentPostId: true,
          trendingScore: true,
          accountId: true,
          account: { select: { clerkUserId: true } },
        },
      })) ?? [])
    : [];

  const authorOf = new Map(targets.map((p) => [p.id, p.account?.clerkUserId || p.accountId]));
  const scores = scoreEngagement(events, authorOf, now);
  const trendingIds = selectTrendingPosts(targets, scores);

  // Store the score of every eligible post; everything else goes back to zero.
  const scoredIds: string[] = [];
  for (const post of targets) {
    const score = isTrendingEligible(post) ? (scores.get(post.id)?.score ?? 0) : 0;
    if (score <= 0) continue;
    scoredIds.push(post.id);
    if (Math.abs((post.trendingScore ?? 0) - score) > 1e-9) {
      await db.thinkpagesPost.update({ where: { id: post.id }, data: { trendingScore: score } });
    }
  }
  await db.thinkpagesPost.updateMany({
    where: { trendingScore: { not: 0 }, id: { notIn: scoredIds } },
    data: { trendingScore: 0 },
  });

  await db.thinkpagesPost.updateMany({
    where: { trending: true, id: { notIn: trendingIds } },
    data: { trending: false },
  });
  if (trendingIds.length > 0) {
    await db.thinkpagesPost.updateMany({
      where: { id: { in: trendingIds } },
      data: { trending: true },
    });
  }

  return { scores, scoredCount: scoredIds.length, trendingCount: trendingIds.length };
}

async function writeTopics(
  db: Db,
  now: Date,
  since: Date,
  scores: Map<string, { score: number; weighted: number }>
) {
  const posts =
    (await db.thinkpagesPost.findMany({
      where: {
        createdAt: { gte: since },
        visibility: "public",
        hashtags: { not: null },
      },
      select: {
        id: true,
        hashtags: true,
        postType: true,
        content: true,
        accountId: true,
        account: { select: { clerkUserId: true } },
      },
    })) ?? [];

  const topics = computeTrendingTopics(
    posts
      // A plain repost re-shares someone else's tags; it is not a new use of them.
      .filter((p) => !(p.postType === "repost" && !p.content.trim()))
      .map((p) => ({
        id: p.id,
        hashtags: p.hashtags,
        authorId: p.account?.clerkUserId || p.accountId,
      })),
    scores
  );

  const existing =
    (await db.trendingTopic.findMany({
      where: { hashtag: { in: topics.map((t) => t.hashtag) } },
      select: { hashtag: true, postCount: true, engagement: true, peakTimestamp: true },
    })) ?? [];
  const previous = new Map(existing.map((t) => [t.hashtag, t]));

  for (const topic of topics) {
    const before = previous.get(topic.hashtag);
    // `peakTimestamp` records when the topic last reached a new high rank.
    const peaked = !before || topicRank(topic) >= topicRank(before);
    await db.trendingTopic.upsert({
      where: { hashtag: topic.hashtag },
      create: {
        hashtag: topic.hashtag,
        postCount: topic.postCount,
        engagement: topic.engagement,
        peakTimestamp: now,
        isActive: true,
      },
      update: {
        postCount: topic.postCount,
        engagement: topic.engagement,
        isActive: true,
        ...(peaked ? { peakTimestamp: now } : {}),
      },
    });
  }
  await db.trendingTopic.updateMany({
    where: { isActive: true, hashtag: { notIn: topics.map((t) => t.hashtag) } },
    data: { isActive: false },
  });
  return topics.length;
}

/** Expected `likeCount`: the JSON tally's `like` entry, else the `like` reaction rows. */
export function expectedLikeCount(storedCounts: string | null, likeRows: number): number {
  const rows = Array.from({ length: likeRows }, () => ({ reactionType: "like" }));
  return Math.max(0, resolveReactionCounts(storedCounts, rows).like ?? 0);
}

/** Rewrite any engagement counter that disagrees with the real rows. Returns posts fixed. */
export async function reconcileEngagementCounters(db: Db): Promise<number> {
  const [replyGroups, repostGroups, likeGroups] = await Promise.all([
    db.thinkpagesPost.groupBy({
      by: ["parentPostId"],
      where: { parentPostId: { not: null } },
      _count: { _all: true },
    }),
    db.thinkpagesPost.groupBy({
      by: ["repostOfId"],
      where: { repostOfId: { not: null } },
      _count: { _all: true },
    }),
    db.postReaction.groupBy({
      by: ["postId"],
      where: { reactionType: "like" },
      _count: { _all: true },
    }),
  ]);
  const replies = new Map((replyGroups ?? []).map((g) => [g.parentPostId, g._count._all]));
  const reposts = new Map((repostGroups ?? []).map((g) => [g.repostOfId, g._count._all]));
  const likes = new Map((likeGroups ?? []).map((g) => [g.postId, g._count._all]));

  let fixed = 0;
  let cursor: string | undefined;
  for (;;) {
    const page =
      (await db.thinkpagesPost.findMany({
        select: {
          id: true,
          likeCount: true,
          replyCount: true,
          repostCount: true,
          reactionCounts: true,
        },
        orderBy: { id: "asc" },
        take: RECONCILE_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })) ?? [];
    for (const post of page) {
      const expected = {
        likeCount: expectedLikeCount(post.reactionCounts, likes.get(post.id) ?? 0),
        replyCount: replies.get(post.id) ?? 0,
        repostCount: reposts.get(post.id) ?? 0,
      };
      if (
        expected.likeCount !== post.likeCount ||
        expected.replyCount !== post.replyCount ||
        expected.repostCount !== post.repostCount
      ) {
        await db.thinkpagesPost.update({ where: { id: post.id }, data: expected });
        fixed++;
      }
    }
    if (page.length < RECONCILE_PAGE) break;
    cursor = page[page.length - 1]!.id;
  }
  return fixed;
}

export async function runThinkPagesTrending(
  db?: Db,
  now: Date = new Date()
): Promise<ThinkPagesTrendingResult> {
  const client = db ?? (await import("~/server/db")).db;
  const since = new Date(now.getTime() - TRENDING_CONFIG.windowHours * HOUR_MS);

  const events = await loadEvents(client, since);
  const { scores, scoredCount, trendingCount } = await writePostScores(client, now, events);
  const trendingTopics = await writeTopics(client, now, since, scores);
  const countersFixed = await reconcileEngagementCounters(client);

  try {
    const { globalCache } = await import("~/lib/cache");
    await globalCache.deleteByPattern("thinkpages_feed:*");
  } catch (error) {
    console.error("[thinkpages-trending] Failed to invalidate feed cache:", error);
  }

  return {
    eventsConsidered: events.length,
    postsScored: scoredCount,
    trendingPosts: trendingCount,
    trendingTopics,
    countersFixed,
  };
}
