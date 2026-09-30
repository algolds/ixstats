/**
 * The daily dividend is paid once per account from its primary nation (the earliest-created one it owns), never
 * from the active nation — so switching to a richer nation just before the payout gains nothing.
 */
import type { PrismaClient } from "@prisma/client";
import { resolveDividendCountryId } from "~/lib/vault/dividend-nation";
import { distributePassiveIncome } from "~/lib/economy/passive-income-distribution-cron";
import { catchUpPassiveIncome } from "~/lib/vault/vault-passive-income";

jest.mock("~/server/modules/forum", () => ({ syncUserToForum: jest.fn().mockResolvedValue(true) }));
jest.mock("~/lib/economy/budget-vault-calculator", () => ({
  budgetVaultCalculator: { calculateBudgetMultiplier: jest.fn().mockResolvedValue(1) },
}));
jest.mock("~/lib/vault/vault-perks", () => ({
  ...jest.requireActual("~/lib/vault/vault-perks"),
  getYieldBoostMultiplier: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

const nation = (id: string, gdpPerCapita: number) => ({
  id,
  name: id,
  economicTier: "Developing",
  currentGdpPerCapita: gdpPerCapita,
  currentPopulation: 0,
  adjustedGdpGrowth: 0,
});
// u1 owns a modest first nation and a rich second one, and has switched to the rich one.
const poor = nation("poor", 50_000); // 5 IxC/day
const rich = nation("rich", 500_000); // 50 IxC/day
const nations: Record<string, ReturnType<typeof nation>> = { poor, rich };
const player = {
  id: "u1",
  clerkUserId: "clerk_u1",
  countryId: "rich",
  country: rich,
  vault: null,
  createdAt: new Date(Date.now() - 2 * 86_400_000),
};

const credited: Array<{ credits: number; metadata: string | null }> = [];
const models = {
  user: {
    findMany: jest.fn(async () => [player]),
    findFirst: jest.fn(async () => player),
  },
  country: {
    findFirst: jest.fn(async () => ({ id: "poor" })),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => nations[where.id] ?? null),
  },
  systemConfig: { findMany: jest.fn(async () => []) },
  myVault: {
    upsert: jest.fn(async () => ({
      id: "v1",
      userId: "u1",
      credits: 0,
      createdAt: new Date(Date.now() - 3 * 86_400_000),
      lastDailyReset: new Date(),
      todayEarned: 0,
    })),
    update: jest.fn(async () => ({ id: "v1", credits: 0 })),
  },
  vaultTransaction: {
    findUnique: jest.fn(async () => null),
    findFirst: jest.fn(async () => null),
    findMany: jest.fn(async () => []),
    create: jest.fn(async ({ data }: { data: { credits: number; metadata: string | null } }) => {
      credited.push(data);
      return { id: `t${credited.length}` };
    }),
  },
};
const mockDb = {
  ...models,
  $transaction: jest.fn(<T>(cb: (tx: typeof models) => Promise<T>) => cb(models)),
};

describe("resolveDividendCountryId", () => {
  it("picks the earliest-created owned nation, whatever the active one", async () => {
    const db = { country: { findFirst: jest.fn().mockResolvedValue({ id: "first" }) } };
    await expect(
      resolveDividendCountryId(db as never, { id: "u1", countryId: "rich" })
    ).resolves.toBe("first");
    expect(db.country.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "u1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("an account that owns nothing is paid from the nation it acts as, or not at all", async () => {
    const db = { country: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(
      resolveDividendCountryId(db as never, { id: "u1", countryId: "linked" })
    ).resolves.toBe("linked");
    await expect(
      resolveDividendCountryId(db as never, { id: "u1", countryId: null })
    ).resolves.toBeNull();
  });
});

describe("the dividend does not follow the active nation", () => {
  beforeEach(() => {
    credited.length = 0;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("the daily cron pays the primary nation's dividend, once", async () => {
    const summary = await distributePassiveIncome();
    expect(summary.distributed).toBe(5);
    expect(credited).toHaveLength(1);
    expect(credited[0]?.credits).toBe(5);
    expect(JSON.parse(credited[0]?.metadata ?? "{}")).toMatchObject({
      countryId: "poor",
      countryName: "poor",
    });
    expect(models.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ countryId: { not: null } }, { ownedCountries: { some: {} } }] },
      })
    );
  });

  it("the on-read catch-up pays the primary nation's dividend too", async () => {
    const result = await catchUpPassiveIncome("u1", mockDb as unknown as PrismaClient);
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(credited.every((row) => row.credits === 5)).toBe(true);
    expect(credited.every((row) => JSON.parse(row.metadata ?? "{}").countryId === "poor")).toBe(
      true
    );
  });
});
