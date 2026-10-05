/** @jest-environment node */
/**
 * SL-8: post views count once per signed-in viewer per post per UTC day, never the author's
 * own, and only on public or unlisted posts. Counted views are written in batches to the
 * per-day table (read by the trending score) and to the post's lifetime impressions.
 */
jest.mock("~/lib/cache/redis-client", () => ({
  getSharedRedis: () => null,
  isRedisReady: () => false,
}));

import {
  flushPendingViews,
  recordPostView,
  resetPostViewMemory,
  viewDay,
  viewDayMoment,
} from "~/lib/thinkpages/post-views";
import { createMockPrisma } from "~/tests/helpers/mock-db";

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
      await recordPostView(dbWithPost({ visibility: "public", clerkUserId: "me" }), "p", "me", NOW)
    ).toBe(false);
    expect(
      await recordPostView(dbWithPost({ visibility: "private", clerkUserId: "a" }), "p", "v", NOW)
    ).toBe(false);
    expect(await recordPostView(dbWithPost(null), "gone", "v", NOW)).toBe(false);
  });
});

describe("flushPendingViews", () => {
  it("adds the batch to the day row and the lifetime impressions", async () => {
    const db = dbWithPost({ visibility: "public", clerkUserId: "author" });
    await recordPostView(db, "p1", "a", NOW);
    await recordPostView(db, "p1", "b", NOW);
    await recordPostView(db, "p2", "a", NOW);

    expect(await flushPendingViews(db)).toBe(3);
    const day = new Date("2026-10-05T00:00:00.000Z");
    expect(db.thinkpagesPostViewDay.upsert).toHaveBeenCalledWith({
      where: { postId_day: { postId: "p1", day } },
      create: { postId: "p1", day, views: 2 },
      update: { views: { increment: 2 } },
    });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { impressions: { increment: 2 } },
    });
    // Drained: a second flush writes nothing.
    expect(await flushPendingViews(db)).toBe(0);
  });

  it("skips a row that fails (post deleted since) and keeps going", async () => {
    const db = dbWithPost({ visibility: "public", clerkUserId: "author" });
    await recordPostView(db, "gone", "a", NOW);
    await recordPostView(db, "p2", "a", NOW);
    db.thinkpagesPostViewDay.upsert.mockImplementation(async (args: any) => {
      if (args.where.postId_day.postId === "gone") throw new Error("FK violation");
      return {};
    });
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(await flushPendingViews(db)).toBe(1);
    spy.mockRestore();
  });
});

describe("view day helpers", () => {
  it("buckets by UTC day and times a day's views at midday, never in the future", () => {
    expect(viewDay(NOW)).toBe("2026-10-05");
    const day = new Date("2026-10-04T00:00:00.000Z");
    expect(viewDayMoment(day, NOW).toISOString()).toBe("2026-10-04T12:00:00.000Z");
    const today = new Date("2026-10-05T00:00:00.000Z");
    expect(viewDayMoment(today, NOW)).toEqual(NOW);
  });
});
