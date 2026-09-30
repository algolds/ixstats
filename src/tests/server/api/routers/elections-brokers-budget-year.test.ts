/**
 * MC-1: the power-broker reader uses the budget in effect: the latest budget year at or before
 * the IxTime budget year, the same basis the builder and the Economy dashboard use.
 */
import { electionsBrokersRouter } from "~/server/api/routers/elections/brokers";
import { createCallerFactory } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("elections.getPowerBrokers budget year", () => {
  const createCaller = createCallerFactory(electionsBrokersRouter);

  afterEach(() => IxTime.clearTimeOverride());

  it("looks up budget years up to currentBudgetYear(), not the real calendar year", async () => {
    IxTime.setTimeOverride(Date.UTC(2042, 5, 1));
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2042 });
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 40, department: { category: "Defense" } },
    ]);
    const caller = createCaller(createMockRouterContext({ db, auth: null }) as any);

    await caller.getPowerBrokers({ countryId: "country_1" });

    const lookup = db.budgetAllocation.findFirst.mock.calls[0]![0];
    expect(lookup.where).toEqual({
      governmentStructure: { countryId: "country_1" },
      budgetYear: { lte: currentBudgetYear() },
    });
    expect(currentBudgetYear()).toBe(2042);
    expect(currentBudgetYear()).not.toBe(new Date().getFullYear());
    expect(db.budgetAllocation.findMany.mock.calls[0]![0].where).toEqual({
      governmentStructure: { countryId: "country_1" },
      budgetYear: 2042,
    });
  });

  it("keeps using last year's budget after the IxTime year rolls over", async () => {
    IxTime.setTimeOverride(Date.UTC(2043, 1, 1));
    const db = createMockPrisma();
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2042 });
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 40, department: { category: "Defense" } },
    ]);
    const caller = createCaller(createMockRouterContext({ db, auth: null }) as any);

    await caller.getPowerBrokers({ countryId: "country_1" });

    expect(db.budgetAllocation.findMany.mock.calls[0]![0].where.budgetYear).toBe(2042);
  });
});
