/** @jest-environment node */
/** Pack odds are shown in the store, so they must add up to 100%. */
import { PACK_ODDS_FIELDS, PackOddsSchema, oddsAddUp, packOddsTotal } from "~/lib/cards/pack-odds";

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

it("says why the odds were refused", () => {
  const result = PackOddsSchema.safeParse({ ...seeded, rareOdds: 8 });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe("The odds must add up to 100%");
});
