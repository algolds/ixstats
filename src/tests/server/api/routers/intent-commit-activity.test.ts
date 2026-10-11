/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-commit-effects.test.ts).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/activity", () => ({
  __esModule: true,
  CountryEventSpine: { recordCountryEvent: jest.fn() },
}));
jest.mock("~/lib/intent/resistance", () => ({
  __esModule: true,
  spawnIntentResistance: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { CountryEventSpine } from "~/lib/activity";

const recordCountryEvent = jest.mocked(CountryEventSpine.recordCountryEvent);

interface FeedRow {
  id: string;
  visibility: string;
}

/** Stateful tables (the directive's status and its activity rows); `$transaction` rolls both back when its body throws. */
function makeDb(existing: string[] = []) {
  const rows = new Map<string, FeedRow>(existing.map((id) => [id, { id, visibility: "public" }]));
  let status = "active";
  const db = {
    rows,
    status: () => status,
    $transaction: jest.fn(async <T>(run: (tx: object) => Promise<T>) => {
      const savedStatus = status;
      const savedRows = [...rows.values()].map((r) => ({ ...r }));
      try {
        return await run(db);
      } catch (error) {
        status = savedStatus;
        rows.clear();
        for (const r of savedRows) rows.set(r.id, r);
        throw error;
      }
    }),
    intent: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: { data: Record<string, string | number | null> }) => ({
        id: "intent_1",
        ...args.data,
      })),
      findUnique: jest.fn(async () => ({ id: "intent_1", countryId: "c1", status })),
      update: jest.fn(async (args: { data: { status: string } }) => {
        status = args.data.status;
        return { id: "intent_1", ...args.data };
      }),
    },
    nationalIssue: { findFirst: jest.fn(async () => null) },
    country: { findUnique: jest.fn(async () => ({ name: "Testland" })) },
    storytellerEffect: { create: jest.fn(async () => ({})) },
    budgetAllocation: { findFirst: jest.fn(async () => null), update: jest.fn() },
    activityFeed: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        rows.has(where.id) ? { id: where.id } : null
      ),
      create: jest.fn(async ({ data }: { data: FeedRow }) => {
        rows.set(data.id, { id: data.id, visibility: data.visibility });
        return { ...data };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { visibility: string } }) => {
          const row = rows.get(where.id);
          if (row) row.visibility = data.visibility;
          return { count: row ? 1 : 0 };
        }
      ),
    },
  };
  return db;
}

const ctxFor = (db: ReturnType<typeof makeDb>) =>
  createMockRouterContext({
    db,
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", countryId: "c1", role: { name: "user", level: 100 } },
  }) as never;

const GOAL = "Create industrial manufacturing jobs";

describe("intent.commit activity row", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordCountryEvent.mockResolvedValue([] as never);
  });

  it("writes exactly one public row for a committed directive and returns its id", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    const res = await caller.commit({ countryId: "c1", goal: GOAL, tier: "moderate" });

    expect(res.activityId).toBe("dir-intent_1");
    expect(db.activityFeed.create).toHaveBeenCalledTimes(1);
    expect(db.activityFeed.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "dir-intent_1",
        type: "directive",
        category: "government",
        visibility: "public",
        countryId: "c1",
        userId: "user_1",
        title: GOAL,
      }),
    });
  });

  it("writes nothing for a draft: a private directive cannot be revealed by the forum", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    const res = await caller.commit({ countryId: "c1", goal: GOAL, tier: "proposed" });

    expect(res.activityId).toBeNull();
    expect(db.activityFeed.create).not.toHaveBeenCalled();
    expect(db.activityFeed.findUnique).not.toHaveBeenCalled();
  });

  it("does not write a second row when the row already exists", async () => {
    const db = makeDb(["dir-intent_1"]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    const res = await caller.commit({ countryId: "c1", goal: GOAL, tier: "moderate" });

    expect(res.activityId).toBe("dir-intent_1");
    expect(db.activityFeed.create).not.toHaveBeenCalled();
  });

  it("still commits the directive when the row cannot be written", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = makeDb();
    db.activityFeed.create.mockRejectedValueOnce(new Error("db down"));
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    const res = await caller.commit({ countryId: "c1", goal: GOAL, tier: "moderate" });

    expect(res.activityId).toBeNull();
    expect(res.intent.id).toBe("intent_1");
    expect(recordCountryEvent).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

describe("intent.updateStatus and the activity row", () => {
  it("turns the row private when a directive is abandoned", async () => {
    const db = makeDb(["dir-intent_1"]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.updateStatus({ id: "intent_1", status: "abandoned" });
    expect(db.activityFeed.updateMany).toHaveBeenCalledWith({
      where: { id: "dir-intent_1" },
      data: { visibility: "private" },
    });
    expect(db.status()).toBe("abandoned");
    expect(db.rows.get("dir-intent_1")?.visibility).toBe("private");
  });

  it("rolls the status change back when the row cannot be withdrawn, and surfaces the error", async () => {
    const db = makeDb(["dir-intent_1"]);
    db.activityFeed.updateMany.mockRejectedValueOnce(new Error("db down"));
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await expect(
      caller.updateStatus({ id: "intent_1", status: "abandoned" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(db.status()).toBe("active");
    expect(db.rows.get("dir-intent_1")?.visibility).toBe("public");
  });

  it("abandons a directive that has no row (an older one or a failed declare)", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.updateStatus({ id: "intent_1", status: "abandoned" });
    expect(db.status()).toBe("abandoned");
    expect(db.rows.size).toBe(0);
  });

  it("leaves the row public when a directive is completed", async () => {
    const db = makeDb(["dir-intent_1"]);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.updateStatus({ id: "intent_1", status: "completed" });
    expect(db.status()).toBe("completed");
    expect(db.activityFeed.updateMany).not.toHaveBeenCalled();
    expect(db.rows.get("dir-intent_1")?.visibility).toBe("public");
  });
});
