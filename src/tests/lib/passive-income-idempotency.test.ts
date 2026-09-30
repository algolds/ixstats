/**
 * Passive-income idempotency (plan 328).
 *
 * The daily cron and the on-read catch-up both pay the "nation dividend"; each
 * user's payout for a UTC day must be written at most once, keyed by
 * `passive:<userId>:<YYYY-MM-DD>` on vault_transactions.idempotencyKey.
 */

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { distributePassiveIncome } from "~/lib/economy/passive-income-distribution-cron";
import { catchUpPassiveIncome } from "~/lib/vault/vault-passive-income";
import { earnCreditsOnce } from "~/lib/vault/vault-service";

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/economy/budget-vault-calculator", () => ({
  budgetVaultCalculator: { calculateBudgetMultiplier: jest.fn().mockResolvedValue(1) },
}));
jest.mock("~/lib/vault/vault-perks", () => ({
  ...jest.requireActual("~/lib/vault/vault-perks"),
  getYieldBoostMultiplier: jest.fn().mockResolvedValue(0),
}));
// Getter so the hoisted factory does not touch `mockDb` before it is initialised.
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

interface StoredRow {
  vaultId: string;
  credits: number;
  balanceAfter: number;
  type: string;
  source: string;
  metadata: string | null;
  createdAt: Date;
  idempotencyKey: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_AGO = new Date(Date.now() - 2 * DAY_MS);

const mockState = {
  credits: 0,
  rows: [] as StoredRow[],
  createError: null as Error | null,
};

const mockCountry = {
  id: "c1",
  name: "Testland",
  economicTier: "Developing",
  currentGdpPerCapita: 100000,
  currentPopulation: 0,
  adjustedGdpGrowth: 0,
};
const mockUser = {
  id: "u1",
  clerkUserId: "user_1",
  countryId: "c1",
  country: mockCountry,
  vault: null,
  createdAt: TWO_DAYS_AGO,
};

const mockModels = {
  user: {
    findMany: jest.fn(async () => [mockUser]),
    findFirst: jest.fn(async () => mockUser),
  },
  country: {
    findUnique: jest.fn(async () => mockCountry),
  },
  systemConfig: {
    findMany: jest.fn(async () => []),
  },
  myVault: {
    upsert: jest.fn(async () => ({
      id: "v1",
      userId: "u1",
      credits: mockState.credits,
      createdAt: TWO_DAYS_AGO,
      lastDailyReset: new Date(),
      todayEarned: 0,
    })),
    update: jest.fn(async ({ data }: { data: { credits?: { increment?: number } } }) => {
      mockState.credits += data.credits?.increment ?? 0;
      return { id: "v1", credits: mockState.credits };
    }),
  },
  vaultTransaction: {
    findUnique: jest.fn(
      async ({ where }: { where: { idempotencyKey?: string } }) =>
        mockState.rows.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null
    ),
    findFirst: jest.fn(async ({ where }: { where: { source?: string | { in: string[] } } }) => {
      const sources = typeof where.source === "string" ? [where.source] : (where.source?.in ?? []);
      const matches = mockState.rows
        .filter((r) => sources.includes(r.source))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ?? null;
    }),
    findMany: jest.fn(async () => []),
    create: jest.fn(async ({ data }: { data: StoredRow }) => {
      if (mockState.createError) throw mockState.createError;
      mockState.rows.push({ ...data, idempotencyKey: data.idempotencyKey ?? null });
      return { id: `t${mockState.rows.length}` };
    }),
  },
};

const mockDb = {
  ...mockModels,
  $transaction: jest.fn(<T>(cb: (tx: typeof mockModels) => Promise<T>) => cb(mockModels)),
};
const db = mockDb as unknown as PrismaClient;

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function seedRow(source: string, createdAt: Date): void {
  mockState.rows.push({
    vaultId: "v1",
    credits: 10,
    balanceAfter: 10,
    type: "EARN_PASSIVE",
    source,
    metadata: null,
    createdAt,
    idempotencyKey: null,
  });
}

describe("passive income idempotency", () => {
  const todayKey = `passive:u1:${new Date().toISOString().slice(0, 10)}`;

  beforeEach(() => {
    mockState.credits = 0;
    mockState.rows = [];
    mockState.createError = null;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("distributePassiveIncome twice on the same UTC day credits once", async () => {
    const first = await distributePassiveIncome();
    const second = await distributePassiveIncome();

    expect(first.distributed).toBe(10);
    expect(mockState.rows).toHaveLength(1);
    expect(mockState.rows[0]?.idempotencyKey).toBe(todayKey);
    expect(mockState.rows[0]?.source).toBe("DAILY_DIVIDEND");
    expect(second.distributed).toBe(0);
    expect(second.alreadyPaid).toBe(1);
    expect(second.errors).toBe(0);
  });

  it("catch-up after the cron on the same day does not pay again", async () => {
    await distributePassiveIncome();

    const result = await catchUpPassiveIncome("u1", db);

    expect(result).toEqual({ success: true, count: 0, totalCreditsAwarded: 0 });
    expect(mockState.rows).toHaveLength(1);
  });

  it("catch-up respects a legacy DAILY_NATION_DIVIDEND row", async () => {
    const todayAt0005 = new Date(utcDay(new Date()).getTime() + 5 * 60 * 1000);
    seedRow("DAILY_NATION_DIVIDEND", todayAt0005);

    const result = await catchUpPassiveIncome("u1", db);

    expect(result.count).toBe(0);
    expect(mockState.rows).toHaveLength(1);
  });

  describe("a concurrent duplicate is reported as already applied", () => {
    const input = {
      userId: "u1",
      amount: 10,
      type: "EARN_PASSIVE" as const,
      source: "DAILY_DIVIDEND",
      idempotencyKey: "passive:u1:2026-01-01",
    };

    it("ConflictError (unique violation via ~/server/db)", async () => {
      mockState.createError = new ConflictError("Unique constraint violation");

      const result = await earnCreditsOnce(db, input);

      expect(result).toMatchObject({ success: true, alreadyApplied: true });
    });

    it("PrismaClientKnownRequestError P2002 (raw client)", async () => {
      mockState.createError = new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "6.19.3",
      });

      const result = await earnCreditsOnce(db, input);

      expect(result).toMatchObject({ success: true, alreadyApplied: true });
    });
  });

  it("catch-up keys each missed day", async () => {
    const threeDaysAgo = new Date(utcDay(new Date()).getTime() - 3 * DAY_MS);
    seedRow("DAILY_DIVIDEND", threeDaysAgo);

    const result = await catchUpPassiveIncome("u1", db);

    const newRows = mockState.rows.slice(1);
    expect(result).toEqual({ success: true, count: 3, totalCreditsAwarded: 30 });
    expect(newRows).toHaveLength(3);
    const keys = newRows.map((r) => r.idempotencyKey);
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(key).toMatch(/^passive:u1:\d{4}-\d{2}-\d{2}$/);
    expect(keys[2]).toBe(todayKey);
  });
});
