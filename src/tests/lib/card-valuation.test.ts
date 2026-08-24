import {
  CARD_VALUATION_DEFAULTS as C,
  computeCardValue,
  junkValue,
  rarityFloor,
} from "~/lib/cards/valuation";

describe("card-valuation", () => {
  test("NS junk common is lifted to the rarity floor, not stuck at NS bank value 1", () => {
    expect(computeCardValue({ rarity: "COMMON", cardType: "NS_IMPORT", nsMarketValue: 1 }, C)).toBe(
      10
    );
  });

  test("valuable NS legendary floats above the floor via the premium", () => {
    // 5381 * 1.5 = 8071.5, well above the 3000 legendary floor
    expect(
      computeCardValue({ rarity: "LEGENDARY", cardType: "NS_IMPORT", nsMarketValue: 5381 }, C)
    ).toBe(8071.5);
  });

  test("NS value is never lost (premium >= 1 means result >= raw NS value)", () => {
    const ns = 250;
    expect(
      computeCardValue({ rarity: "RARE", cardType: "NS_IMPORT", nsMarketValue: ns }, C)
    ).toBeGreaterThanOrEqual(ns);
  });

  test("native cards ride the floor curve with type multipliers", () => {
    expect(computeCardValue({ rarity: "RARE", cardType: "LORE" }, C)).toBe(rarityFloor(C, "RARE"));
    expect(computeCardValue({ rarity: "RARE", cardType: "SPECIAL" }, C)).toBe(100 * C.multSpecial);
    expect(computeCardValue({ rarity: "RARE", cardType: "NATION" }, C)).toBe(100 * C.multNation);
  });

  test("junk pays the rarity floor at default junkRate", () => {
    expect(junkValue(C, "LEGENDARY")).toBe(3000);
    expect(junkValue(C, "COMMON")).toBe(10);
  });
});
