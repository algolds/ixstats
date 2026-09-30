/**
 * MC-1 follow-up: `government.startBudgetYear` copies the budget in effect into the current
 * IxTime year, and only for a country the caller may write to.
 */
import { describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { governmentRouter } from "~/server/api/routers/government";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const createCaller = createCallerFactory(governmentRouter);

function budgetDb() {
  return {
    budgetAllocation: {
      findFirst: jest.fn().mockResolvedValue({ budgetYear: 2000 }),
      findMany: jest.fn().mockResolvedValue([
        {
          governmentStructureId: "gov_1",
          departmentId: "dept_1",
          allocatedAmount: 100,
          allocatedPercent: 10,
          notes: null,
        },
      ]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe("government.startBudgetYear", () => {
  it("rejects a country the caller doesn't own and writes nothing", async () => {
    const db = budgetDb();
    const caller = createCaller(createIdorContext(db) as never);

    await expect(caller.startBudgetYear({ countryId: FOREIGN_COUNTRY })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.budgetAllocation.createMany).not.toHaveBeenCalled();
  });

  it("copies the budget in effect for the caller's own country", async () => {
    const db = budgetDb();
    const caller = createCaller(createIdorContext(db) as never);

    const result = await caller.startBudgetYear({ countryId: CALLER_COUNTRY });

    expect(result).toMatchObject({ fromYear: 2000, created: 1 });
    expect(db.budgetAllocation.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });
});
