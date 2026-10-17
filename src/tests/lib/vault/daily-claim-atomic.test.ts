/**
 * Plan 331: the daily claim slot is a conditional write (lastLoginDate < start of
 * today), taken inside the same transaction as the payout.
 */

jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
  earnCreditsTx: jest.fn(),
}));

import { earnCreditsTx, getOrCreateVault, LedgerError } from "~/lib/vault/vault-ledger";
import {
  claimCombinedDailyClaim,
  claimDailySlot,
  startOfUtcDay,
} from "~/lib/vault/vault-daily-bonus";
import { computeNextStreak } from "~/lib/vault/daily-roll";
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

  it("CREDITS: pays once; the second same-day claim loses the conditional write", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await claimCombinedDailyClaim("user_1", "CREDITS", db as never);
    const second = await claimCombinedDailyClaim("user_1", "CREDITS", db as never);

    expect(first).toMatchObject({
      success: true,
      rewardType: "credits",
      creditsAwarded: 4,
      streak: 4,
    });
    expect(second).toMatchObject({ success: false, message: "Daily claim already made today" });
    expect(earnMock).toHaveBeenCalledTimes(1);
    expect(earnMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "user_1",
        source: "DAILY_LOGIN_CREDITS",
        metadata: { streak: 4 },
      })
    );
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("CREDITS: takes the slot and pays inside one transaction; a ledger failure rolls the slot back", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    earnMock.mockRejectedValue(new LedgerError("DAILY_CAP_REACHED", "Daily earning cap reached"));

    const result = await claimCombinedDailyClaim("user_1", "CREDITS", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "credits",
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

  it("CARD: a double claim mints once, and only the winner gets a copy id", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    db.card.count = jest.fn().mockResolvedValue(1);
    db.card.findFirst = jest
      .fn()
      .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });
    db.cardOwnership.findFirst = jest.fn().mockResolvedValue({ serialNumber: 4 });
    db.cardOwnership.create = jest.fn().mockResolvedValue({ id: "co_1" });

    const [first, second] = await Promise.all([
      claimCombinedDailyClaim("user_1", "CARD", db as never),
      claimCombinedDailyClaim("user_1", "CARD", db as never),
    ]);

    expect(first).toMatchObject({ success: true, cardAwarded: { ownershipId: "co_1" } });
    expect(second).toEqual({
      success: false,
      rewardType: "card",
      streak: 3,
      message: "Daily claim already made today",
    });
    expect(db.cardOwnership.create).toHaveBeenCalledTimes(1);
    expect(db.cardTransferEvent.create).toHaveBeenCalledTimes(1);
    expect(db.vaultTransaction.create).toHaveBeenCalledTimes(1);
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
      cardAwarded: { id: "card_1", ownershipId: "co_1", title: "Test Card" },
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

  it("CARD: picks only a live, approved card, never a trophy or restricted-licence art", async () => {
    const db = makeDb();
    db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    db.card.count = jest.fn().mockResolvedValue(1);
    db.card.findFirst = jest
      .fn()
      .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });
    db.cardOwnership.findFirst = jest.fn().mockResolvedValue({ serialNumber: 4 });
    db.cardOwnership.create = jest.fn().mockResolvedValue({ id: "co_1" });

    await claimCombinedDailyClaim("user_1", "CARD", db as never);

    const pool = {
      isRetired: false,
      reviewState: "APPROVED",
      cardType: { not: "TROPHY" },
      artLicence: { isNot: { status: "RESTRICTED" } },
    };
    expect(db.card.count).toHaveBeenCalledTimes(1);
    expect(db.card.count).toHaveBeenCalledWith({ where: pool });
    expect(db.card.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: pool }));
  });

  it("CARD: awards nothing when only retired cards remain, so hidden art is never drawn", async () => {
    const db = makeDb();
    db.card.count = jest.fn().mockResolvedValue(0);
    db.card.findFirst = jest.fn();
    db.cardOwnership.create = jest.fn();

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toMatchObject({ success: false, rewardType: "card" });
    expect(db.card.count).toHaveBeenCalledTimes(1);
    expect(db.card.findFirst).not.toHaveBeenCalled();
    expect(db.cardOwnership.create).not.toHaveBeenCalled();
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
