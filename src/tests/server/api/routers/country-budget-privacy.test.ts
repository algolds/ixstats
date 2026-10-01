/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-outcome.test.ts): the
// hoisted jest.mock() factories rely on the ambient global.
//
// Budgets are private (country-private-record.test.ts covers the rest of the owner's side).
// Readers that serve visitors too strip the budget for anyone but the nation's owner and
// privileged roles; readers that only exist for the owner refuse everyone else. Each is
// checked for the owner, another player, an admin (the dev "view as" toolbar is system-owner
// only, which is privileged the same way) and a signed-out caller.
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
jest.mock("~/server/shared/mycountry-helpers", () => {
  const actual = jest.requireActual("~/server/shared/mycountry-helpers");
  return {
    __esModule: true,
    ...actual,
    loadVitalityExtras: jest.fn(async () => ({})),
    calculateVitalityScores: jest.fn(() => ({ overallScore: 70 })),
  };
});
jest.mock("~/lib/economy/budget-vault-calculator", () => ({
  __esModule: true,
  budgetVaultCalculator: {
    calculateBudgetMultiplier: jest.fn(async () => 1.2),
    getMultiplierDescription: jest.fn(() => "Boosted"),
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { governmentCrudRouter } from "~/server/api/routers/government/crud";
import { governmentComponentsRouter } from "~/server/api/routers/government/components";
import { myCountryDashboardRouter } from "~/server/api/routers/mycountry/dashboard";
import { electionsBrokersRouter } from "~/server/api/routers/elections/brokers";
import { securityDefenseRouter } from "~/server/api/routers/security/defense";
import { securityMilitaryRouter } from "~/server/api/routers/security/military";
import { diplomaticEmbassiesQueriesEmbassyListingsRouter } from "~/server/api/routers/diplomacy/embassies/queries/embassyListings";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { transportRouteQueriesRouter } from "~/server/api/routers/transport/routeQueries";
import { budgetVaultCalculator } from "~/lib/economy/budget-vault-calculator";
import { globalCache } from "~/lib/cache";
import { isBudgetLedgerRow, redactEconomicBudget } from "~/lib/country/public-record";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "country_owned";
const THIRD = "country_third";

// Budget figures that must never reach a visitor.
const TOTAL_BUDGET = 1_234_000_000_000;
const DEPT_ALLOCATION = 617_000_000_000;
const REVENUE = 456_000_000_000;

const STRUCTURE = {
  id: "gov_1",
  countryId: COUNTRY,
  governmentName: "Grand Council",
  governmentType: "Republic",
  headOfState: "President Ada",
  headOfGovernment: "Chancellor Bo",
  legislatureName: "Senate",
  executiveName: "Cabinet",
  judicialName: "High Court",
  totalBudget: TOTAL_BUDGET,
  fiscalYear: "Calendar Year",
  budgetCurrency: "USD",
  politicalStability: 0.6,
  departments: [
    {
      id: "dept_defense",
      name: "Ministry of Defense",
      category: "Defense",
      minister: "Gen. Cy",
      budgetAllocations: [
        { id: "alloc_1", allocatedAmount: DEPT_ALLOCATION, allocatedPercent: 50 },
      ],
      subBudgets: [{ id: "sub_1", amount: DEPT_ALLOCATION, percent: 50 }],
    },
  ],
  budgetAllocations: [{ id: "alloc_1", allocatedAmount: DEPT_ALLOCATION, allocatedPercent: 50 }],
  revenueSources: [{ id: "rev_1", name: "Income tax", revenueAmount: REVENUE }],
  branches: [{ id: "branch_1", name: "Senate", branchType: "legislative" }],
};

const COUNTRY_ROW = {
  id: COUNTRY,
  ownerUserId: "owner_db",
  name: "Owned",
  lastCalculated: new Date(0),
  baselineDate: new Date(0),
  governmentBudget: { spendingCategories: '{"Defense":50}', spendingEfficiency: 0.8 },
  fiscalSystem: { salesTaxRate: 12, spendingByCategory: '{"Defense":50}' },
};

const intentRow = (id: string, status: string, tier = "measured") => ({ id, status, tier });
const INTENTS = [
  intentRow("in_force", "active"),
  intentRow("draft", "proposed", "proposed"),
  intentRow("withdrawn", "abandoned"),
];

const at = new Date();
const ledger = (id: string, extra: Record<string, unknown>) => ({
  id,
  description: `ledger ${id}`,
  deltaValue: 1,
  targetModel: "Country",
  targetField: "publicApproval",
  sourceType: "decision",
  sourceId: null,
  createdAt: at,
  ...extra,
});

const embassyRow = (id: string, hostCountryId: string, guestCountryId: string) => ({
  id,
  name: `Embassy ${id}`,
  hostCountryId,
  guestCountryId,
  hostCountry: { id: hostCountryId, name: hostCountryId, flag: null, slug: hostCountryId },
  guestCountry: { id: guestCountryId, name: guestCountryId, flag: null, slug: guestCountryId },
  status: "active",
  staffCount: 5,
  services: null,
  establishedAt: at,
  level: 1,
  experience: 0,
  influence: 10,
  budget: 75_000,
  maintenanceCost: 2_500,
  securityLevel: "standard",
  specialization: null,
  specializationLevel: 0,
  lastMaintenancePaid: at,
  updatedAt: at,
  ambassadorName: null,
  location: null,
});

function makeDb({ ownerUserId = "owner_db" }: { ownerUserId?: string } = {}) {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) =>
        where.clerkUserId === "owner_clerk"
          ? { id: "owner_db", countryId: COUNTRY, role: { name: "member" } }
          : where.clerkUserId === "admin_clerk"
            ? { id: "admin_db", countryId: null, role: { name: "admin" } }
            : { id: "other_db", countryId: "country_other", role: { name: "member" } }
      ),
      update: jest.fn(async () => ({})),
    },
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === COUNTRY ? { ...COUNTRY_ROW, ownerUserId } : null
      ),
      findMany: jest.fn(
        async ({ where }: { where: { id: { in: string[] }; ownerUserId: string } }) =>
          where.id.in.includes(COUNTRY) && where.ownerUserId === ownerUserId
            ? [{ id: COUNTRY }]
            : []
      ),
    },
    governmentStructure: { findUnique: jest.fn(async () => structuredClone(STRUCTURE)) },
    governmentComponent: { findMany: jest.fn(async () => []) },
    economicComponent: { findMany: jest.fn(async () => []) },
    taxComponent: { findMany: jest.fn(async () => []) },
    budgetAllocation: {
      findFirst: jest.fn(async () => ({ budgetYear: 2040 })),
      findMany: jest.fn(async () => [
        { allocatedPercent: 40, department: { category: "Defense" } },
      ]),
    },
    defenseBudget: { findFirst: jest.fn(async () => ({ totalBudget: 9e9 })) },
    transportRoute: {
      findMany: jest.fn(async () => [
        {
          id: "road_1",
          name: "Coast road",
          routeType: "highway",
          lengthKm: 100,
          terrainDifficulty: 1,
          status: "operational",
          properties: { maintenanceCost: 4 },
        },
      ]),
    },
    transportHub: { findMany: jest.fn(async () => []) },
    city: { findMany: jest.fn(async () => []) },
    governmentBudget: {
      findUnique: jest.fn(async () => ({
        spendingCategories: '[{"category":"Infrastructure","amount":3}]',
      })),
    },
    militaryBranch: {
      findMany: jest.fn(async () => [
        { id: "army", name: "Army", annualBudget: 9e9, budgetPercent: 12, units: [], assets: [] },
      ]),
    },
    embassy: {
      findMany: jest.fn(async () => [
        embassyRow("ours", THIRD, COUNTRY), // run by the owned nation, hosted abroad
        embassyRow("theirs", COUNTRY, THIRD), // a third nation's mission in the owned nation
      ]),
    },
    storytellerEffect: {
      findMany: jest.fn(async () => [
        {
          id: "eff_public",
          description: "Directive: Build ports",
          inputType: "gdp_level_adjustment",
          ixTimeTimestamp: at,
          createdBy: "intent:in_force",
        },
        {
          id: "eff_private",
          description: "Directive: Secret plan",
          inputType: "gdp_level_adjustment",
          ixTimeTimestamp: at,
          createdBy: "intent:withdrawn",
        },
      ]),
    },
    diplomaticEvent: { findMany: jest.fn(async () => []) },
    nationalIssue: { findMany: jest.fn(async () => []) },
    countryChangeLog: {
      findMany: jest.fn(async () => [
        ledger("enacted", { sourceId: "in_force" }),
        ledger("abandoned", {
          sourceId: "withdrawn",
          targetModel: null,
          targetField: null,
          description: "Intent (measured): Secret plan",
        }),
        ledger("drafted", { sourceId: "draft" }),
        ledger("deleted", { sourceId: "gone" }),
        ledger("maintenance", {
          sourceType: "policy",
          targetModel: "GovernmentStructure",
          targetField: "totalBudget",
          description: "Total budget ↓ 1,234 → 1,200",
        }),
        ledger("issue", { sourceType: "issue", sourceId: "issue_1" }),
      ]),
    },
    intent: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        INTENTS.filter((i) => where.id.in.includes(i.id))
      ),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

