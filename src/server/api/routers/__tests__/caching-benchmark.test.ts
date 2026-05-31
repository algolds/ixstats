/**
 * @jest-environment node
 */

// Configure database and Redis for the integration test before imports run
const dbUrl = "postgresql://ixstats_readonly:Q9ul7FneYGI4vT%2Fs1%2FjkIokTH97nuZ8Xk9qnmIVMgVs%3D@localhost:5433/ixstats?connection_limit=5&pool_timeout=30&connect_timeout=10";
process.env.DATABASE_URL = dbUrl;
process.env.REDIS_ENABLED = "true";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.DATABASE_READONLY = "true";

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { db } from "../../../db";
import { globalCache } from "../../../../lib/advanced-cache-system";
import { createCallerFactory } from "../../trpc";
import { activitiesRouter } from "../activities";
import { thinkpagesRouter } from "../thinkpages";

// Set longer timeout for all tests in this file
jest.setTimeout(30000);

describe("Feeds Caching & Performance Benchmark (Integration Test)", () => {
  let testUser: any;
  let activitiesCaller: any;
  let thinkpagesCaller: any;

  beforeAll(async () => {
    // 1. Ensure Redis is connected and check status
    console.log(`📡 Redis config: ENABLED=${process.env.REDIS_ENABLED}, URL=${process.env.REDIS_URL}`);

    // Clear feed caches to ensure a clean start
    console.log("🧹 Clearing feed caches in Redis/Memory...");
    await globalCache.deleteByPattern("global_activity_feed:*");
    await globalCache.deleteByPattern("user_following_feed:*");
    await globalCache.deleteByPattern("thinkpages_feed:*");

    // 2. Fetch a real test user from the database
    testUser = await db.user.findFirst({
      include: { country: true },
    });

    if (!testUser) {
      throw new Error("No user found in database. Cannot run integration caching tests.");
    }

    const userId = testUser.clerkUserId;
    console.log(`👤 Using test user context: ID = ${userId}, Country ID = ${testUser.countryId}`);

    // Construct mock tRPC context
    const ctx = {
      db,
      user: testUser,
      auth: { userId },
    } as any;

    // Create callers
    const createActivitiesCaller = createCallerFactory(activitiesRouter);
    activitiesCaller = createActivitiesCaller(ctx);

    const createThinkpagesCaller = createCallerFactory(thinkpagesRouter);
    thinkpagesCaller = createThinkpagesCaller(ctx);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("Global Activity Feed (`getGlobalFeed`) Caching & Speed Tests", () => {
    it("should hit cache on subsequent requests and demonstrate speedup", async () => {
      // Call 1: Cache Miss
      const start1 = performance.now();
      const feed1 = await activitiesCaller.getGlobalFeed({
        limit: 20,
        filter: "all",
        category: "all",
      });
      const end1 = performance.now();
      const missTime = end1 - start1;
      console.log(`⏱️ [Global Feed] First Call (Cache Miss): ${missTime.toFixed(2)}ms`);
      expect(feed1).toBeDefined();
      expect(feed1.activities).toBeDefined();

      // Verify date hydration on first call
      if (feed1.activities.length > 0) {
        expect(feed1.activities[0].timestamp).toBeInstanceOf(Date);
      }

      // Wait a short moment to ensure cache write finishes
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call 2: Cache Hit
      const start2 = performance.now();
      const feed2 = await activitiesCaller.getGlobalFeed({
        limit: 20,
        filter: "all",
        category: "all",
      });
      const end2 = performance.now();
      const hitTime = end2 - start2;
      console.log(`⏱️ [Global Feed] Second Call (Cache Hit): ${hitTime.toFixed(2)}ms`);

      expect(feed2).toBeDefined();
      expect(feed2.activities.length).toBe(feed1.activities.length);

      // Verify date hydration on cache hit
      if (feed2.activities.length > 0) {
        expect(feed2.activities[0].timestamp).toBeInstanceOf(Date);
      }

      const speedup = missTime / hitTime;
      console.log(`🚀 [Global Feed] Speedup Factor: ${speedup.toFixed(1)}x faster`);
      // Since DB queries can be slow, cache hit should be fast (typically < 10ms, ideally < 5ms)
      expect(hitTime).toBeLessThan(missTime);
    });
  });

  describe("Following Feed (`getFollowingFeed`) Caching & Speed Tests", () => {
    it("should hit cache on subsequent requests and demonstrate speedup", async () => {
      const start1 = performance.now();
      const feed1 = await activitiesCaller.getFollowingFeed({ limit: 30 });
      const end1 = performance.now();
      const missTime = end1 - start1;
      console.log(`⏱️ [Following Feed] First Call (Cache Miss): ${missTime.toFixed(2)}ms`);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const start2 = performance.now();
      const feed2 = await activitiesCaller.getFollowingFeed({ limit: 30 });
      const end2 = performance.now();
      const hitTime = end2 - start2;
      console.log(`⏱️ [Following Feed] Second Call (Cache Hit): ${hitTime.toFixed(2)}ms`);

      expect(feed2).toBeDefined();
      expect(feed2.activities.length).toBe(feed1.activities.length);

      const speedup = missTime / hitTime;
      console.log(`🚀 [Following Feed] Speedup Factor: ${speedup.toFixed(1)}x faster`);
      expect(hitTime).toBeLessThan(missTime);
    });
  });

  describe("ThinkPages Social Feed (`getFeed`) Caching & Invalidation Tests", () => {
    it("should invalidate the feed cache when a new post is created", async () => {
      const filterParams = { filter: "recent" as const, limit: 20 };

      // Call 1: Cache Miss
      const start1 = performance.now();
      const feed1 = await thinkpagesCaller.getFeed(filterParams);
      const end1 = performance.now();
      const missTime = end1 - start1;
      console.log(`⏱️ [ThinkPages Feed] First Call (Cache Miss): ${missTime.toFixed(2)}ms`);

      // Verify date hydration
      if (feed1.posts.length > 0) {
        expect(feed1.posts[0].createdAt).toBeInstanceOf(Date);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call 2: Cache Hit
      const start2 = performance.now();
      await thinkpagesCaller.getFeed(filterParams);
      const end2 = performance.now();
      const hitTime = end2 - start2;
      console.log(`⏱️ [ThinkPages Feed] Second Call (Cache Hit): ${hitTime.toFixed(2)}ms`);
      expect(hitTime).toBeLessThan(missTime);

      // Find or create ThinkPages account for writing
      let testAccount = await db.thinkpagesAccount.findFirst({
        where: { clerkUserId: testUser.clerkUserId },
      });

      if (!testAccount) {
        testAccount = await db.thinkpagesAccount.create({
          data: {
            clerkUserId: testUser.clerkUserId,
            countryId: testUser.countryId || "cmgn9d7qx002w4kyxb5vbycau",
            username: `test_bench_${Math.floor(Math.random() * 10000)}`,
            displayName: "Benchmark Tester",
            firstName: "Bench",
            lastName: "Tester",
            accountType: "citizen",
            bio: "",
            verified: false,
          },
        });
      }

      // Create new ThinkPages post (mutations should invalidate the feed cache!)
      console.log("📝 Creating a new ThinkPages post to trigger cache invalidation...");
      const postResult = await thinkpagesCaller.createPost({
        accountId: testAccount.id,
        content: `Jest caching integration test post! Time: ${Date.now()}`,
        visibility: "public",
      });
      expect(postResult).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call 3: Should be a Cache Miss due to invalidation!
      const start3 = performance.now();
      const feedAfterPost = await thinkpagesCaller.getFeed(filterParams);
      const end3 = performance.now();
      const postBustMissTime = end3 - start3;
      console.log(`⏱️ [ThinkPages Feed] Call After Post (Expected Cache Miss): ${postBustMissTime.toFixed(2)}ms`);

      // The new post should be found in the feed (might not be first if there are pinned posts)
      const foundNewPost = feedAfterPost.posts.some((p: any) =>
        p.content.includes("Jest caching integration test post!")
      );
      if (!foundNewPost) {
        console.log("Feed posts content:", feedAfterPost.posts.map((p: any) => p.content));
      }
      expect(foundNewPost).toBe(true);
      expect(postBustMissTime).toBeGreaterThan(hitTime);
    });
  });
});
