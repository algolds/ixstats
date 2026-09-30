/**
 * MC-1: the power-broker reader filters budget allocations on the IxTime budget year, the
 * same basis the builder and the Economy dashboard write and read.
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

  it("queries allocations for currentBudgetYear(), not the real calendar year", async () => {
    IxTime.setTimeOverride(Date.UTC(2042, 5, 1));
    const db = createMockPrisma();
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 40, department: { category: "Defense" } },
    ]);
    const caller = createCaller(createMockRouterContext({ db, auth: null }) as any);

    await caller.getPowerBrokers({ countryId: "country_1" });

    expect(db.budgetAllocation.findMany).toHaveBeenCalledTimes(1);
    const { where } = db.budgetAllocation.findMany.mock.calls[0]![0];
    expect(where).toEqual({
      governmentStructure: { countryId: "country_1" },
      budgetYear: currentBudgetYear(),
    });
    expect(where.budgetYear).toBe(2042);
    expect(where.budgetYear).not.toBe(new Date().getFullYear());
  });
});