const signedOut = (db: Db) => createMockRouterContext({ db, auth: null, user: null }) as never;
const owner = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "owner_clerk" },
    user: {
      id: "owner_db",
      clerkUserId: "owner_clerk",
      countryId: COUNTRY,
      role: { name: "member" },
    },
  }) as never;
const otherPlayer = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "other_clerk" },
    user: {
      id: "other_db",
      clerkUserId: "other_clerk",
      countryId: "country_other",
      role: { name: "member" },
    },
  }) as never;
const admin = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "admin_clerk" },
    user: { id: "admin_db", clerkUserId: "admin_clerk", countryId: null, role: { name: "admin" } },
  }) as never;

type Ctx = (db: Db) => never;
type Call = (ctx: never) => Promise<unknown>;

const government = createCallerFactory(governmentCrudRouter);
const governmentComponents = createCallerFactory(governmentComponentsRouter);
const mycountry = createCallerFactory(myCountryDashboardRouter);
const brokers = createCallerFactory(electionsBrokersRouter);
const defense = createCallerFactory(securityDefenseRouter);
const military = createCallerFactory(securityMilitaryRouter);
const embassies = createCallerFactory(diplomaticEmbassiesQueriesEmbassyListingsRouter);
const vault = createCallerFactory(vaultBalanceCreditsRouter);
const transport = createCallerFactory(transportRouteQueriesRouter);

