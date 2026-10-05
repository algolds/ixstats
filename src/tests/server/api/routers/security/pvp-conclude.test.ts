// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect, beforeEach } from "@jest/globals";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { notificationAPI } from "~/lib/notifications/api";
import {
  DEFAULT_PVP_DURATION_IXDAYS,
  computeConflictOutcome,
  militaryStrength,
  pvpConflictEndsAt,
} from "~/lib/military/conflict-outcome";
import { IxTime } from "~/lib/ixtime";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: { systemLog: { create: jest.fn() } },
  isDatabaseReadOnly: false,
}));

const mockGenerateNews = jest
  .spyOn(newsGenerator, "generateDiplomaticNews")
  .mockResolvedValue("post_1" as any);
const mockNotifCreate = jest
  .spyOn(notificationAPI, "create")
  .mockResolvedValue({ success: true } as any);

type MockFn = any;
const DAY = 24 * 60 * 60 * 1000;

const mockDb = {
  user: { findUnique: jest.fn() as MockFn },
  country: { findUnique: jest.fn() as MockFn, findMany: jest.fn() as MockFn },
  militaryConflict: {
    findUnique: jest.fn() as MockFn,
    updateMany: jest.fn() as MockFn,
  },
  militaryBranch: { findMany: jest.fn() as MockFn },
  storytellerEffect: { createMany: jest.fn() as MockFn },
  systemLog: { create: jest.fn() as MockFn },
  auditLog: { create: jest.fn() as MockFn },
};

const contextFor = (userId: string, countryId: string) =>
  ({
    db: mockDb,
    user: { id: userId, countryId, role: { name: "member" } },
    auth: { userId },
    headers: new Headers(),
    rateLimitIdentifier: `test-${userId}`,
  }) as any;

const activeConflict = (startedDaysAgo: number) => ({
  id: "conflict_1",
  type: "pvp",
  status: "active",
  initiatorId: "country_1",
  defenderId: "country_2",
  pvpRules: null,
  startDate: new Date(Date.now() - startedDaysAgo * DAY),
  initiator: { id: "country_1", name: "Aggressorland" },
  defender: { id: "country_2", name: "Defenderland" },
});

const branch = (personnel: number) => ({
  units: [{ personnel, readiness: 100 }],
  assets: [],
});

describe("conflict outcome helpers", () => {
  it("sums personnel x readiness and operational assets", () => {
    expect(
      militaryStrength([
        { units: [{ personnel: 1000, readiness: 50 }], assets: [{ quantity: 2, operational: 3 }] },
      ])
    ).toBe(500 + 60);
  });

  it("is deterministic for a given random source and favours the stronger side", () => {
    const fixed = () => 0.9; // max swing, in the initiator's favour
    expect(computeConflictOutcome(1000, 0, fixed)).toEqual(computeConflictOutcome(1000, 0, fixed));
    expect(computeConflictOutcome(1000, 0, fixed).initiatorWins).toBe(true);
    expect(computeConflictOutcome(0, 1000, () => 0.1).initiatorWins).toBe(false);
  });

  it("ends a PvP conflict after its IxTime duration (default or from the rules)", () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const realDays = (ixDays: number) => (ixDays / IxTime.getDefaultMultiplier()) * DAY;
    expect(pvpConflictEndsAt({ startDate: start, pvpRules: null })!.getTime()).toBe(
      start.getTime() + realDays(DEFAULT_PVP_DURATION_IXDAYS)
    );
    expect(
      pvpConflictEndsAt({ startDate: start, pvpRules: JSON.stringify({ maxDuration: 4 }) })!
    ).toEqual(new Date(start.getTime() + realDays(4)));
    expect(pvpConflictEndsAt({ startDate: null, pvpRules: null })).toBeNull();
  });
});

describe("security.concludePvPConflict", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.systemLog.create.mockResolvedValue({ id: "log_1" });
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.country.findUnique.mockResolvedValue({ id: "country_3", ownerUserId: "someone" });
    mockDb.country.findMany.mockResolvedValue([
      { id: "country_1", owner: { clerkUserId: "user_1" } },
      { id: "country_2", owner: { clerkUserId: "user_2" } },
    ]);
    mockDb.militaryConflict.updateMany.mockResolvedValue({ count: 1 });
    mockDb.storytellerEffect.createMany.mockResolvedValue({ count: 2 });
    mockGenerateNews.mockResolvedValue("post_1" as any);
    mockNotifCreate.mockResolvedValue({ success: true } as any);
  });

  it("resolves a due conflict: writes the outcome, ends it, damages both economies", async () => {
    mockDb.militaryConflict.findUnique.mockResolvedValue(activeConflict(30));
    mockDb.militaryBranch.findMany
      .mockResolvedValueOnce([branch(100_000)])
      .mockResolvedValueOnce([branch(10)]);

    const caller = securityConflictsRouter.createCaller(contextFor("user_2", "country_2"));
    const res = await caller.concludePvPConflict({
      conflictId: "conflict_1",
      countryId: "country_2",
    });

    expect(res.status).toBe("resolved");
    expect(["country_1", "country_2"]).toContain(res.winner);
    const update = mockDb.militaryConflict.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: "conflict_1", status: "active" });
    expect(update.data).toMatchObject({ status: "resolved", winner: res.winner });
    expect(update.data.endDate).toBeInstanceOf(Date);
    expect(mockDb.storytellerEffect.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(mockNotifCreate).toHaveBeenCalledTimes(2);
    expect(mockGenerateNews).toHaveBeenCalledTimes(2);
  });

  it("refuses before the conflict's duration has run", async () => {
    mockDb.militaryConflict.findUnique.mockResolvedValue(activeConflict(1));
    const caller = securityConflictsRouter.createCaller(contextFor("user_1", "country_1"));
    await expect(
      caller.concludePvPConflict({ conflictId: "conflict_1", countryId: "country_1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.militaryConflict.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a country that is not a party, and a caller who does not own the country", async () => {
    mockDb.militaryConflict.findUnique.mockResolvedValue(activeConflict(30));
    const thirdParty = securityConflictsRouter.createCaller(contextFor("user_3", "country_3"));
    await expect(
      thirdParty.concludePvPConflict({ conflictId: "conflict_1", countryId: "country_3" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      thirdParty.concludePvPConflict({ conflictId: "conflict_1", countryId: "country_1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockDb.militaryConflict.updateMany).not.toHaveBeenCalled();
  });

  it("does not resolve twice when the conflict was concluded concurrently", async () => {
    mockDb.militaryConflict.findUnique.mockResolvedValue(activeConflict(30));
    mockDb.militaryBranch.findMany.mockResolvedValue([]);
    mockDb.militaryConflict.updateMany.mockResolvedValue({ count: 0 });
    const caller = securityConflictsRouter.createCaller(contextFor("user_1", "country_1"));
    await expect(
      caller.concludePvPConflict({ conflictId: "conflict_1", countryId: "country_1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.storytellerEffect.createMany).not.toHaveBeenCalled();
  });
});
