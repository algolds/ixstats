/**
 * Plan 331: the daily claim slot is a conditional write (lastLoginDate < start of
 * today), taken inside the same transaction as the payout. Cards refresh §4: the daily
 * card checks capacity in that transaction and draws from any realm by the daily odds.
 */

jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
  earnCreditsTx: jest.fn(),
}));
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/cards/capacity", () => ({
  ...jest.requireActual("~/lib/cards/capacity"),
  assertCapacityTx: jest.fn(),
}));

import { assertCapacityTx, CapacityError } from "~/lib/cards/capacity";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { mintCopy } from "~/lib/cards/mint";
import { DAILY_POOL_WHERE } from "~/lib/cards/pool-draw";
import { grantCardXp } from "~/lib/cards/xp-utils";
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
const mintMock = jest.mocked(mintCopy);
const capacityMock = jest.mocked(assertCapacityTx);

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

/**
 * The app client and the transaction's own client. Only the transaction client can take a
 * lock, and the claim's reads and writes are set up on it, so work done outside the
 * transaction (on `db`) fails a test.
 */
function makeDb() {
  const db = createMockPrisma();
  const tx = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  db.$transaction = jest.fn((cb: (client: MockPrismaProxy) => Promise<never>) => cb(tx));
  return { db, tx };
}

const CARD = { id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null };

/** A transaction whose slot is free, over a daily pool with `tiers` cards of each rarity. */
function makeCardDb(tiers: Record<string, number> = { COMMON: 3 }) {
  const { db, tx } = makeDb();
  tx.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  tx.card.groupBy = jest
    .fn()
    .mockResolvedValue(
      Object.entries(tiers).map(([rarity, all]) => ({ rarity, _count: { _all: all } }))
    );
  tx.card.findFirst = jest.fn().mockResolvedValue(CARD);
  return { db, tx };
}

