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

function makeDb(existing: string[] = []) {
  const rows = new Set(existing);
  return {
    intent: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: { data: Record<string, string | number | null> }) => ({
        id: "intent_1",
        ...args.data,
      })),
      findUnique: jest.fn(async () => ({ id: "intent_1", countryId: "c1", status: "active" })),
      update: jest.fn(async (args: { data: Record<string, string | number | null> }) => ({
        id: "intent_1",
        ...args.data,
      })),
    },
    country: { findUnique: jest.fn(async () => ({ name: "Testland" })) },
    storytellerEffect: { create: jest.fn(async () => ({})) },
    budgetAllocation: { findFirst: jest.fn(async () => null), update: jest.fn() },
    activityFeed: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        rows.has(where.id) ? { id: where.id } : null
      ),
      create: jest.fn(async ({ data }: { data: { id: string } }) => {
        rows.add(data.id);
        return { ...data };
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
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
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.updateStatus({ id: "intent_1", status: "abandoned" });
    expect(db.activityFeed.updateMany).toHaveBeenCalledWith({
      where: { id: "dir-intent_1" },
      data: { visibility: "private" },
    });
  });
});
