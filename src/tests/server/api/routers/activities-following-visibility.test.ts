/** @jest-environment node */
/**
 * A non-public ActivityFeed row never reaches the Following feed either: an abandoned directive's row turns private
 * (`withdrawDirectiveActivity`), so followers stop seeing it.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, expect, it } from "@jest/globals";
import { activitiesFeedPersonalRouter } from "~/server/api/routers/activities/feed/personal";
import {
  declareDirectiveActivity,
  withdrawDirectiveActivity,
} from "~/lib/activity/directive-activity";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

interface Row {
  id: string;
  visibility: string;
  type: string;
  category: string;
  title: string;
  description: string;
  userId: string | null;
  countryId: string | null;
  metadata: string;
  relatedCountries: string | null;
  priority: string;
  createdAt: Date;
  poll: null;
}

/** An in-memory ActivityFeed that honours the `visibility` filter and the writes the directive module makes. */
function activityFeedFake() {
  const rows = new Map<string, Row>();
  return {
    rows,
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
    create: jest.fn(async ({ data }: { data: Omit<Row, "createdAt" | "poll"> }) => {
      const row: Row = { ...data, createdAt: new Date("2026-10-10T10:00:00Z"), poll: null };
      rows.set(row.id, row);
      return row;
    }),
    updateMany: jest.fn(
      async ({ where, data }: { where: { id: string }; data: { visibility: string } }) => {
        const row = rows.get(where.id);
        if (row) row.visibility = data.visibility;
        return { count: row ? 1 : 0 };
      }
    ),
    findMany: jest.fn(
      async ({ where }: { where: { visibility?: string; countryId?: { in: string[] } } }) =>
        [...rows.values()].filter(
          (r) => where.visibility === undefined || r.visibility === where.visibility
        )
    ),
  };
}

const ME = "user_me";

function followingCaller(activityFeed: ReturnType<typeof activityFeedFake>) {
  const db = createMockPrisma({
    activityFeed,
    countryFollow: { findMany: jest.fn(async () => [{ followedCountryId: "c1" }]) },
    thinkpagesFollow: { findMany: jest.fn(async () => []) },
    thinkpagesPost: { findMany: jest.fn(async () => []) },
    country: { findMany: jest.fn(async () => []) },
  });
  const caller = createCallerFactory(activitiesFeedPersonalRouter)(
    createMockRouterContext({
      db,
      auth: { userId: ME },
      user: { clerkUserId: ME, countryId: "c2" },
    }) as never
  );
  return { db, caller };
}

describe("activities.getFollowingFeed visibility", () => {
  it("asks for public rows only", async () => {
    const activityFeed = activityFeedFake();
    await followingCaller(activityFeed).caller.getFollowingFeed({ limit: 20 });
    expect(activityFeed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { countryId: { in: ["c1"] }, visibility: "public" },
      })
    );
  });

  it("drops an abandoned directive from a follower's feed once its row is private", async () => {
    const activityFeed = activityFeedFake();
    const { db, caller } = followingCaller(activityFeed);
    await declareDirectiveActivity(db as never, {
      intentId: "int1",
      countryId: "c1",
      countryName: "Testland",
      userId: "clerk_1",
      goal: "Create industrial manufacturing jobs",
      tier: "moderate",
      category: "economy",
    });

    const before = await caller.getFollowingFeed({ limit: 20 });
    expect(before.activities.map((a: { id: string }) => a.id)).toContain("dir-int1");

    await withdrawDirectiveActivity(db as never, "int1");

    const after = await caller.getFollowingFeed({ limit: 20 });
    expect(after.activities.map((a: { id: string }) => a.id)).not.toContain("dir-int1");
  });
});
