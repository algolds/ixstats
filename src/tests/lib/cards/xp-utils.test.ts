/** @jest-environment node */
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { grantCardXp, type CardXpSource } from "~/lib/cards/xp-utils";

const NOW = new Date("2026-11-02T12:00:00Z");
const TODAY = new Date("2026-11-02T00:00:00Z");
const YESTERDAY = new Date("2026-11-01T00:00:00Z");

interface XpRow {
  level: number;
  experience: number;
  xpDay: Date | null;
  xpToday: number;
}

function makeTx(row: XpRow | null, stored: Array<{ key: string; value: string }> = []) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue(stored) },
    cardOwnership: {
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cardExperienceEvent: { create: jest.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => clearEconomyConfigCache());

describe("grantCardXp", () => {
  it("grants the source's amount from the Economy tab and logs an event", async () => {
    const tx = makeTx({ level: 1, experience: 990, xpDay: null, xpToday: 0 });
    const result = await grantCardXp(tx as never, "own_1", "TRADE", '{"tradeId":"t1"}', NOW);
    expect(result).toEqual({
      prevLevel: 1,
      newLevel: 2,
      prevXP: 990,
      newXP: 1015,
      leveledUp: true,
      xpGained: 25,
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 990, xpToday: 0 },
      data: { experience: 1015, level: 2, xpToday: 25, xpDay: TODAY },
    });
    expect(tx.cardExperienceEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        amount: 25,
        resultLevel: 2,
        resultXP: 1015,
        source: "TRADE",
        metadata: '{"tradeId":"t1"}',
      },
    });
  });

  it.each<[CardXpSource, number]>([
    ["PACK_OPEN", 11],
    ["DAILY_CLAIM", 12],
    ["TRADE", 13],
    ["AUCTION_WIN", 14],
  ])("reads %s's amount from its own Economy tab number", async (source, amount) => {
    const stored = [
      { key: "card_economy_xp_pack", value: "11" },
      { key: "card_economy_xp_daily", value: "12" },
      { key: "card_economy_xp_trade_per_card", value: "13" },
      { key: "card_economy_xp_auction_win", value: "14" },
    ];
    const tx = makeTx({ level: 1, experience: 0, xpDay: null, xpToday: 0 }, stored);
    expect((await grantCardXp(tx as never, "own_1", source, undefined, NOW)).xpGained).toBe(amount);
    expect(tx.cardExperienceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount, source, metadata: null }),
    });
  });

  it("stops at the daily cap per copy and writes nothing once it is reached", async () => {
    const capped = makeTx({ level: 3, experience: 2400, xpDay: TODAY, xpToday: 100 });
    expect(await grantCardXp(capped as never, "own_1", "AUCTION_WIN", undefined, NOW)).toEqual({
      prevLevel: 3,
      newLevel: 3,
      prevXP: 2400,
      newXP: 2400,
      leveledUp: false,
      xpGained: 0,
    });
    expect(capped.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(capped.cardExperienceEvent.create).not.toHaveBeenCalled();

    const partial = makeTx({ level: 3, experience: 2400, xpDay: TODAY, xpToday: 80 });
    expect(
      (await grantCardXp(partial as never, "own_1", "AUCTION_WIN", undefined, NOW)).xpGained
    ).toBe(20);
    expect(partial.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 2400, xpToday: 80 },
      data: { experience: 2420, level: 3, xpToday: 100, xpDay: TODAY },
    });
  });

  it("starts a new UTC day's cap at zero", async () => {
    const tx = makeTx({ level: 3, experience: 2400, xpDay: YESTERDAY, xpToday: 100 });
    expect((await grantCardXp(tx as never, "own_1", "TRADE", undefined, NOW)).xpGained).toBe(25);
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 2400, xpToday: 100 },
      data: { experience: 2425, level: 3, xpToday: 25, xpDay: TODAY },
    });
  });

  it("keeps the level at 10 while XP keeps counting", async () => {
    const tx = makeTx({ level: 10, experience: 12_000, xpDay: null, xpToday: 0 });
    expect(await grantCardXp(tx as never, "own_1", "PACK_OPEN", undefined, NOW)).toMatchObject({
      newLevel: 10,
      newXP: 12_010,
      leveledUp: false,
    });
  });

  it("re-reads and retries when another grant changed the copy first", async () => {
    const tx = makeTx({ level: 1, experience: 0, xpDay: null, xpToday: 0 });
    tx.cardOwnership.findUnique
      .mockResolvedValueOnce({ level: 1, experience: 0, xpDay: null, xpToday: 0 })
      .mockResolvedValueOnce({ level: 1, experience: 95, xpDay: TODAY, xpToday: 95 });
    tx.cardOwnership.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await grantCardXp(tx as never, "own_1", "PACK_OPEN", undefined, NOW);

    expect(result).toMatchObject({ prevXP: 95, newXP: 100, xpGained: 5 });
    expect(tx.cardOwnership.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.cardOwnership.updateMany).toHaveBeenLastCalledWith({
      where: { id: "own_1", experience: 95, xpToday: 95 },
      data: { experience: 100, level: 1, xpToday: 100, xpDay: TODAY },
    });
    expect(tx.cardExperienceEvent.create).toHaveBeenCalledTimes(1);
  });

  it("gives up after three conflicting grants, writing no event", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = makeTx({ level: 2, experience: 1500, xpDay: null, xpToday: 0 });
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    expect(await grantCardXp(tx as never, "own_1", "TRADE", undefined, NOW)).toMatchObject({
      prevXP: 1500,
      newXP: 1500,
      xpGained: 0,
      leveledUp: false,
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.cardExperienceEvent.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("own_1"));
    warn.mockRestore();
  });

  it("does nothing for a copy that no longer exists", async () => {
    const tx = makeTx(null);
    expect(await grantCardXp(tx as never, "gone", "TRADE", undefined, NOW)).toEqual({
      prevLevel: 0,
      newLevel: 0,
      prevXP: 0,
      newXP: 0,
      leveledUp: false,
      xpGained: 0,
    });
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing for a copy that went while it retried", async () => {
    const tx = makeTx({ level: 2, experience: 1500, xpDay: null, xpToday: 0 });
    tx.cardOwnership.findUnique.mockResolvedValueOnce({
      level: 2,
      experience: 1500,
      xpDay: null,
      xpToday: 0,
    });
    tx.cardOwnership.findUnique.mockResolvedValueOnce(null);
    tx.cardOwnership.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await grantCardXp(tx as never, "own_1", "TRADE", undefined, NOW)).toMatchObject({
      prevLevel: 0,
      newLevel: 0,
      xpGained: 0,
    });
    expect(tx.cardExperienceEvent.create).not.toHaveBeenCalled();
  });
});
