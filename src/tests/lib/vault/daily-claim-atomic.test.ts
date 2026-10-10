/**
 * Plan 331: the daily claim slot is a conditional write (lastLoginDate < start of
 * today), taken inside the same transaction as the payout.
 */

jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
// vault-ledger <-> vault-passive-income import each other; without this mock the
// re-entrant require would spread a half-initialised ledger (TDZ on LedgerError).
jest.mock("~/lib/vault/vault-passive-income", () => ({
  catchUpPassiveIncome: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
  earnCreditsTx: jest.fn(),
}));

import { earnCreditsTx, getOrCreateVault, LedgerError } from "~/lib/vault/vault-ledger";
import {
  claimCombinedDailyClaim,
  claimDailyBonus,
  claimDailySlot,
  computeNextStreak,
  startOfUtcDay,
} from "~/lib/vault/vault-daily-bonus";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/transactional-mock-db";

const getVaultMock = jest.mocked(getOrCreateVault);
const earnMock = jest.mocked(earnCreditsTx);

const TODAY = new Date(Date.UTC(2026, 8, 25, 12, 0, 0));
const YESTERDAY = new Date(Date.UTC(2026, 8, 24, 23, 30, 0));

function makeVault(overrides: Record<string, unknown> = {}) {
  return {
    id: "vault_1",
    userId: "user_1",
    credits: 100,
    loginStreak: 3,
    lastLoginDate: YESTERDAY,
    vaultLevel: 2,
    ...overrides,
  };
}

function makeDb() {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  // Run transaction callbacks against the proxy so models first touched inside a
  // transaction are auto-mocked (the helper's default hands the callback the raw target).
  db.$transaction = jest.fn((cb: (tx: MockPrismaProxy) => Promise<never>) => cb(db));
  return db;
}

beforeEach(() => {
  jest.useFakeTimers({ now: TODAY });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  getVaultMock.mockReset();
  earnMock.mockReset();
  getVaultMock.mockResolvedValue(makeVault() as never);
  earnMock.mockResolvedValue({ newBalance: 104, amount: 4 });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("computeNextStreak", () => {
  it("starts at 1 with no previous login", () => {
    expect(computeNextStreak(null, 7, TODAY)).toBe(1);
  });

  it("increments on the next UTC calendar day", () => {
    expect(computeNextStreak(YESTERDAY, 3, TODAY)).toBe(4);
  });

  it("is unchanged on the same UTC day", () => {
    expect(computeNextStreak(new Date(Date.UTC(2026, 8, 25, 0, 1, 0)), 3, TODAY)).toBe(3);
  });

  it("resets to 1 after a missed day", () => {
    expect(computeNextStreak(new Date(Date.UTC(2026, 8, 23, 12, 0, 0)), 3, TODAY)).toBe(1);
  });
});

describe("claimDailySlot", () => {
  it("only takes the slot when lastLoginDate is null or before the start of today (UTC)", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const res = await claimDailySlot(db as never, makeVault(), TODAY);

    expect(res).toEqual({ claimed: true, streak: 4 });
    expect(db.myVault.updateMany).toHaveBeenCalledWith({
      where: {
        id: "vault_1",
        OR: [{ lastLoginDate: null }, { lastLoginDate: { lt: startOfUtcDay(TODAY) } }],
      },
      data: { lastLoginDate: TODAY, loginStreak: 4 },
    });
    expect(startOfUtcDay(TODAY).toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });
});

describe("claimDailyBonus", () => {
  it("pays once: the second same-day claim loses the conditional write", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await claimDailyBonus("user_1", db as never);
    const second = await claimDailyBonus("user_1", db as never);

    expect(first).toEqual({ success: true, bonus: 4, streak: 4 });
    expect(second).toEqual({
      success: false,
      bonus: 0,
      streak: 3,
      message: "Daily bonus already claimed today",
    });
    expect(earnMock).toHaveBeenCalledTimes(1);
    expect(earnMock).toHaveBeenCalledWith(db, {
      userId: "user_1",
      amount: 4,
      type: "EARN_ACTIVE",
      source: "DAILY_LOGIN",
      metadata: { streak: 4 },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("takes the slot and pays inside one transaction; a ledger failure rolls the slot back", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    earnMock.mockRejectedValue(new LedgerError("DAILY_CAP_REACHED", "Daily earning cap reached"));

    const result = await claimDailyBonus("user_1", db as never);

    expect(result).toEqual({
      success: false,
      bonus: 0,
      streak: 3,
      message: "Daily earning cap reached",
    });
    // The slot write and the earn ran in the same $transaction callback, which rejected,
    // so a real database rolls the slot back with it.
    expect(db.myVault.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      earnMock.mock.invocationCallOrder[0]
    );
    await expect(db.$transaction.mock.results[0].value).rejects.toBeInstanceOf(LedgerError);
    expect(db.myVault.update).not.toHaveBeenCalled();
  });
});

describe("claimCombinedDailyClaim", () => {
  it("CREDITS: a second same-day claim is rejected without earning", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    const result = await claimCombinedDailyClaim("user_1", "CREDITS", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "credits",
      streak: 3,
      message: "Daily claim already made today",
    });
    expect(earnMock).not.toHaveBeenCalled();
  });

  it("CARD: allocates the serial under the advisory lock and awards inside one transaction", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    db.card.count = jest.fn().mockResolvedValue(1);
    db.card.findFirst = jest
      .fn()
      .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });
    db.cardOwnership.findFirst = jest.fn().mockResolvedValue({ serialNumber: 4 });
    db.cardOwnership.create = jest.fn().mockResolvedValue({ id: "co_1" });

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toMatchObject({
      success: true,
      rewardType: "card",
      streak: 4,
      cardAwarded: { id: "card_1", title: "Test Card" },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.myVault.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.$executeRaw.mock.invocationCallOrder[0]
    );
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.cardOwnership.create.mock.invocationCallOrder[0]
    );
    expect(db.cardOwnership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: "card_1", ownerId: "user_1", serialNumber: 5 }),
    });
    expect(db.cardTransferEvent.create).toHaveBeenCalledTimes(1);
    expect(db.vaultTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("CARD: a second same-day claim awards nothing", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    db.card.count = jest.fn().mockResolvedValue(1);
    db.card.findFirst = jest
      .fn()
      .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "card",
      streak: 3,
      message: "Daily claim already made today",
    });
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.cardOwnership.create).not.toHaveBeenCalled();
  });
});
