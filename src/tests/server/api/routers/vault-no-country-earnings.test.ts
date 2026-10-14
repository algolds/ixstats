/** @jest-environment node */
/**
 * IxCredits are pure metagame: reading the balance writes no ledger row, and the router has no
 * procedure that prices a nation's budget or dividend.
 */
import type { PrismaClient } from "@prisma/client";
import { getBalance } from "~/lib/vault/vault-ledger";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";

describe("vault balance router", () => {
  it("has no nation dividend or budget multiplier procedure", () => {
    const procedures = Object.keys(vaultBalanceCreditsRouter._def.procedures);
    expect(procedures).not.toContain("calculatePassiveIncome");
    expect(procedures).not.toContain("getBudgetMultiplier");
    expect(procedures).toContain("getBalance");
  });
});

describe("getBalance", () => {
  it("writes no ledger row and reads no country", async () => {
    const vault = {
      id: "v1",
      userId: "u1",
      credits: 100,
      vaultXp: 0,
      vaultLevel: 1,
      loginStreak: 0,
      lastLoginDate: null,
      lastDailyReset: new Date(),
      dailyActiveEarnings: 0,
      dailySocialEarnings: 0,
    };
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "u1" }),
        findUnique: jest.fn().mockResolvedValue({ id: "u1" }),
      },
      myVault: {
        findUnique: jest.fn().mockResolvedValue(vault),
        findFirst: jest.fn().mockResolvedValue(vault),
        upsert: jest.fn().mockResolvedValue(vault),
        update: jest.fn().mockResolvedValue(vault),
      },
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      vaultTransaction: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      country: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await getBalance("u1", db as unknown as PrismaClient);

    expect(db.vaultTransaction.create).not.toHaveBeenCalled();
    expect(db.vaultTransaction.createMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.country.findFirst).not.toHaveBeenCalled();
    expect(db.country.findUnique).not.toHaveBeenCalled();
    expect(db.country.findMany).not.toHaveBeenCalled();
  });
});
