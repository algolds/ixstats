/** @jest-environment node */
/**
 * P0-05: the Defense budget is a real `DefenseBudget` row. The owner saves it through the premium
 * `security.upsertDefenseBudget`; it is read back by country with no real-world year filter.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));

import { createCallerFactory } from "~/server/api/trpc";
import { securityDefenseRouter } from "~/server/api/routers/security/defense";
import {
  defenseAllocationPercent,
  estimateDefenseBudget,
  formatAmountInput,
  parseAmountInput,
} from "~/lib/military/defense-budget";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const OWN = "country_1";
const USERS = {
  owner: { id: "u_owner", countryId: OWN, membershipTier: "mycountry_premium", role: null },
  stranger: {
    id: "u_other",
    countryId: "country_2",
    membershipTier: "mycountry_premium",
    role: null,
  },
  free: { id: "u_free", countryId: OWN, membershipTier: "basic", role: null },
} as const;
type Who = keyof typeof USERS;

let db: MockPrismaProxy;
let calls = 0;
const caller = (who: Who) => {
  const user = { ...USERS[who], clerkUserId: `clerk_${USERS[who].id}` };
  return createCallerFactory(securityDefenseRouter)(
    createMockCallerContext({
      db,
      user,
      auth: { userId: user.clerkUserId },
      rateLimitIdentifier: `defense-budget-${who}-${++calls}`,
    })
  );
};

const budget = {
  countryId: OWN,
  totalBudget: 10e9,
  personnelCosts: 4e9,
  operationsMaintenance: 3e9,
  procurement: 1.5e9,
  rdteCosts: 1e9,
  militaryConstruction: 0.5e9,
};

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockImplementation(async ({ where }: { where: { clerkUserId?: string } }) =>
    where.clerkUserId === "clerk_u_other"
      ? { id: "u_other", countryId: "country_2", role: { name: "member" } }
      : null
  );
  db.country.findUnique.mockResolvedValue({
    id: OWN,
    ownerUserId: "u_owner",
    currentTotalGdp: 500e9,
    currentPopulation: 10_000_000,
  });
  db.defenseBudget.upsert.mockImplementation(async ({ create }: { create: object }) => create);
});

describe("security.upsertDefenseBudget", () => {
  it("upserts the nation's one row, with share of GDP and per capita from the server", async () => {
    await caller("owner").upsertDefenseBudget(budget);
    const args = db.defenseBudget.upsert.mock.calls[0]![0];
    expect(args.where).toEqual({ countryId: OWN });
    expect(args.update).toMatchObject({ totalBudget: 10e9, gdpPercent: 2, perCapita: 1000 });
    expect(args.create).toMatchObject({ countryId: OWN, personnelCosts: 4e9 });
    expect(typeof args.update.fiscalYear).toBe("number");
  });

  it("is refused for another nation's player and for a free nation", async () => {
    await expect(caller("stranger").upsertDefenseBudget(budget)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller("free").upsertDefenseBudget(budget)).rejects.toThrow(/Premium/);
    expect(db.defenseBudget.upsert).not.toHaveBeenCalled();
  });

  it("refuses categories that add up to more than the total", async () => {
    await expect(
      caller("owner").upsertDefenseBudget({ ...budget, procurement: 9e9 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.defenseBudget.upsert).not.toHaveBeenCalled();
  });
});

it("security.getDefenseBudget reads the row by country, with no year filter", async () => {
  db.defenseBudget.findUnique.mockResolvedValue({ countryId: OWN, totalBudget: 1 });
  await caller("owner").getDefenseBudget({ countryId: OWN });
  expect(db.defenseBudget.findUnique).toHaveBeenCalledWith({ where: { countryId: OWN } });
});

describe("defense budget helpers", () => {
  it("estimates 2% of GDP split 40/30/15/10/5", () => {
    expect(estimateDefenseBudget(1000)).toEqual({
      totalBudget: 20,
      personnelCosts: 8,
      operationsMaintenance: 6,
      procurement: 3,
      rdteCosts: 2,
      militaryConstruction: 1,
    });
  });

  it("reads a fully allocated budget as 100%, not over budget, despite float drift", () => {
    // The 2% estimate's categories sum to 100.00000000000003% of this total
    const saved = estimateDefenseBudget(661814081.1318916 / 0.02);
    const raw =
      (saved.personnelCosts +
        saved.operationsMaintenance +
        saved.procurement +
        saved.rdteCosts +
        saved.militaryConstruction) /
      saved.totalBudget;
    expect(raw * 100).toBeGreaterThan(100);
    expect(defenseAllocationPercent(saved)).toBe(100);
    expect(
      defenseAllocationPercent({ ...saved, procurement: saved.procurement + saved.totalBudget / 100 })
    ).toBeCloseTo(101, 9);
    expect(defenseAllocationPercent({ ...saved, totalBudget: 0 })).toBe(0);
  });

  it("shows an amount with separators, not a raw float, and reads it back", () => {
    expect(formatAmountInput(5668857676.361599)).toBe("5,668,857,676");
    expect(parseAmountInput("5,668,857,676")).toBe(5668857676);
    expect(parseAmountInput("")).toBe(0);
  });
});
