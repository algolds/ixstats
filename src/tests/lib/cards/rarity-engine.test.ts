/** @jest-environment node */
/** The one rarity engine (cards refresh spec §2.1): one score, a threshold table per source wiki. */
import {
  DEFAULT_RARITY_THRESHOLDS,
  RarityThresholdsSchema,
  rarityForScore,
} from "~/lib/cards/rarity-engine";
describe("rarityForScore", () => {
  const table = DEFAULT_RARITY_THRESHOLDS.ixwiki;

  it.each([
    [0, "COMMON"],
    [20.9, "COMMON"],
    [21, "UNCOMMON"],
    [41, "RARE"],
    [60.99, "RARE"],
    [61, "ULTRA_RARE"],
    [81, "EPIC"],
    [95.9, "EPIC"],
    [96, "LEGENDARY"],
    [100, "LEGENDARY"],
  ])("score %p is %s (each minimum is inclusive)", (score, rarity) => {
    expect(rarityForScore(score, table)).toBe(rarity);
  });
});

describe("threshold tables", () => {
  it("needs rising minimums between 0 and 100", () => {
    const table = DEFAULT_RARITY_THRESHOLDS.ixwiki;
    expect(RarityThresholdsSchema.safeParse(table).success).toBe(true);
    expect(RarityThresholdsSchema.safeParse({ ...table, RARE: 21 }).success).toBe(false);
    expect(RarityThresholdsSchema.safeParse({ ...table, LEGENDARY: 101 }).success).toBe(false);
    expect(RarityThresholdsSchema.safeParse({ ...table, UNCOMMON: -1 }).success).toBe(false);
  });
});