beforeEach(() => {
  jest.useFakeTimers({ now: TODAY });
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  getVaultMock.mockReset();
  earnMock.mockReset();
  mintMock.mockReset();
  capacityMock.mockReset();
  jest.mocked(grantCardXp).mockClear();
  clearEconomyConfigCache();
  getVaultMock.mockResolvedValue(makeVault() as never);
  earnMock.mockResolvedValue({ newBalance: 104, amount: 4 });
  mintMock.mockResolvedValue({ id: "co_1", finish: "FOIL", serialNumber: 5 } as never);
  capacityMock.mockResolvedValue(undefined);
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
    const { db } = makeDb();
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
    const { db, tx } = makeDb();
    tx.myVault.updateMany = jest.fn().mockResolvedValue({ count: 0 });

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
    const { db, tx } = makeDb();
    tx.myVault.updateMany = jest
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
      tx,
      expect.objectContaining({
        userId: "user_1",
        source: "DAILY_LOGIN_CREDITS",
        metadata: { streak: 4 },
      })
    );
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("CREDITS: takes the slot and pays inside one transaction; a ledger failure rolls the slot back", async () => {
    const { db, tx } = makeDb();
    tx.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
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
    expect(tx.myVault.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      earnMock.mock.invocationCallOrder[0]
    );
    await expect(db.$transaction.mock.results[0].value).rejects.toBeInstanceOf(LedgerError);
    expect(db.myVault.update).not.toHaveBeenCalled();
  });

  it("CARD: a double claim mints once, and only the winner gets a copy id", async () => {
    const { db, tx } = makeCardDb();
    tx.myVault.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

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
    expect(mintMock).toHaveBeenCalledTimes(1);
    expect(tx.vaultTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("CARD: claims the slot, checks capacity, draws from the daily pool and mints with a rolled finish", async () => {
    const { db, tx } = makeCardDb();

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: true,
      rewardType: "card",
      cardAwarded: {
        id: "card_1",
        ownershipId: "co_1",
        title: "Test Card",
        rarity: "COMMON",
        artwork: CARD_ARTWORK_PLACEHOLDER,
        finish: "FOIL",
      },
      streak: 4,
      message: "Claimed daily card: Test Card!",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // Slot, then the capacity lock (7334), then the mint's serial lock (7331)
    expect(tx.myVault.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      capacityMock.mock.invocationCallOrder[0]
    );
    expect(capacityMock.mock.invocationCallOrder[0]).toBeLessThan(
      mintMock.mock.invocationCallOrder[0]
    );
    expect(capacityMock).toHaveBeenCalledWith(tx, "user_1", 1);
    expect(tx.card.groupBy).toHaveBeenCalledWith({
      by: ["rarity"],
      where: DAILY_POOL_WHERE,
      _count: { _all: true },
    });
    expect(tx.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [DAILY_POOL_WHERE, { rarity: "COMMON" }] } })
    );
    expect(mintMock).toHaveBeenCalledWith(tx, {
      cardId: "card_1",
      ownerId: "user_1",
      source: "DAILY_CLAIM",
    });
    expect(grantCardXp).toHaveBeenCalledWith(
      tx,
      "co_1",
      "DAILY_CLAIM",
      JSON.stringify({ cardId: "card_1" }),
      TODAY
    );
    expect(tx.vaultTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.vaultTransaction.create).toHaveBeenCalledWith({
      data: {
        vaultId: "vault_1",
        credits: 0,
        balanceAfter: 100,
        type: "EARN_ACTIVE",
        source: "DAILY_LOGIN_CARD",
        metadata: JSON.stringify({ cardId: "card_1", cardTitle: "Test Card", finish: "FOIL" }),
      },
    });
  });

  it("CARD: keeps the card's own artwork", async () => {
    const { db, tx } = makeCardDb();
    tx.card.findFirst = jest.fn().mockResolvedValue({ ...CARD, artwork: "/art/card_1.png" });

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result.cardAwarded?.artwork).toBe("/art/card_1.png");
  });

  it("CARD: rolls the rarity by the Economy tab's daily odds", async () => {
    const { db, tx } = makeCardDb({ COMMON: 3, LEGENDARY: 2 });
    tx.systemConfig.findMany = jest
      .fn()
      .mockResolvedValue([{ key: "card_economy_daily_legendary_pct", value: "100" }]);
    // 0 rolls Common by the default odds
    jest.spyOn(Math, "random").mockReturnValue(0);

    await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(tx.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [DAILY_POOL_WHERE, { rarity: "LEGENDARY" }] } })
    );
  });

  it("CARD: gives an empty rarity's share to the rarities that have cards", async () => {
    const { db, tx } = makeCardDb({ UNCOMMON: 3 });
    // 0 rolls Common by the daily odds, but no Common card is in the pool
    jest.spyOn(Math, "random").mockReturnValue(0);

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result.success).toBe(true);
    expect(tx.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [DAILY_POOL_WHERE, { rarity: "UNCOMMON" }] } })
    );
  });

  it("CARD: a full collection keeps the claim and says to make room", async () => {
    const { db, tx } = makeCardDb();
    capacityMock.mockRejectedValueOnce(new CapacityError(0));

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "card",
      streak: 3,
      message: "Your collection is full. Break down cards, or buy a capacity upgrade in the Store.",
    });
    expect(tx.card.groupBy).not.toHaveBeenCalled();
    expect(mintMock).not.toHaveBeenCalled();
    expect(grantCardXp).not.toHaveBeenCalled();
    expect(tx.vaultTransaction.create).not.toHaveBeenCalled();
    // The throw inside the transaction callback rolls the slot back, so CREDITS can still be claimed today
    await expect(db.$transaction.mock.results[0].value).rejects.toBeInstanceOf(CapacityError);
  });

  it("CARD: an empty pool (only retired or hidden cards left) awards nothing and keeps the claim", async () => {
    const { db, tx } = makeCardDb({});

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "card",
      streak: 3,
      message: "There is no card to draw right now. Take the credits instead.",
    });
    expect(tx.card.findFirst).not.toHaveBeenCalled();
    expect(mintMock).not.toHaveBeenCalled();
    expect(tx.vaultTransaction.create).not.toHaveBeenCalled();
    await expect(db.$transaction.mock.results[0].value).rejects.toThrow("There is no card to draw");
  });

  it("CARD: any other failure in the transaction is a failed claim", async () => {
    const { db } = makeCardDb();
    capacityMock.mockRejectedValueOnce(new Error("connection reset"));

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "card",
      streak: 0,
      message: "Failed to claim daily reward",
    });
    expect(mintMock).not.toHaveBeenCalled();
  });

  it("CARD: a second same-day claim awards nothing", async () => {
    const { db, tx } = makeCardDb();
    tx.myVault.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

    expect(result).toEqual({
      success: false,
      rewardType: "card",
      streak: 3,
      message: "Daily claim already made today",
    });
    expect(capacityMock).not.toHaveBeenCalled();
    expect(tx.card.groupBy).not.toHaveBeenCalled();
    expect(mintMock).not.toHaveBeenCalled();
  });
});
