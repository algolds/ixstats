// `jest` is deliberately NOT imported from "@jest/globals" — the jest.mock() factory below
// calls jest.fn() inline and is hoisted above imports (see cards-archetypes-admin-auth.test.ts).
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue("notification_1") },
}));

import { scheduledChangesRouter } from "~/server/api/routers/scheduledChanges";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const ordinaryUserCtx = (db: ReturnType<typeof createMockDb>, id = "user_a") =>
  createMockRouterContext({
    auth: { userId: `clerk_${id}` },
    user: { id: `db_${id}`, clerkUserId: `clerk_${id}`, role: { name: "user", level: 100 } },
    db,
  });

const PAST = new Date("2026-09-24T12:00:00.000Z");

describe("scheduledChangesRouter auth (plan 329)", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects a non-admin calling applyDueChanges and never reads or writes changes", async () => {
    const db = createMockDb();
    const caller = scheduledChangesRouter.createCaller(ordinaryUserCtx(db) as never);

    await expect(caller.applyDueChanges()).rejects.toThrow(/Admin privileges required/);

    expect(db.scheduledChange.findMany).not.toHaveBeenCalled();
    expect(db.scheduledChange.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-admin calling getChangesReadyToApply", async () => {
    const db = createMockDb();
    const caller = scheduledChangesRouter.createCaller(ordinaryUserCtx(db) as never);

    await expect(caller.getChangesReadyToApply()).rejects.toThrow(/Admin privileges required/);

    expect(db.scheduledChange.findMany).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when user B applies user A's change, writing nothing", async () => {
    const db = createMockDb();
    db.scheduledChange.findUnique = jest.fn().mockResolvedValue({
      id: "change_1",
      userId: "db_user_a",
      countryId: "country_a",
      changeType: "next_day",
      impactLevel: "low",
      fieldPath: "currentPopulation",
      oldValue: "100",
      newValue: "110",
      scheduledFor: PAST,
      appliedAt: null,
      status: "pending",
      warnings: null,
      metadata: null,
      createdAt: PAST,
      updatedAt: PAST,
    });
    const caller = scheduledChangesRouter.createCaller(ordinaryUserCtx(db, "user_b") as never);

    await expect(caller.applyScheduledChange({ changeId: "change_1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.scheduledChange.updateMany).not.toHaveBeenCalled();
    expect(db.storytellerEffect.create).not.toHaveBeenCalled();
  });
});
