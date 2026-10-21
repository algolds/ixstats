import type { CardRarity, CardType } from "@prisma/client";
import {
  CARD_VALUATION_DEFAULTS as C,
  clearValuationCache,
  getValuationConfig,
  rarityFloor,
  referenceValue,
  setValuationConfig,
} from "~/lib/cards/valuation";

/** A card's reference value before any copy of it has sold here. */
const unsold = (rarity: CardRarity, cardType: CardType, nsBankValue: number | null = null) =>
  referenceValue({ rarity, cardType, firstSoldAt: null, nsBankValue, isRetired: false }, null, C);

describe("card-valuation", () => {
  test("A Common NS card is lifted to the rarity floor, not stuck at NS bank value 1", () => {
    expect(unsold("COMMON", "NS", 1)).toBe(10);
  });

  test("valuable NS legendary floats above the floor via the premium", () => {
    // 5381 * 1.5 = 8071.5, well above the 3000 legendary floor
    expect(unsold("LEGENDARY", "NS", 5381)).toBe(8071.5);
  });

  test("NS value is never lost before a first sale (premium >= 1 means result >= raw NS value)", () => {
    const ns = 250;
    expect(unsold("RARE", "NS", ns)).toBeGreaterThanOrEqual(ns);
  });

  test("native cards ride the floor curve with type multipliers", () => {
    expect(unsold("RARE", "LORE")).toBe(rarityFloor(C, "RARE"));
    expect(unsold("RARE", "SPECIAL")).toBe(100 * C.multSpecial);
    expect(unsold("RARE", "NATION")).toBe(100 * C.multNation);
  });

  test("a setter in a transaction leaves the cache to its caller, which clears it after the commit", async () => {
    const read = { systemConfig: { findMany: jest.fn().mockResolvedValue([]) } };
    clearValuationCache();
    await getValuationConfig(read as never);
    await setValuationConfig({ systemConfig: { upsert: jest.fn() } } as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(1);
    clearValuationCache();
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(2);
    const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
    await setValuationConfig(app as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(3);
  });

  test("the config has no junk rate", () => {
    expect(C).not.toHaveProperty("junkRate");
  });
});
