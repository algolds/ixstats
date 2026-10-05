/** @jest-environment node */
/**
 * Tax system router: create, update and delete need write access to the target country (its
 * player, its owner, or staff); brackets are validated before anything is written; a create on
 * a country that already has a tax system falls back to an update.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/server/services/builderIntegrationService", () => ({
  __esModule: true,
  detectTaxConflicts: jest.fn().mockResolvedValue([]),
  syncTaxData: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onTaxSystemChange: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { taxSystemRouter } from "~/server/api/routers/taxSystem";
import { detectTaxConflicts, syncTaxData } from "~/server/services/builderIntegrationService";
import { notificationHooks } from "~/lib/notifications/hooks";
import { ConflictError } from "~/lib/app-error";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(taxSystemRouter);

const COUNTRY = "country_a";

type Who = "player" | "stranger" | "admin";

function callerAs(who: Who | null, db: MockPrismaProxy) {
  if (!who) {
    return createCaller(createMockRouterContext({ db, auth: null, user: null }) as never);
  }
  return createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${who}` },
      user: {
        id: who,
        clerkUserId: `clerk_${who}`,
        countryId: who === "player" ? COUNTRY : "country_b",
        role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
      },
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

function taxState(brackets: Array<{ minIncome: number; maxIncome?: number; rate: number }> = []) {
  return {
    taxSystem: {
      taxSystemName: "National Revenue",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
    },
    categories: [
      {
        categoryName: "Income",
        categoryType: "income",
        isActive: true,
        calculationMethod: "progressive" as const,
        deductionAllowed: true,
        priority: 1,
      },
    ],
    brackets: {
      "0": brackets.map((b, i) => ({ ...b, marginalRate: true, isActive: true, priority: i + 1 })),
    },
    exemptions: [],
    deductions: {},
    selectedAtomicTaxComponents: [] as string[],
  };
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  // A stranger's fresh lookup finds their own (other) country; the target exists and is not theirs.
  db.user.findUnique.mockResolvedValue({ id: "stranger", countryId: "country_b", role: null });
  db.country.findUnique.mockResolvedValue({ id: COUNTRY, ownerUserId: "someone_else" });
  db.taxSystem.create.mockResolvedValue({ id: "ts1", countryId: COUNTRY, taxCategories: [] });
  db.taxSystem.update.mockResolvedValue({ id: "ts1", countryId: COUNTRY, taxCategories: [] });
});

describe("write access", () => {
  it("rejects signed-out callers", async () => {
    await expect(
      callerAs(null, db).create({ countryId: COUNTRY, data: taxState() })
    ).rejects.toThrow(/Authentication required/);
  });

  it("refuses a player writing another country's tax system", async () => {
    const stranger = callerAs("stranger", db);
    await expect(stranger.create({ countryId: COUNTRY, data: taxState() })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(stranger.update({ countryId: COUNTRY, data: taxState() })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(stranger.delete({ countryId: COUNTRY })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.taxSystem.create).not.toHaveBeenCalled();
    expect(db.taxSystem.upsert).not.toHaveBeenCalled();
    expect(db.taxSystem.delete).not.toHaveBeenCalled();
  });

  it("lets the country's owner write it even when it is not their active nation", async () => {
    db.country.findUnique.mockResolvedValue({ id: COUNTRY, ownerUserId: "stranger" });

    await callerAs("stranger", db).delete({ countryId: COUNTRY });

    expect(db.taxSystem.delete).toHaveBeenCalledWith({ where: { countryId: COUNTRY } });
  });

  it("lets staff write any country", async () => {
    await callerAs("admin", db).delete({ countryId: COUNTRY });
    expect(db.taxSystem.delete).toHaveBeenCalledWith({ where: { countryId: COUNTRY } });
  });

  it("reports an unknown country as not found", async () => {
    db.country.findUnique.mockResolvedValue(null);
    await expect(callerAs("stranger", db).delete({ countryId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("create", () => {
  it("saves the player's tax system, syncs it and notifies", async () => {
    const result = await callerAs("player", db).create({
      countryId: COUNTRY,
      data: taxState([{ minIncome: 0, maxIncome: 10000, rate: 10 }]),
    });

    expect(db.taxSystem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ countryId: COUNTRY, taxSystemName: "National Revenue" }),
      })
    );
    expect(detectTaxConflicts).toHaveBeenCalled();
    expect(syncTaxData).toHaveBeenCalledWith(db as never, COUNTRY, expect.any(Object));
    expect(notificationHooks.onTaxSystemChange).toHaveBeenCalledWith(
      expect.objectContaining({ countryId: COUNTRY, changeType: "created" })
    );
    expect(result).toMatchObject({ taxSystem: { id: "ts1" }, warnings: [] });
  });

  it("returns bracket errors without writing anything", async () => {
    const result = await callerAs("player", db).create({
      countryId: COUNTRY,
      data: taxState([
        { minIncome: 0, maxIncome: 20000, rate: 10 },
        { minIncome: 10000, maxIncome: 50000, rate: 20 },
      ]),
    });

    expect(result.taxSystem).toBeNull();
    expect((result as { errors: Array<{ message: string }> }).errors[0]!.message).toMatch(
      /overlaps previous bracket/
    );
    expect(db.taxSystem.create).not.toHaveBeenCalled();
    expect(syncTaxData).not.toHaveBeenCalled();
  });

  it("rejects a bracket rate above 100 at input validation", async () => {
    await expect(
      callerAs("player", db).create({
        countryId: COUNTRY,
        data: taxState([{ minIncome: 0, rate: 150 }]),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("falls back to an update when the country already has a tax system", async () => {
    db.taxSystem.create.mockRejectedValue(new ConflictError("exists"));
    db.taxSystem.findMany.mockResolvedValue([{ id: "ts1" }]);

    await callerAs("player", db).create({ countryId: COUNTRY, data: taxState() });

    expect(db.taxCategory.deleteMany).toHaveBeenCalledWith({
      where: { taxSystemId: { in: ["ts1"] } },
    });
    expect(db.taxSystem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: COUNTRY } })
    );
  });

  it("skips conflict detection when asked", async () => {
    await callerAs("player", db).create({
      countryId: COUNTRY,
      data: taxState(),
      skipConflictCheck: true,
    });
    expect(detectTaxConflicts).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("creates the row if missing, then replaces categories and atomic components", async () => {
    db.taxSystem.findMany.mockResolvedValue([{ id: "ts1" }]);
    const data = { ...taxState(), selectedAtomicTaxComponents: [] };

    await callerAs("player", db).update({ countryId: COUNTRY, data });

    expect(db.taxSystem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: COUNTRY }, update: {} })
    );
    expect(db.taxCategory.deleteMany).toHaveBeenCalled();
    expect(db.taxComponent.deleteMany).toHaveBeenCalledWith({ where: { countryId: COUNTRY } });
    expect(db.taxComponent.createMany).not.toHaveBeenCalled();
    expect(notificationHooks.onTaxSystemChange).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "updated" })
    );
  });
});

describe("getByCountryId", () => {
  it("returns null when the country has no tax system", async () => {
    db.taxSystem.findUnique.mockResolvedValue(null);
    await expect(callerAs(null, db).getByCountryId({ countryId: COUNTRY })).resolves.toBeNull();
  });

  it("maps stored categories and brackets back to builder state", async () => {
    db.taxSystem.findUnique.mockResolvedValue({
      taxSystemName: "National Revenue",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
      taxCategories: [
        {
          categoryName: "Income",
          categoryType: "income",
          calculationMethod: "progressive",
          taxBrackets: [{ minIncome: 0, maxIncome: null, rate: 15, marginalRate: true }],
          taxExemptions: [],
          taxDeductions: [],
        },
      ],
    });

    const state = await callerAs(null, db).getByCountryId({ countryId: COUNTRY });

    expect(state?.categories).toEqual([expect.objectContaining({ categoryName: "Income" })]);
    expect(state?.brackets["0"]).toEqual([
      expect.objectContaining({ minIncome: 0, maxIncome: undefined, rate: 15 }),
    ]);
  });
});
