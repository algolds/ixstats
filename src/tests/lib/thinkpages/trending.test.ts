/**
 * ThinkPages trending: engagement-decay scoring, post selection, hashtag topics, the
 * thinkpages-trending cron job's writes (trending flags, scores, TrendingTopic, counters), the
 * feed's trending / hot ordering and the TrendingTopic reader.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/forum", () => ({
  getForumTrendingThreads: jest.fn().mockResolvedValue([]),
}));

import { describe, it, expect } from "@jest/globals";
import {
  TRENDING_CONFIG,
  computeTrendingTopics,
  decayFactor,
  parseHashtags,
  scoreEngagement,
  selectTrendingPosts,
  type EngagementEvent,
} from "~/lib/thinkpages/trending";
import {
  expectedLikeCount,
  reconcileEngagementCounters,
  runThinkPagesTrending,
} from "~/lib/thinkpages/trending-cron";
import { feedOrderBy } from "~/server/api/routers/thinkpages/feed";
import { activitiesTrendingRouter } from "~/server/api/routers/activities/trending";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const ev = (postId: string, kind: EngagementEvent["kind"], actorId: string, h = 0) => ({
  postId,
  kind,
  actorId,
  at: hoursAgo(h),
});

describe("scoreEngagement", () => {
  it("weights kinds, halves per half-life and ignores events outside the window", () => {
    expect(decayFactor(TRENDING_CONFIG.halfLifeHours)).toBeCloseTo(0.5);
    const scores = scoreEngagement(
      [
        ev("p", "reaction", "u1"),
        ev("p", "reply", "u2"),
        ev("p", "repost", "u3", TRENDING_CONFIG.halfLifeHours),
        ev("p", "reaction", "u4", TRENDING_CONFIG.windowHours + 1),
      ],
      new Map([["p", "author"]]),
      NOW
    );
    expect(scores.get("p")!.score).toBeCloseTo(1 + 2 + 3 * 0.5);
    expect(scores.get("p")!.weighted).toBe(6);
  });

  it("weighs a day's distinct views per viewer (SL-8)", () => {
    const scores = scoreEngagement(
      [{ postId: "p", kind: "view", actorId: "views:2026-09-30", at: NOW, count: 12 }],
      new Map([["p", "author"]]),
      NOW
    );
    expect(scores.get("p")!.score).toBeCloseTo(12 * TRENDING_CONFIG.weights.view);
    expect(scores.get("p")!.score).toBeCloseTo(TRENDING_CONFIG.minPostScore);
  });

  it("ignores the author's own engagement and counts each user once per kind", () => {
    const scores = scoreEngagement(
      [
        ev("p", "reaction", "author"),
        ev("p", "reply", "author"),
        ev("p", "reply", "u1", 3),
        ev("p", "reply", "u1", 1),
        ev("p", "reply", "u1", 2),
      ],
      new Map([["p", "author"]]),
      NOW
    );
    expect(scores.get("p")!.weighted).toBe(2);
    expect(scores.get("p")!.score).toBeCloseTo(2 * decayFactor(1));
  });
});

describe("selectTrendingPosts", () => {
  const base = { visibility: "public", postType: "original", content: "x", parentPostId: null };
  it("keeps eligible posts above the minimum score, best first", () => {
    const scores = new Map([
      ["a", { score: 5, weighted: 5 }],
      ["b", { score: 9, weighted: 9 }],
      ["low", { score: TRENDING_CONFIG.minPostScore - 0.1, weighted: 2 }],
      ["reply", { score: 50, weighted: 50 }],
      ["private", { score: 50, weighted: 50 }],
      ["plainRepost", { score: 50, weighted: 50 }],
      ["quote", { score: 4, weighted: 4 }],
    ]);
    const ids = selectTrendingPosts(
      [
        { ...base, id: "a" },
        { ...base, id: "b" },
        { ...base, id: "low" },
        { ...base, id: "reply", parentPostId: "a" },
        { ...base, id: "private", visibility: "private" },
        { ...base, id: "plainRepost", postType: "repost", content: "  " },
        { ...base, id: "quote", postType: "repost", content: "my take" },
      ],
      scores
    );
    expect(ids).toEqual(["b", "a", "quote"]);
  });

  it("returns nothing when nothing qualifies", () => {
    expect(selectTrendingPosts([{ ...base, id: "a" }], new Map())).toEqual([]);
  });
});

describe("hashtag topics", () => {
  it("parses stored hashtags, stripping # and ThinkTank group tags", () => {
    expect(parseHashtags('["#Econ","econ","group:abc",""," Trade "]')).toEqual([
      "Econ",
      "econ",
      "Trade",
    ]);
    expect(parseHashtags("not json")).toEqual([]);
    expect(parseHashtags(null)).toEqual([]);
  });

  it("groups case-insensitively and needs several posts by several users", () => {
    const topics = computeTrendingTopics(
      [
        { id: "1", hashtags: '["Econ"]', authorId: "u1" },
        { id: "2", hashtags: '["econ"]', authorId: "u2" },
        { id: "3", hashtags: '["Econ","Solo"]', authorId: "u3" },
        { id: "4", hashtags: '["Solo"]', authorId: "u3" },
        { id: "5", hashtags: '["Lonely"]', authorId: "u1" },
      ],
      new Map([["2", { score: 4, weighted: 5 }]])
    );
    expect(topics).toEqual([{ hashtag: "Econ", postCount: 3, authorCount: 3, engagement: 5 }]);
  });
});

describe("expectedLikeCount", () => {
  it("prefers the JSON tally, falling back to like rows", () => {
    expect(expectedLikeCount(JSON.stringify({ like: 4, fire: 1 }), 2)).toBe(4);
    expect(expectedLikeCount(JSON.stringify({ fire: 1 }), 2)).toBe(0);
    expect(expectedLikeCount(null, 2)).toBe(2);
  });
});

function cronDb() {
  const db: any = createMockPrisma();
  const author = (clerkUserId: string) => ({ clerkUserId });
  db.postReaction.findMany.mockResolvedValue([
    { postId: "hot", accountId: "x1", timestamp: hoursAgo(1), account: author("u1") },
    { postId: "hot", accountId: "x2", timestamp: hoursAgo(1), account: author("u2") },
    { postId: "hot", accountId: "x3", timestamp: hoursAgo(2), account: author("u3") },
    { postId: "self", accountId: "s1", timestamp: hoursAgo(1), account: author("owner") },
  ]);
  db.thinkpagesPost.findMany.mockImplementation(async (args: any) => {
    const where = args?.where ?? {};
    if (where.parentPostId) {
      return [
        { parentPostId: "hot", accountId: "x4", createdAt: hoursAgo(1), account: author("u4") },
      ];
    }
    if (where.repostOfId) return [];
    if (where.id?.in) {
      return [
        {
          id: "hot",
          visibility: "public",
          postType: "original",
          content: "#Econ news",
          parentPostId: null,
          trendingScore: 0,
          accountId: "author_persona",
          account: author("owner"),
        },
        {
          id: "self",
          visibility: "public",
          postType: "original",
          content: "me",
          parentPostId: null,
          trendingScore: 2,
          accountId: "author_persona",
          account: author("owner"),
        },
      ];
    }
    if (where.hashtags) {
      return [
        {
          id: "hot",
          hashtags: '["Econ"]',
          postType: "original",
          content: "a",
          accountId: "a",
          account: author("owner"),
        },
        {
          id: "other",
          hashtags: '["Econ"]',
          postType: "original",
          content: "b",
          accountId: "b",
          account: author("u9"),
        },
      ];
    }
    return []; // counter reconcile pages
  });
  db.thinkpagesPost.groupBy.mockResolvedValue([]);
  db.postReaction.groupBy.mockResolvedValue([]);
  db.trendingTopic.findMany.mockResolvedValue([]);
  return db;
}

describe("runThinkPagesTrending", () => {
  it("flags the top posts, stores scores, clears the rest and writes TrendingTopic", async () => {
    const db = cronDb();
    const result = await runThinkPagesTrending(db, NOW);

    expect(result.trendingPosts).toBe(1);
    expect(result.trendingTopics).toBe(1);

    const scoreWrite = db.thinkpagesPost.update.mock.calls.find(
      (c: any) => c[0].where.id === "hot"
    );
    expect(scoreWrite[0].data.trendingScore).toBeGreaterThanOrEqual(TRENDING_CONFIG.minPostScore);
    // Self-engagement never scores; the stale score is reset.
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { trendingScore: { not: 0 }, id: { notIn: ["hot"] } },
      data: { trendingScore: 0 },
    });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { trending: true, id: { notIn: ["hot"] } },
      data: { trending: false },
    });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["hot"] } },
      data: { trending: true },
    });

    expect(db.trendingTopic.upsert).toHaveBeenCalledTimes(1);
    expect(db.trendingTopic.upsert.mock.calls[0][0]).toMatchObject({
      where: { hashtag: "Econ" },
      create: { hashtag: "Econ", postCount: 2, isActive: true, peakTimestamp: NOW },
    });
    expect(db.trendingTopic.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, hashtag: { notIn: ["Econ"] } },
      data: { isActive: false },
    });
  });

  it("scores stored view days, so a widely read post can trend on views", async () => {
    const db: any = createMockPrisma();
    db.thinkpagesPost.groupBy.mockResolvedValue([]);
    db.postReaction.groupBy.mockResolvedValue([]);
    db.thinkpagesPostViewDay.findMany.mockResolvedValue([
      { postId: "read", day: new Date("2026-09-30T00:00:00Z"), views: 16 },
    ]);
    db.thinkpagesPost.findMany.mockImplementation(async (args: any) =>
      args?.where?.id?.in
        ? [
            {
              id: "read",
              visibility: "public",
              postType: "original",
              content: "essay",
              parentPostId: null,
              trendingScore: 0,
              accountId: "persona",
              account: { clerkUserId: "author" },
            },
          ]
        : []
    );

    const result = await runThinkPagesTrending(db, NOW);

    expect(result.trendingPosts).toBe(1);
    expect(db.thinkpagesPostViewDay.findMany.mock.calls[0][0].where.day.gte).toEqual(
      new Date("2026-09-27T00:00:00Z")
    );
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["read"] } },
      data: { trending: true },
    });
  });

  it("clears every trending flag and topic when nothing qualifies", async () => {
    const db: any = createMockPrisma();
    db.thinkpagesPost.groupBy.mockResolvedValue([]);
    db.postReaction.groupBy.mockResolvedValue([]);
    const result = await runThinkPagesTrending(db, NOW);
    expect(result).toMatchObject({ trendingPosts: 0, trendingTopics: 0 });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { trending: true, id: { notIn: [] } },
      data: { trending: false },
    });
    expect(db.trendingTopic.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, hashtag: { notIn: [] } },
      data: { isActive: false },
    });
    expect(db.trendingTopic.upsert).not.toHaveBeenCalled();
  });
});

describe("reconcileEngagementCounters", () => {
  it("rewrites counters that disagree with the real rows", async () => {
    const db: any = createMockPrisma();
    db.thinkpagesPost.groupBy.mockImplementation(async (args: any) =>
      args.by[0] === "parentPostId"
        ? [{ parentPostId: "p1", _count: { _all: 2 } }]
        : [{ repostOfId: "p1", _count: { _all: 1 } }]
    );
    db.postReaction.groupBy.mockResolvedValue([{ postId: "p1", _count: { _all: 3 } }]);
    db.thinkpagesPost.findMany.mockResolvedValue([
      { id: "p1", likeCount: 0, replyCount: 0, repostCount: 0, reactionCounts: null },
      { id: "p2", likeCount: 0, replyCount: 0, repostCount: 0, reactionCounts: null },
    ]);
    expect(await reconcileEngagementCounters(db)).toBe(1);
    expect(db.thinkpagesPost.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { likeCount: 3, replyCount: 2, repostCount: 1 },
    });
  });
});

describe("feed ordering", () => {
  it("hot and trending rank by trendingScore; recent stays newest-first", () => {
    expect(feedOrderBy("hot")).toEqual([
      { pinned: "desc" },
      { trendingScore: "desc" },
      { ixTimeTimestamp: "desc" },
    ]);
    expect(feedOrderBy("trending")[0]).toEqual({ trendingScore: "desc" });
    expect(feedOrderBy("recent")).toEqual([{ pinned: "desc" }, { ixTimeTimestamp: "desc" }]);
  });
});

describe("activities.getTrendingTopics", () => {
  const createCaller = createCallerFactory(activitiesTrendingRouter);

  it("reads active TrendingTopic rows, ranked", async () => {
    const db: any = createMockPrisma();
    db.trendingTopic.findMany.mockResolvedValue([
      { id: "t1", hashtag: "Small", postCount: 2, engagement: 0, peakTimestamp: new Date(0) },
      { id: "t2", hashtag: "Big", postCount: 3, engagement: 10, peakTimestamp: new Date() },
    ]);
    const caller = createCaller(createMockRouterContext({ db }) as never);
    const topics = await caller.getTrendingTopics({ limit: 5 });

    expect(db.trendingTopic.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(topics.map((t) => t.title)).toEqual(["#Big", "#Small"]);
    expect(topics[0]).toMatchObject({ hashtag: "Big", postCount: 3, trend: "up" });
    expect(topics[1]!.trend).toBe("steady");
    expect(db.activityFeed.findMany).not.toHaveBeenCalled();
  });

  it("is empty when no topic is active", async () => {
    const db: any = createMockPrisma();
    const caller = createCaller(createMockRouterContext({ db }) as never);
    expect(await caller.getTrendingTopics({ limit: 5 })).toEqual([]);
  });
});

describe("activities.getUnifiedTrending ThinkPages source", () => {
  it("only lists posts the cron scored, by score", async () => {
    const db: any = createMockPrisma();
    const caller = createCallerFactory(activitiesTrendingRouter)(
      createMockRouterContext({ db }) as never
    );
    await caller.getUnifiedTrending({ limit: 10 });
    expect(db.thinkpagesPost.findMany.mock.calls[0][0]).toMatchObject({
      where: { visibility: "public", trendingScore: { gt: 0 } },
      orderBy: { trendingScore: "desc" },
    });
  });
});
