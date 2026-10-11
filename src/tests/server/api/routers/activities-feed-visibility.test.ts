/** @jest-environment node */
/**
 * A non-public ActivityFeed row never reaches the Home feed. An abandoned directive's row turns private
 * (`withdrawDirectiveActivity`), so the directive leaves the feed with it.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  latestPublicThreadPreviews: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, expect, it } from "@jest/globals";
import { activitiesFeedGlobalRouter } from "~/server/api/routers/activities/feed/global";
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
    findMany: jest.fn(async ({ where }: { where: { visibility?: string } }) =>
      [...rows.values()].filter(
        (r) => where.visibility === undefined || r.visibility === where.visibility
      )
    ),
  };
}

describe("activities.getGlobalFeed visibility", () => {
  it("asks for public rows only", async () => {
    const activityFeed = activityFeedFake();
    const caller = createCallerFactory(activitiesFeedGlobalRouter)(
      createMockRouterContext({ db: createMockPrisma({ activityFeed }) }) as never
    );
    await caller.getGlobalFeed({ filter: "all", limit: 20 });
    expect(activityFeed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ visibility: "public" }) })
    );
  });

  it("drops an abandoned directive from the feed once its row is private", async () => {
    const activityFeed = activityFeedFake();
    const db = createMockPrisma({ activityFeed });
    const caller = createCallerFactory(activitiesFeedGlobalRouter)(
      createMockRouterContext({ db }) as never
    );
    await declareDirectiveActivity(db as never, {
      intentId: "int1",
      countryId: "c1",
      countryName: "Testland",
      userId: "clerk_1",
      goal: "Create industrial manufacturing jobs",
      tier: "moderate",
      category: "economy",
    });

    const before = await caller.getGlobalFeed({ filter: "all", limit: 20 });
    expect(before.activities.map((a: { id: string }) => a.id)).toContain("dir-int1");

    await withdrawDirectiveActivity(db as never, "int1");

    const after = await caller.getGlobalFeed({ filter: "all", limit: 20 });
    expect(after.activities.map((a: { id: string }) => a.id)).not.toContain("dir-int1");
  });
});
