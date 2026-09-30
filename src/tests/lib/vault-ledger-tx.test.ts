/**
 * Ledger *Tx variants (plan 327).
 *
 * They must work on a Prisma interactive-transaction client — which has NO
 * `$transaction` method — and surface every failure as a `LedgerError` so the
 * caller's transaction rolls back.
 */

jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));

import {
  earnCredits,
  earnCreditsTx,
  spendCreditsTx,
  LedgerError,
} from "~/lib/vault/vault-ledger";
import { VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";

interface TxState {
  credits: number;
  todayRows: Array<{ credits: number }>;
  rows: any[];
}

function makeState(credits: number, todayRows: Array<{ credits: number }> = []): TxState {
  return { credits, todayRows, rows: [] };
}

/** A mock shaped like Prisma.TransactionClient: no `$transaction` key. */
function makeTx(state: TxState) {
  return {
    systemConfig: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: "u1", clerkUserId: "user_1" }),
    },
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
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (where.credits?.gte !== undefined && state.credits < where.credits.gte) {
          return { count: 0 };
        }
        state.credits -= data.credits.decrement;
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
        id: "v1",
        credits: state.credits,
      })),
    },
    vaultTransaction: {
      findMany: jest.fn().mockImplementation(async () => state.todayRows),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        state.rows.push(data);
        return { id: "t" };
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

const saturatedActiveCap = [{ credits: VAULT_CONFIG_DEFAULTS.activeDailyCap }];

describe("vault-ledger *Tx variants", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("spendCreditsTx works on a client without $transaction", async () => {
    const state = makeState(100);
    const tx = makeTx(state);
    expect("$transaction" in tx).toBe(false);

    const result = await spendCreditsTx(tx as any, {
      userId: "u1",
      amount: 40,
      type: "SPEND_MARKET",
      source: "test_spend",
    });

    expect(result).toEqual({ newBalance: 60, amount: 40 });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      vaultId: "v1",
      credits: -40,
      balanceAfter: 60,
      type: "SPEND_MARKET",
      source: "test_spend",
    });
  });

  it("spendCreditsTx throws LedgerError INSUFFICIENT_CREDITS when balance too low", async () => {
    const state = makeState(10);
    const tx = makeTx(state);

    const err = await spendCreditsTx(tx as any, {
      userId: "u1",
      amount: 40,
      type: "SPEND_MARKET",
      source: "test_spend",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(LedgerError);
    expect(err.code).toBe("INSUFFICIENT_CREDITS");
    expect(err.balance).toBe(10);
    expect(state.rows).toHaveLength(0);
    expect(state.credits).toBe(10);
  });

  it("earnCreditsTx works on a client without $transaction", async () => {
    const state = makeState(100);
    const tx = makeTx(state);

    const result = await earnCreditsTx(tx as any, {
      userId: "u1",
      amount: 25,
      type: "EARN_CARDS",
      source: "test_earn",
    });

    expect(result).toEqual({ newBalance: 125, amount: 25 });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ credits: 25, balanceAfter: 125, type: "EARN_CARDS" });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("REFUND is not capped", async () => {
    const state = makeState(0, saturatedActiveCap);
    const tx = makeTx(state);

    const result = await earnCreditsTx(tx as any, {
      userId: "u1",
      amount: 50,
      type: "REFUND",
      source: "auction_bid_refund",
    });

    expect(result).toEqual({ newBalance: 50, amount: 50 });
    expect(state.rows[0]).toMatchObject({ credits: 50, type: "REFUND" });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.vaultTransaction.findMany).not.toHaveBeenCalled();
  });

  it("EARN_ACTIVE is capped and locks the vault row", async () => {
    const state = makeState(0, saturatedActiveCap);
    const tx = makeTx(state);

    const err = await earnCreditsTx(tx as any, {
      userId: "u1",
      amount: 50,
      type: "EARN_ACTIVE",
      source: "test_earn",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(LedgerError);
    expect(err.code).toBe("DAILY_CAP_REACHED");
    expect(err.message).toContain("Daily earning cap reached");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(state.rows).toHaveLength(0);
    expect(state.credits).toBe(0);
  });

  it("wrapper earnCredits still returns {success:false,message} on cap", async () => {
    const state = makeState(0, saturatedActiveCap);
    const tx = makeTx(state);
    const db: any = {
      ...tx,
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const result = await earnCredits("u1", 10, "EARN_ACTIVE", "test_earn", db);

    expect(result).toEqual({
      success: false,
      newBalance: 0,
      message: expect.stringContaining("Daily earning cap reached"),
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