const OWNERS: Array<[string, Ctx]> = [
  ["the owner", owner],
  ["an admin", admin],
];
const VISITORS: Array<[string, Ctx]> = [
  ["another player", otherPlayer],
  ["a signed-out visitor", signedOut],
];

let warn: ReturnType<typeof jest.spyOn>;
let error: ReturnType<typeof jest.spyOn>;
const cache = new Map<string, unknown>();
beforeEach(() => {
  jest.clearAllMocks();
  cache.clear();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  error = jest.spyOn(console, "error").mockImplementation(() => {});
  jest
    .spyOn(globalCache, "get")
    .mockImplementation((async (key: string) => cache.get(key) ?? null) as never);
  jest.spyOn(globalCache, "set").mockImplementation((async (key: string, value: unknown) => {
    cache.set(key, value);
  }) as never);
});
afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
  jest.restoreAllMocks();
});

// ─── Government structure ───────────────────────────────────────────────────

describe.each([
  [
    "government.getByCountryId",
    (ctx: never) => government(ctx).getByCountryId({ countryId: COUNTRY }),
  ],
  [
    "government.getFullByCountryId",
    (ctx: never) => government(ctx).getFullByCountryId({ countryId: COUNTRY }),
  ],
] as Array<[string, Call]>)("%s", (_name, call) => {
  it.each(VISITORS)("serves %s the structure without its budget", async (_who, ctxFor) => {
    const res = (await call(ctxFor(makeDb()))) as Record<string, any>;
    expect(res).not.toHaveProperty("totalBudget");
    expect(res.budgetAllocations).toEqual([]);
    expect(res.revenueSources).toEqual([]);
    expect(res.departments[0]).toMatchObject({
      name: "Ministry of Defense",
      minister: "Gen. Cy",
      budgetAllocations: [],
      subBudgets: [],
    });
    expect(res).toMatchObject({
      governmentName: "Grand Council",
      headOfState: "President Ada",
      legislatureName: "Senate",
      branches: [{ name: "Senate" }],
    });
    const json = JSON.stringify(res);
    for (const figure of [TOTAL_BUDGET, DEPT_ALLOCATION, REVENUE]) {
      expect(json).not.toContain(String(figure));
    }
  });

  it.each(OWNERS)("serves %s the full budget", async (_who, ctxFor) => {
    const res = (await call(ctxFor(makeDb()))) as Record<string, any>;
    expect(res.totalBudget).toBe(TOTAL_BUDGET);
    expect(res.budgetAllocations).toHaveLength(1);
    expect(res.revenueSources).toHaveLength(1);
    expect(res.departments[0].budgetAllocations).toHaveLength(1);
  });

  it("serves an owner who is not acting as the nation (Country.ownerUserId)", async () => {
    const res = (await call(otherPlayer(makeDb({ ownerUserId: "other_db" })))) as Record<
      string,
      any
    >;
    expect(res.totalBudget).toBe(TOTAL_BUDGET);
  });

  it("does not look anyone up for a signed-out visitor", async () => {
    const db = makeDb();
    await call(signedOut(db));
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("government.checkConflicts", () => {
  const data = {
    structure: {
      governmentName: "Grand Council",
      governmentType: "Federal Republic" as const,
      totalBudget: 1,
      fiscalYear: "Calendar Year",
      budgetCurrency: "USD",
    },
    departments: [],
    budgetAllocations: [],
    revenueSources: [],
  };

  it("is FORBIDDEN for another player (its warnings quote the stored budget)", async () => {
    const db = makeDb();
    await expect(
      government(otherPlayer(db)).checkConflicts({ countryId: COUNTRY, data })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.governmentStructure.findUnique).not.toHaveBeenCalled();
  });

  it("quotes the stored budget to the owner", async () => {
    const res = await government(owner(makeDb())).checkConflicts({ countryId: COUNTRY, data });
    expect(res.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ currentValue: TOTAL_BUDGET })])
    );
  });
});

