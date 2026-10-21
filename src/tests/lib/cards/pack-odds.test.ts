/** @jest-environment node */
/** Pack odds are shown in the store, so they must add up to 100%. */
import {
  DEFAULT_PACK_ODDS,
  PACK_ODDS_FIELDS,
  PackOddsSchema,
  oddsAddUp,
  packOddsTotal,
  rarityList,
  undeliverableRarities,
} from "~/lib/cards/pack-odds";
const seeded = {
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,
};

it("lists every rarity, lowest first, with its odds column", () => {
  expect(PACK_ODDS_FIELDS.map(([rarity]) => rarity)).toEqual([
    "COMMON",
    "UNCOMMON",
    "RARE",
    "ULTRA_RARE",
    "EPIC",
    "LEGENDARY",
  ]);
  expect(PACK_ODDS_FIELDS[3]).toEqual(["ULTRA_RARE", "ultraRareOdds"]);
});

it("accepts odds that add up to 100, allowing float rounding", () => {
  expect(packOddsTotal(seeded)).toBeCloseTo(100);
  expect(oddsAddUp(seeded)).toBe(true);
  expect(oddsAddUp({ ...seeded, commonOdds: 65.005 })).toBe(true);
  expect(PackOddsSchema.safeParse(seeded).success).toBe(true);
});

it("refuses odds that do not add up to 100, or any odd outside 0 to 100", () => {
  expect(oddsAddUp({ ...seeded, commonOdds: 64.5 })).toBe(false);
  expect(PackOddsSchema.safeParse({ ...seeded, commonOdds: 64.5 }).success).toBe(false);
  expect(PackOddsSchema.safeParse({ ...seeded, commonOdds: 165, uncommonOdds: -75 }).success).toBe(
    false
  );
});
it("gives a new pack the seeded odds, which add up", () => {
  expect(DEFAULT_PACK_ODDS).toEqual(seeded);
  expect(PackOddsSchema.safeParse(DEFAULT_PACK_ODDS).success).toBe(true);
});

describe("undeliverableRarities", () => {
  const everyTier = { COMMON: 9, UNCOMMON: 9, RARE: 9, ULTRA_RARE: 9, EPIC: 9, LEGENDARY: 9 };

  it("names each rarity with odds but no card in the pool, an uncounted one included, lowest first", () => {
    expect(undeliverableRarities(seeded, null, everyTier)).toEqual([]);
    expect(
      undeliverableRarities(seeded, null, {
        COMMON: 9,
        UNCOMMON: 9,
        RARE: 9,
        ULTRA_RARE: 9,
        EPIC: 0,
      })
    ).toEqual(["EPIC", "LEGENDARY"]);
  });

  it("names a guaranteed rarity with no card, even at odds of 0", () => {
    const noLegendary = { ...seeded, commonOdds: 65.1, legendaryOdds: 0 };
    expect(undeliverableRarities(noLegendary, "LEGENDARY", { ...everyTier, LEGENDARY: 0 })).toEqual(
      ["LEGENDARY"]
    );
    expect(undeliverableRarities(noLegendary, "LEGENDARY", everyTier)).toEqual([]);
  });

  it("ignores an empty rarity the pack never gives", () => {
    const noLegendary = { ...seeded, commonOdds: 65.1, legendaryOdds: 0 };
    expect(undeliverableRarities(noLegendary, null, { ...everyTier, LEGENDARY: 0 })).toEqual([]);
    expect(undeliverableRarities(noLegendary, "EPIC", { ...everyTier, LEGENDARY: 0 })).toEqual([]);
  });
});

it("lists rarities by name for a refusal", () => {
  expect(rarityList(["EPIC"])).toBe("Epic");
  expect(rarityList(["EPIC", "LEGENDARY"])).toBe("Epic and Legendary");
  expect(rarityList(["RARE", "ULTRA_RARE", "LEGENDARY"])).toBe("Rare, Ultra Rare and Legendary");
  expect(rarityList([])).toBe("");
});
