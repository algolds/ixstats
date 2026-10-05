/** @jest-environment node */
/**
 * MC-1 follow-up: after the IxTime year rolls over, the latest budget stays in effect, the owner
 * is reminded once, and "Start FY budget" copies the budget in effect into the new year.
 */
jest.mock("~/lib/notifications", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("notif_1") },
}));

import { describe, expect, it, beforeEach } from "@jest/globals";
import { latestBudgetYearUpTo } from "~/lib/government/budget-year";
import {
  findEffectiveBudgetYear,
  loadEffectiveBudget,
  rollBudgetForward,
} from "~/lib/government/budget-allocations";
import { runBudgetYearRollover } from "~/lib/government/budget-year-rollover-cron";
import { notificationAPI } from "~/lib/notifications";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const notifyMock = jest.mocked(notificationAPI.create);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("latestBudgetYearUpTo", () => {
  it("picks the latest year at or before the current one", () => {
    expect(latestBudgetYearUpTo([2041, 2042], 2043)).toBe(2042);
    expect(latestBudgetYearUpTo([2042, 2043], 2043)).toBe(2043);
  });

  it("ignores future years and returns null with no budget", () => {
    expect(latestBudgetYearUpTo([2044], 2043)).toBeNull();
    expect(latestBudgetYearUpTo([], 2043)).toBeNull();
  });
});

describe("loadEffectiveBudget", () => {
  it("carries the previous year's allocations forward after a rollover", async () => {
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2042 });
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 30, department: { category: "Defense" } },
    ]);

    const budget = await loadEffectiveBudget(db as never, "country_1", { currentYear: 2043 });

    expect(db.budgetAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { governmentStructure: { countryId: "country_1" }, budgetYear: { lte: 2043 } },
        orderBy: { budgetYear: "desc" },
      })
    );
    expect(db.budgetAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { governmentStructure: { countryId: "country_1" }, budgetYear: 2042 },
      })
    );
    expect(budget).toMatchObject({ budgetYear: 2042, currentYear: 2043, carriedForward: true });
    expect(budget.allocations).toHaveLength(1);
  });

  it("returns no allocations for a country with no budget", async () => {
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue(null);

    const budget = await loadEffectiveBudget(db as never, "country_1", { currentYear: 2043 });

    expect(budget).toMatchObject({ budgetYear: null, carriedForward: false, allocations: [] });
    expect(db.budgetAllocation.findMany).not.toHaveBeenCalled();
  });
});

describe("rollBudgetForward", () => {
  it("copies the budget in effect into the new year without overwriting existing rows", async () => {
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2042 });
    db.budgetAllocation.findMany.mockResolvedValue([
      {
        governmentStructureId: "gov_1",
        departmentId: "dept_1",
        allocatedAmount: 500,
        allocatedPercent: 25,
        notes: null,
      },
    ]);
    db.budgetAllocation.createMany.mockResolvedValue({ count: 1 });

    const result = await rollBudgetForward(db as never, "country_1", 2043);

    expect(db.budgetAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ budgetYear: { lte: 2042 } }) })
    );
    expect(db.budgetAllocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          governmentStructureId: "gov_1",
          departmentId: "dept_1",
          budgetYear: 2043,
          allocatedAmount: 500,
          allocatedPercent: 25,
          availableAmount: 500,
          notes: null,
        },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ fromYear: 2042, toYear: 2043, created: 1 });
  });

  it("does nothing when there is no earlier budget", async () => {
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue(null);

    await expect(rollBudgetForward(db as never, "country_1", 2043)).resolves.toEqual({
      fromYear: null,
      toYear: 2043,
      created: 0,
    });
    expect(db.budgetAllocation.createMany).not.toHaveBeenCalled();
  });

  it("finds the year before the target", async () => {
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2040 });

    await expect(findEffectiveBudgetYear(db as never, "c", 2042)).resolves.toBe(2040);
  });
});

describe("runBudgetYearRollover", () => {
  function setup(existingNotification: unknown = null) {
    const db = createMockPrisma();
    db.budgetAllocation.groupBy.mockResolvedValue([
      { governmentStructureId: "gov_behind", _max: { budgetYear: 2042 } },
      { governmentStructureId: "gov_current", _max: { budgetYear: 2043 } },
    ]);
    db.governmentStructure.findMany.mockResolvedValue([
      { id: "gov_behind", countryId: "country_behind" },
    ]);
    db.notification.findFirst.mockResolvedValue(existingNotification);
    return db;
  }

  it("reminds each owned country that has no budget for the new year", async () => {
    const db = setup();

    const result = await runBudgetYearRollover(db as never, 2043);

    expect(db.governmentStructure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["gov_behind"] }, country: { ownerUserId: { not: null } } },
      })
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        countryId: "country_behind",
        source: "budgetYear",
        href: "/mycountry/economy",
        actionable: true,
        metadata: { budgetYear: 2043, carriedForwardFrom: 2042 },
      })
    );
    expect(result).toMatchObject({ countriesBehind: 1, notified: 1, alreadyNotified: 0 });
  });

  it("notifies a country only once per budget year", async () => {
    const db = setup({ id: "notif_existing" });

    const result = await runBudgetYearRollover(db as never, 2043);

    expect(db.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          countryId: "country_behind",
          source: "budgetYear",
          metadata: { contains: '"budgetYear":2043' },
        },
      })
    );
    expect(notifyMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ notified: 0, alreadyNotified: 1 });
  });

  it("does nothing when every budget is current", async () => {
    const db = setup();
    db.budgetAllocation.groupBy.mockResolvedValue([
      { governmentStructureId: "gov_current", _max: { budgetYear: 2043 } },
    ]);

    const result = await runBudgetYearRollover(db as never, 2043);

    expect(db.governmentStructure.findMany).not.toHaveBeenCalled();
    expect(result.countriesBehind).toBe(0);
  });

  it("keeps going when one notification fails", async () => {
    const db = setup();
    notifyMock.mockRejectedValueOnce(new Error("Notification suppressed"));

    const result = await runBudgetYearRollover(db as never, 2043);

    expect(result).toMatchObject({ notified: 0, failed: 1 });
  });
});
