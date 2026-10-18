/** @jest-environment node */
import {
  baseValue,
  CARD_VALUATION_DEFAULTS as cfg,
  clampValuationConfig,
  valueOfCopy,
  levelBonus,
  medianOf,
  readValuationConfig,
  referenceValue,
  type ValueCard,
} from "~/lib/cards/valuation";

const card = (over: Partial<ValueCard> = {}): ValueCard => ({
  rarity: "RARE",
  cardType: "LORE",
  firstSoldAt: null,
  nsBankValue: null,
  isRetired: false,
  ...over,
});

describe("the value formula", () => {
  it("is floor x type x finish when nothing has sold", () => {
    expect(baseValue(card(), "STANDARD", null, cfg)).toBe(100);
    expect(baseValue(card(), "FOIL", null, cfg)).toBe(300);
    expect(baseValue(card(), "HOLO", null, cfg)).toBe(900);
    expect(baseValue(card({ cardType: "NATION" }), "STANDARD", null, cfg)).toBe(150);
    expect(baseValue(card({ cardType: "SPECIAL" }), "STANDARD", null, cfg)).toBe(200);
    expect(baseValue(card({ cardType: "TROPHY", rarity: "EPIC" }), "SERIALISED", null, cfg)).toBe(
      250
    );
  });

  it("takes the market median when it is higher", () => {
    expect(baseValue(card(), "STANDARD", 180, cfg)).toBe(180);
    expect(baseValue(card(), "FOIL", 180, cfg)).toBe(300);
  });

  it("keeps the NS bank term only until the card first sells here", () => {
    const ns = card({ cardType: "NS", rarity: "COMMON", nsBankValue: 40 });
    expect(baseValue(ns, "STANDARD", null, cfg)).toBe(60);
    expect(baseValue({ ...ns, firstSoldAt: new Date("2026-11-01") }, "STANDARD", null, cfg)).toBe(
      10
    );
    expect(baseValue(card({ nsBankValue: 999 }), "STANDARD", null, cfg)).toBe(100);
  });

  it("adds 2% per level above 1, capped at 20%, on top of the max", () => {
    expect(levelBonus(1, cfg)).toBe(0);
    expect(levelBonus(5, cfg)).toBeCloseTo(0.08);
    expect(levelBonus(10, cfg)).toBeCloseTo(0.18);
    expect(levelBonus(99, cfg)).toBeCloseTo(0.18);
    expect(levelBonus(10, { ...cfg, levelBonusPerLevel: 0.05 })).toBe(0.2);
    expect(valueOfCopy({ card: card(), finish: "FOIL", level: 6, median: null }, cfg)).toBe(330);
  });

  it("gives a retired card's copy no value, whatever its finish, level, median or bank value", () => {
    const retired = card({ cardType: "NS", nsBankValue: 5000, isRetired: true });
    expect(valueOfCopy({ card: retired, finish: "HOLO", level: 10, median: 900 }, cfg)).toBe(0);
    expect(
      valueOfCopy(
        { card: card({ isRetired: true }), finish: "STANDARD", level: 1, median: null },
        cfg
      )
    ).toBe(0);
  });

  it("gives Card.marketValue as a Standard copy at level 1", () => {
    expect(referenceValue(card(), 120, cfg)).toBe(120);
    expect(referenceValue(card(), null, cfg)).toBe(100);
  });

  it("takes the median of the last sales (mean of the middle two when even)", () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([50])).toBe(50);
    expect(medianOf([300, 100, 200])).toBe(200);
    expect(medianOf([100, 400, 200, 300])).toBe(250);
  });

  it("clamps stored numbers", () => {
    const clamped = clampValuationConfig({
      ...cfg,
      medianSales: 0,
      medianDays: 9999,
      levelBonusCap: 4,
      multTrophy: -1,
    });
    expect([
      clamped.medianSales,
      clamped.medianDays,
      clamped.levelBonusCap,
      clamped.multTrophy,
    ]).toEqual([1, 365, 1, 0]);
    expect(clampValuationConfig({ ...cfg, medianSales: 80.4, medianDays: 0.4 })).toMatchObject({
      medianSales: 50,
      medianDays: 1,
    });
    expect(clampValuationConfig(cfg)).toEqual(cfg);
  });

  it("falls back to the default for a stored number that is not finite", async () => {
    const rows = [
      { key: "card_valuation_floor_rare", value: "Infinity" },
      { key: "card_valuation_finish_holo", value: "1e999" },
      { key: "card_valuation_mult_trophy", value: "-Infinity" },
      { key: "card_valuation_median_days", value: "soon" },
    ];
    const db = { systemConfig: { findMany: jest.fn().mockResolvedValue(rows) } };
    await expect(readValuationConfig(db as never)).resolves.toMatchObject({
      floorRare: 100,
      finishHolo: 9,
      multTrophy: 0.25,
      medianDays: 30,
    });
  });

  it("reads the new numbers from their keys, clamped", async () => {
    const rows = [
      { key: "card_valuation_mult_trophy", value: "0.5" },
      { key: "card_valuation_finish_foil", value: "4" },
      { key: "card_valuation_finish_holo", value: "12" },
      { key: "card_valuation_level_bonus_per_level", value: "0.03" },
      { key: "card_valuation_level_bonus_cap", value: "7" },
      { key: "card_valuation_median_sales", value: "-3" },
      { key: "card_valuation_median_days", value: "14" },
    ];
    const db = { systemConfig: { findMany: jest.fn().mockResolvedValue(rows) } };
    await expect(readValuationConfig(db as never)).resolves.toMatchObject({
      multTrophy: 0.5,
      finishFoil: 4,
      finishHolo: 12,
      levelBonusPerLevel: 0.03,
      levelBonusCap: 1,
      medianSales: 1,
      medianDays: 14,
    });
  });
});