// ─── Owner-only readers ─────────────────────────────────────────────────────

/** The call, and the budget read that must not happen for a refused caller. */
const OWNER_ONLY: Array<[string, Call, (db: Db) => jest.Mock]> = [
  [
    "elections.getPowerBrokers",
    (ctx) => brokers(ctx).getPowerBrokers({ countryId: COUNTRY }),
    (db) => db.budgetAllocation.findMany,
  ],
  [
    "security.getDefenseBudget",
    (ctx) => defense(ctx).getDefenseBudget({ countryId: COUNTRY }),
    (db) => db.defenseBudget.findFirst,
  ],
  [
    "government.getCivilServiceStatus",
    (ctx) => governmentComponents(ctx).getCivilServiceStatus({ countryId: COUNTRY }),
    (db) => db.governmentComponent.findMany,
  ],
  [
    "vault.getBudgetMultiplier",
    (ctx) => vault(ctx).getBudgetMultiplier({ countryId: COUNTRY }),
    () => budgetVaultCalculator.calculateBudgetMultiplier as unknown as jest.Mock,
  ],
];

describe.each(OWNER_ONLY)("%s", (_name, call, guarded) => {
  it.each(OWNERS)("serves %s", async (_who, ctxFor) => {
    await expect(call(ctxFor(makeDb()))).resolves.toBeDefined();
  });

  it("serves an owner who is not acting as the nation (Country.ownerUserId)", async () => {
    await expect(call(otherPlayer(makeDb({ ownerUserId: "other_db" })))).resolves.toBeDefined();
  });

  it("is FORBIDDEN for another player, before any budget read", async () => {
    const db = makeDb();
    await expect(call(otherPlayer(db))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(guarded(db)).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    const db = makeDb();
    await expect(call(signedOut(db))).rejects.toThrow(/Authentication required/);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(guarded(db)).not.toHaveBeenCalled();
  });
});

// ─── Dashboard and economic record ──────────────────────────────────────────

describe("mycountry.getCountryDashboard", () => {
  const read = (ctx: never) => mycountry(ctx).getCountryDashboard({ countryId: COUNTRY });

  it.each(VISITORS)("serves %s no spending split", async (_who, ctxFor) => {
    const res = (await read(ctxFor(makeDb()))) as Record<string, any>;
    expect(res.governmentBudget).toBeNull();
    expect(res.fiscalSystem).toEqual({ salesTaxRate: 12, spendingByCategory: null });
    expect(res.overallScore).toBe(70);
  });

  it.each(OWNERS)("serves %s the spending split", async (_who, ctxFor) => {
    const res = (await read(ctxFor(makeDb()))) as Record<string, any>;
    expect(res.governmentBudget).toEqual(COUNTRY_ROW.governmentBudget);
    expect(res.fiscalSystem.spendingByCategory).toBe('{"Defense":50}');
  });

  it("redacts a visitor's read of the record the owner's call cached", async () => {
    const db = makeDb();
    await read(owner(db));
    expect(cache.size).toBe(1);
    const res = (await read(otherPlayer(db))) as Record<string, any>;
    expect(db.country.findUnique).toHaveBeenCalledTimes(2); // owner's read + visitor's ownership check
    expect(res.governmentBudget).toBeNull();
    // The cached record itself stays whole for the owner.
    expect((await read(owner(db))) as Record<string, any>).toMatchObject({
      governmentBudget: COUNTRY_ROW.governmentBudget,
    });
  });
});

describe("redactEconomicBudget (countries.getByIdWithEconomicData for visitors)", () => {
  it("nulls the spending split and keeps tax rates and macro fiscal figures", () => {
    const record = {
      id: COUNTRY,
      totalGovernmentSpending: 5e11,
      spendingGDPPercent: 30,
      taxRevenueGDPPercent: 25,
      governmentBudget: { spendingCategories: '{"Defense":50}' },
      fiscalSystem: { salesTaxRate: 12, spendingByCategory: '{"Defense":50}' },
    };
    expect(redactEconomicBudget(record)).toEqual({
      ...record,
      governmentBudget: null,
      fiscalSystem: { salesTaxRate: 12, spendingByCategory: null },
    });
    expect(record.governmentBudget).not.toBeNull(); // not mutated
  });

  it("leaves a record without economic relations untouched", () => {
    expect(redactEconomicBudget({ id: COUNTRY, fiscalSystem: null })).toEqual({
      id: COUNTRY,
      fiscalSystem: null,
    });
  });
});

// ─── Canon feed ─────────────────────────────────────────────────────────────

describe("mycountry.getCanonFeed", () => {
  const feed = async (ctx: never) =>
    ((await mycountry(ctx).getCanonFeed({ countryId: COUNTRY })) as Array<{ id: string }>)
      .map((i) => i.id)
      .sort();

  it.each(VISITORS)(
    "serves %s no entry tied to a non-public directive and no budget entry",
    async (_who, ctxFor) => {
      const db = makeDb();
      expect(await feed(ctxFor(db))).toEqual(["eff_eff_public", "log_enacted", "log_issue"].sort());
      expect(db.intent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.any(Array) }, countryId: COUNTRY },
        })
      );
    }
  );

  it.each(OWNERS)("serves %s the whole feed", async (_who, ctxFor) => {
    const db = makeDb();
    expect(await feed(ctxFor(db))).toHaveLength(8);
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });
});

