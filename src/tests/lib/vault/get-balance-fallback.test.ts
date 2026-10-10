/**
 * A server error while reading the balance must never offer a daily claim:
 * the claim would then fail (or double-fire) against a database that is down.
 */

// vault-ledger <-> vault-passive-income import each other; mock one side to
// avoid the re-entrant require.
jest.mock("~/lib/vault/vault-passive-income", () => ({
  catchUpPassiveIncome: jest.fn().mockResolvedValue(undefined),
}));

import type { PrismaClient } from "@prisma/client";
import { getBalance } from "~/lib/vault/vault-ledger";

describe("getBalance error fallback", () => {
  it("returns zero credits and no claimable daily bonus when the database throws", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failingDb = {
      myVault: {
        findUnique: jest.fn().mockRejectedValue(new Error("database system is in recovery mode")),
        findFirst: jest.fn().mockRejectedValue(new Error("database system is in recovery mode")),
        create: jest.fn().mockRejectedValue(new Error("database system is in recovery mode")),
        upsert: jest.fn().mockRejectedValue(new Error("database system is in recovery mode")),
      },
    } as unknown as PrismaClient;

    const balance = await getBalance("user_1", failingDb);

    expect(balance.credits).toBe(0);
    expect(balance.canClaimDailyBonus).toBe(false);
    consoleError.mockRestore();
  });
});
