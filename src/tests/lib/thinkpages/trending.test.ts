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
jest.mock("~/server/modules/thinkpages-forum", () => ({
  latestPublicThreads: jest.fn().mockResolvedValue({ threads: [], realms: [] }),
}));

import { describe, it, expect } from "@jest/globals";
import {
  TRENDING_CONFIG,
  decayFactor,
  scoreEngagement,
  type EngagementEvent,
} from "~/lib/thinkpages/trending";
import { reconcileEngagementCounters, runThinkPagesTrending } from "~/lib/thinkpages/trending-cron";
import { activitiesTrendingRouter } from "~/server/api/routers/activities/trending";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { latestPublicThreads } from "~/server/modules/thinkpages-forum";

const NOW = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const ev = (postId: string, kind: EngagementEvent["kind"], actorId: string, h = 0) => ({
  postId,
  kind,
  actorId,
  at: hoursAgo(h),
});

describe("scoreEngagement", () => {
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
describe("activities.getUnifiedTrending forum source (phase 4b)", () => {
  it("lists native public threads, scored by replies, linking to the thread", async () => {
    const db: any = createMockPrisma();
    const lastPostAt = new Date();
    jest.mocked(latestPublicThreads).mockResolvedValueOnce({
      threads: [
        {
          id: "t1",
          title: "Old forum favourites",
          author: "jane",
          categoryName: "General",
          replyCount: 4,
          createdAt: lastPostAt,
          lastPostAt,
          href: "/thinkpages/t/t1",
          placement: {
            key: "general",
            name: "General",
            scope: "site",
            realmId: null,
            style: "ooc",
          },
          persona: false,
          personaType: null,
          starter: "user:u1",
        },
      ],
      realms: [],
    });
    const caller = createCallerFactory(activitiesTrendingRouter)(
      createMockRouterContext({ db }) as never
    );
    const { items } = await caller.getUnifiedTrending({ limit: 10 });
    expect(latestPublicThreads).toHaveBeenCalledWith(db, 25);
    expect(items.find((i) => i.source === "forum")).toMatchObject({
      id: "forum-t1",
      title: "Old forum favourites",
      author: "jane",
      url: "/thinkpages/t/t1",
      engagement: { replies: 4, views: 0 },
      timestamp: lastPostAt.toISOString(),
    });
  });
});