describe("isBudgetLedgerRow", () => {
  it.each([
    [{ targetModel: "GovernmentStructure", targetField: "totalBudget" }, true],
    [{ targetModel: "BudgetAllocation", targetField: "allocatedPercent" }, true],
    [{ sourceType: "policy", description: "Policy Maintenance: debited 5 from budget" }, true],
    [{ targetModel: "Country", targetField: "spendingGDPPercent" }, false],
    [{ targetModel: "GovernmentStructure", targetField: "politicalStability" }, false],
    [{ sourceType: "decision", description: "Intent (measured): Balance the budget" }, false],
  ])("%j → %s", (row, expected) => {
    expect(isBudgetLedgerRow(row)).toBe(expected);
  });
});

// ─── Military and embassies ─────────────────────────────────────────────────

describe("security.getMilitaryBranches", () => {
  const read = (ctx: never) => military(ctx).getMilitaryBranches({ countryId: COUNTRY });

  it.each(VISITORS)("serves %s branches without their budget", async (_who, ctxFor) => {
    const [branch] = (await read(ctxFor(makeDb()))) as Array<Record<string, unknown>>;
    expect(branch).toMatchObject({ name: "Army" });
    expect(branch).not.toHaveProperty("annualBudget");
    expect(branch).not.toHaveProperty("budgetPercent");
  });

  it.each(OWNERS)("serves %s the branch budgets", async (_who, ctxFor) => {
    const [branch] = (await read(ctxFor(makeDb()))) as Array<Record<string, unknown>>;
    expect(branch).toMatchObject({ annualBudget: 9e9, budgetPercent: 12 });
  });
});

