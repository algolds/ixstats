/**
 * Concurrency stress tests for VaultService spendCredits
 */

import { VaultService } from "~/lib/vault";

describe("VaultService - Concurrency & Atomic Balance Safety", () => {
  let vaultService: VaultService;
  let mockDb: any;

  beforeEach(() => {
    vaultService = new VaultService();
  });

  it("should prevent negative balances under concurrent spendCredits calls", async () => {
    let mockCredits = 100;
    const userId = "user_concurrent_123";

    mockDb = {
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: userId, clerkUserId: userId }),
      },
      myVault: {
        upsert: jest.fn().mockImplementation(async () => ({
          id: "vault_123",
          userId,
          credits: mockCredits,
          lastDailyReset: new Date(),
        })),
        findUnique: jest.fn().mockImplementation(async () => ({
          id: "vault_123",
          credits: mockCredits,
        })),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
          id: "vault_123",
          credits: mockCredits,
        })),
        updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
          if (where.credits?.gte !== undefined && mockCredits < where.credits.gte) {
            return { count: 0 };
          }
          mockCredits -= data.credits.decrement;
          return { count: 1 };
        }),
      },
      vaultTransaction: {
        create: jest.fn().mockResolvedValue({ id: "tx_123" }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockDb)),
    };

    // Simulate 10 concurrent requests attempting to spend 50 IxC each (total requested = 500 IxC, balance = 100 IxC)
    const requests = Array.from({ length: 10 }).map(() =>
      vaultService.spendCredits(userId, 50, "SPEND_MARKET", "test_race", mockDb)
    );

    const results = await Promise.all(requests);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 2 operations (2 * 50 = 100 IxC) must succeed
    expect(successes.length).toBe(2);
    // Exactly 8 operations must fail
    expect(failures.length).toBe(8);
    // Final balance must be exactly 0 (never negative)
    expect(mockCredits).toBe(0);
  });
});
