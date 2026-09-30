import { governmentRouter } from "~/server/api/routers/government";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const data = {
  structure: {
    governmentName: "Test Government",
    governmentType: "Federal Republic" as const,
    totalBudget: 1000,
    fiscalYear: "2026",
    budgetCurrency: "USD",
  },
  departments: [],
  budgetAllocations: [],
  revenueSources: [],
};

/** The transaction is the first write; reaching it proves the caller passed the check. */
function governmentDb(existingStructure: object | null = null) {
  return {
    governmentStructure: {
      findUnique: jest.fn().mockResolvedValue(existingStructure),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockRejectedValue(new Error("write path reached")),
  };
}

describe("Plan 332: government structure mutations require country ownership", () => {
  describe.each(["create", "update"] as const)("government.%s", (procedure) => {
    it("rejects a member writing another country's structure", async () => {
      const db = governmentDb();
      const caller = governmentRouter.createCaller(createIdorContext(db));

      await expect(
        caller[procedure]({ countryId: FOREIGN_COUNTRY, data, skipConflictCheck: true })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.governmentStructure.findUnique).not.toHaveBeenCalled();
    });

    it("lets the owner reach the write", async () => {
      const db = governmentDb();
      const caller = governmentRouter.createCaller(createIdorContext(db));

      await expect(
        caller[procedure]({ countryId: CALLER_COUNTRY, data, skipConflictCheck: true })
      ).rejects.toThrow("write path reached");
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("lets an admin reach the write on a foreign country", async () => {
      const db = governmentDb();
      const caller = governmentRouter.createCaller(createIdorContext(db, "admin"));

      await expect(
        caller[procedure]({ countryId: FOREIGN_COUNTRY, data, skipConflictCheck: true })
      ).rejects.toThrow("write path reached");
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  it("government.create still reports CONFLICT to the owner when a structure exists", async () => {
    const db = governmentDb({ id: "gs_1", countryId: CALLER_COUNTRY });
    const caller = governmentRouter.createCaller(createIdorContext(db));

    await expect(
      caller.create({ countryId: CALLER_COUNTRY, data, skipConflictCheck: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
