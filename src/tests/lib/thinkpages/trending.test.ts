/** @jest-environment node */
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

jest.mock("~/lib/cache/redis-client", () => ({
  getSharedRedis: () => null,
  isRedisReady: () => false,
}));

import { describe, it, expect } from "@jest/globals";
import {
  TRENDING_CONFIG,
  decayFactor,
  scoreEngagement,
  type EngagementEvent,
} from "~/lib/thinkpages/trending";
import { reconcileEngagementCounters } from "~/lib/thinkpages/trending-cron";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { recordPostView, resetPostViewMemory } from "~/lib/thinkpages/post-views";
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

/**
 * SL-8: post views count once per signed-in viewer per post per UTC day, never the author's
 * own, and only on public or unlisted posts. Counted views are written in batches to the
 * per-day table (read by the trending score) and to the post's lifetime impressions.
 */
describe("post views (SL-8)", () => {
  const NOW = new Date("2026-10-05T10:00:00.000Z");
  function dbWithPost(post: { visibility: string; clerkUserId: string } | null) {
    const db: any = createMockPrisma();
    db.thinkpagesPost.findUnique.mockResolvedValue(
      post ? { visibility: post.visibility, account: { clerkUserId: post.clerkUserId } } : null
    );
    db.thinkpagesPost.updateMany.mockResolvedValue({ count: 1 });
    db.thinkpagesPostViewDay.upsert.mockResolvedValue({});
    return db;
  }
  beforeEach(() => resetPostViewMemory());
  describe("recordPostView", () => {
    it("counts a viewer once per post per day", async () => {
      const db = dbWithPost({ visibility: "public", clerkUserId: "author" });
      expect(await recordPostView(db, "p1", "viewer", NOW)).toBe(true);
      expect(await recordPostView(db, "p1", "viewer", NOW)).toBe(false);
      // The repeat never reaches the database.
      expect(db.thinkpagesPost.findUnique).toHaveBeenCalledTimes(1);
      expect(await recordPostView(db, "p1", "other", NOW)).toBe(true);
      const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
      expect(await recordPostView(db, "p1", "viewer", tomorrow)).toBe(true);
    });

    it("ignores the author, private posts and missing posts", async () => {
      expect(
        await recordPostView(
          dbWithPost({ visibility: "public", clerkUserId: "me" }),
          "p",
          "me",
          NOW
        )
      ).toBe(false);
      expect(
        await recordPostView(dbWithPost({ visibility: "private", clerkUserId: "a" }), "p", "v", NOW)
      ).toBe(false);
      expect(await recordPostView(dbWithPost(null), "gone", "v", NOW)).toBe(false);
    });
  });
});
