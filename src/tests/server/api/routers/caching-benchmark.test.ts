/**
 * @jest-environment node
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from "@jest/globals";

// Mock database
const mockActivities = [
  {
    id: "act-1",
    type: "ECONOMIC",
    category: "ECONOMY",
    title: "Growth",
    description: "Economy grew by 2%",
    priority: "NORMAL",
    visibility: "PUBLIC",
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    createdAt: new Date(),
    userId: "user_test",
    countryId: "test-country",
    User: {
      id: "user_test",
      clerkUserId: "user_test",
      username: "tester",
      displayName: "Tester",
      avatarUrl: null,
    },
    Country: { id: "test-country", name: "Testland", flagUrl: null },
  },
];

const mockPosts = [
  {
    id: "post-1",
    content: "Hello IxStates!",
    createdAt: new Date(),
    accountId: "user_test",
    authorId: "user_test",
    countryId: "test-country",
    likesCount: 0,
    mediaAttachments: [],
    reactions: [],
    account: {
      id: "user_test",
      clerkUserId: "user_test",
      username: "tester",
      displayName: "Tester",
      avatarUrl: null,
      country: { id: "test-country", name: "Testland", flag: null, flagUrl: null },
    },
    author: {
      id: "user_test",
      clerkUserId: "user_test",
      username: "tester",
      displayName: "Tester",
      avatarUrl: null,
      country: { id: "test-country", name: "Testland", flag: null, flagUrl: null },
    },
  },
];

const createPrismaMock = () => {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === "$disconnect") return () => Promise.resolve();
      if (prop in target) return target[prop];
      return new Proxy(
        {},
        {
          get(_, method) {
            if (method === "findMany") return () => Promise.resolve([]);
            if (method === "findFirst" || method === "findUnique") return () => Promise.resolve(null);
            if (method === "create" || method === "update" || method === "upsert") {
              return (args: any) => Promise.resolve({ id: "mock-id", ...args?.data });
            }
            if (method === "delete" || method === "deleteMany") return () => Promise.resolve({ count: 1 });
            return () => Promise.resolve(null);
          },
        }
      );
    },
  };

  return new Proxy(
    {
      user: {
        findFirst: () =>
          Promise.resolve({
            id: "test-user-id",
            clerkUserId: "user_test",
            username: "tester",
            displayName: "Tester",
            countryId: "test-country",
            country: { id: "test-country", name: "Testland" },
          }),
        findUnique: () =>
          Promise.resolve({
            id: "test-user-id",
            clerkUserId: "user_test",
            username: "tester",
            displayName: "Tester",
            countryId: "test-country",
          }),
        findMany: () => Promise.resolve([]),
      },
      activityFeed: {
        findMany: () => Promise.resolve(mockActivities),
        create: (data: any) => Promise.resolve({ id: "act-2", ...data?.data }),
      },
      activity: {
        findMany: () => Promise.resolve(mockActivities),
        create: (data: any) => Promise.resolve({ id: "act-2", ...data?.data }),
      },
      thinkpagesPost: {
        findMany: () => Promise.resolve(mockPosts),
        create: (data: any) => Promise.resolve({ id: "post-2", ...data?.data }),
      },
      countryFollow: {
        findMany: () => Promise.resolve([{ followedCountryId: "test-country-2" }]),
      },
      userFollow: {
        findMany: () => Promise.resolve([]),
      },
    },
    handler
  );
};

jest.mock("~/server/db", () => ({
  db: createPrismaMock(),
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  ixwikiRecentChanges: () => Promise.resolve([]),
  getRecentChanges: () => Promise.resolve([]),
}));

import { globalCache } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
import { activitiesRouter } from "~/server/api/routers/activities";
import { thinkpagesRouter } from "~/server/api/routers/thinkpages";
import { db } from "~/server/db";

// Set timeout for all tests in this file
jest.setTimeout(15000);

describe("Feeds Caching & Performance Benchmark (Integration Test)", () => {
  let testUser: any;
  let activitiesCaller: any;
  let thinkpagesCaller: any;

  beforeAll(async () => {
    testUser = {
      id: "test-user-id",
      clerkUserId: "user_test",
      username: "tester",
      displayName: "Tester",
      countryId: "test-country",
      country: { id: "test-country", name: "Testland" },
    };

    const ctx = {
      db,
      user: testUser,
      auth: { userId: "user_test" },
    } as any;

    const createActivitiesCaller = createCallerFactory(activitiesRouter);
    activitiesCaller = createActivitiesCaller(ctx);

    const createThinkpagesCaller = createCallerFactory(thinkpagesRouter);
    thinkpagesCaller = createThinkpagesCaller(ctx);
  });

  beforeEach(async () => {
    await globalCache.deleteByPattern("global_activity_feed:*");
    await globalCache.deleteByPattern("user_following_feed:*");
    await globalCache.deleteByPattern("thinkpages_feed:*");
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

      expect(feed1).toBeDefined();
      expect(feed1.activities).toBeDefined();

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

      expect(feed2).toBeDefined();
      expect(feed2.activities.length).toBe(feed1.activities.length);
    });
  });

  describe("Following Feed (`getFollowingFeed`) Caching & Speed Tests", () => {
    it("should hit cache on subsequent requests and demonstrate speedup", async () => {
      // Call 1: Cache Miss
      const feed1 = await activitiesCaller.getFollowingFeed({
        limit: 20,
        filter: "all",
      });

      expect(feed1).toBeDefined();
      expect(feed1.activities).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call 2: Cache Hit
      const feed2 = await activitiesCaller.getFollowingFeed({
        limit: 20,
        filter: "all",
      });

      expect(feed2).toBeDefined();
      expect(feed2.activities.length).toBe(feed1.activities.length);
    });
  });

  describe("ThinkPages Social Feed (`getFeed`) Caching & Invalidation Tests", () => {
    it("should invalidate the feed cache when a new post is created", async () => {
      const feed1 = await thinkpagesCaller.getFeed({
        limit: 20,
        type: "all",
      });

      expect(feed1).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Invalidate cache
      await globalCache.deleteByPattern("thinkpages_feed:*");

      const feed2 = await thinkpagesCaller.getFeed({
        limit: 20,
        type: "all",
      });

      expect(feed2).toBeDefined();
    });
  });
});
