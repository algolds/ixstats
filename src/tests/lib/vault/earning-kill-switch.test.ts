/**
 * Code audit VT-23: the global earning kill switch (`vault_isEarningEnabled`) used to stop
 * only EARN_ACTIVE / EARN_SOCIAL / EARN_PASSIVE, so bonuses and card sales kept minting
 * credits while it was off. REFUND stays allowed: it returns credits the user already paid.
 */

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));

import { earnCreditsTx, LedgerError } from "~/lib/vault/vault-ledger";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import type { VaultTransactionType } from "@prisma/client";

function makeTx(earningEnabled: boolean) {
  const state = { credits: 100, rows: [] as any[] };
  const tx = {
    systemConfig: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ key: "vault_isEarningEnabled", value: String(earningEnabled) }]),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: "u1", clerkUserId: "user_1" }) },
    myVault: {
      upsert: jest.fn().mockImplementation(async () => ({
        id: "v1",
        userId: "u1",
        credits: state.credits,
        lastDailyReset: new Date(),
        todayEarned: 0,
      })),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data.credits?.increment) state.credits += data.credits.increment;
        return { id: "v1", credits: state.credits };
      }),
    },
    vaultTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        state.rows.push(data);
        return { id: "t" };
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { tx, state };
}

const earn = (tx: unknown, type: VaultTransactionType) =>
  earnCreditsTx(tx as any, { userId: "u1", amount: 25, type, source: "test" });

describe("earning kill switch", () => {
  beforeEach(() => {
    invalidateVaultConfigCache();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    invalidateVaultConfigCache();
    jest.restoreAllMocks();
  });

  it.each(["EARN_ACTIVE", "EARN_SOCIAL", "EARN_PASSIVE", "EARN_BONUS", "EARN_CARDS"] as const)(
    "blocks %s while earning is disabled",
    async (type) => {
      const { tx, state } = makeTx(false);
      const err = await earn(tx, type).catch((e) => e);
      expect(err).toBeInstanceOf(LedgerError);
      expect(err.code).toBe("EARNING_DISABLED");
      expect(state.rows).toHaveLength(0);
      expect(state.credits).toBe(100);
    }
  );

  it("still lets refunds through while earning is disabled", async () => {
    const { tx, state } = makeTx(false);
    await expect(earn(tx, "REFUND")).resolves.toEqual({ newBalance: 125, amount: 25 });
    expect(state.rows[0]).toMatchObject({ type: "REFUND", credits: 25 });
  });

  it.each(["EARN_BONUS", "EARN_CARDS"] as const)(
    "pays %s when earning is enabled",
    async (type) => {
      const { tx, state } = makeTx(true);
      await expect(earn(tx, type)).resolves.toEqual({ newBalance: 125, amount: 25 });
      expect(state.rows).toHaveLength(1);
    }
  );
});