describe("diplomaticEmbassies.getEmbassies", () => {
  const budgets = async (ctx: never) =>
    Object.fromEntries(
      (
        (await embassies(ctx).getEmbassies({ countryId: COUNTRY })) as Array<{
          id: string;
          budget?: number;
          maintenanceCost?: number;
        }>
      ).map((e) => [e.id, [e.budget, e.maintenanceCost]])
    );

  it.each(VISITORS)("serves %s no embassy budget", async (_who, ctxFor) => {
    expect(await budgets(ctxFor(makeDb()))).toEqual({
      ours: [undefined, undefined],
      theirs: [undefined, undefined],
    });
  });

  it("serves the owner its own embassies' budgets, not a foreign mission's", async () => {
    const db = makeDb();
    expect(await budgets(owner(db))).toEqual({
      ours: [75_000, 2_500],
      theirs: [undefined, undefined],
    });
  });

  it("serves an admin every budget", async () => {
    expect(await budgets(admin(makeDb()))).toEqual({
      ours: [75_000, 2_500],
      theirs: [75_000, 2_500],
    });
  });

  it("checks the funding nations in one ownership query", async () => {
    const db = makeDb({ ownerUserId: "other_db" });
    expect(await budgets(otherPlayer(db))).toEqual({
      ours: [75_000, 2_500],
      theirs: [undefined, undefined],
    });
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.country.findMany).toHaveBeenCalledTimes(1);
  });
});

// ─── Transport ──────────────────────────────────────────────────────────────

describe("transport.getNationalMobilityProfile", () => {
  // Cached per viewer: one read per caller, all in one test so no cache entry leaks across.
  it("shows everyone the network condition and only the owner its maintenance budget", async () => {
    const db = makeDb();
    const read = async (ctx: never) =>
      (
        (await transport(ctx).getNationalMobilityProfile({ countryId: COUNTRY })) as {
          degradation: Record<string, unknown>;
        }
      ).degradation;

    for (const ctxFor of [owner, admin]) {
      expect(await read(ctxFor(db))).toMatchObject({
        budgetedMaintenance: 3,
        requiredMaintenance: 4,
        fundingRatio: 0.75,
      });
    }
    for (const ctxFor of [otherPlayer, signedOut]) {
      const degradation = await read(ctxFor(db));
      expect(degradation).toMatchObject({ requiredMaintenance: 4 });
      expect(degradation.conditionLabel).toEqual(expect.any(String));
      expect(degradation).not.toHaveProperty("budgetedMaintenance");
      expect(degradation).not.toHaveProperty("fundingRatio");
    }
  });
});
