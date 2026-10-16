import {
  CARD_VALUATION_DEFAULTS as C,
  computeCardValue,
  rarityFloor,
  recomputeAllCardValues,
} from "~/lib/cards/valuation";

describe("card-valuation", () => {
  test("A Common NS card is lifted to the rarity floor, not stuck at NS bank value 1", () => {
    expect(computeCardValue({ rarity: "COMMON", cardType: "NS", nsMarketValue: 1 }, C)).toBe(10);
  });

  test("valuable NS legendary floats above the floor via the premium", () => {
    // 5381 * 1.5 = 8071.5, well above the 3000 legendary floor
    expect(computeCardValue({ rarity: "LEGENDARY", cardType: "NS", nsMarketValue: 5381 }, C)).toBe(
      8071.5
    );
  });

  test("NS value is never lost (premium >= 1 means result >= raw NS value)", () => {
    const ns = 250;
    expect(
      computeCardValue({ rarity: "RARE", cardType: "NS", nsMarketValue: ns }, C)
    ).toBeGreaterThanOrEqual(ns);
  });

  test("native cards ride the floor curve with type multipliers", () => {
    expect(computeCardValue({ rarity: "RARE", cardType: "LORE" }, C)).toBe(rarityFloor(C, "RARE"));
    expect(computeCardValue({ rarity: "RARE", cardType: "SPECIAL" }, C)).toBe(100 * C.multSpecial);
    expect(computeCardValue({ rarity: "RARE", cardType: "NATION" }, C)).toBe(100 * C.multNation);
  });

  test("the recompute reads the NS bank value from metadata.nsData, for NS cards", async () => {
    const executeRawUnsafe = jest.fn().mockResolvedValue(1);
    const db = {
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRawUnsafe: executeRawUnsafe,
    };
    await recomputeAllCardValues(db as never);
    const sql = String(executeRawUnsafe.mock.calls[0]![0]);
    expect(sql).toContain(`WHEN "cardType" = 'NS'`);
    expect(sql).toContain(`metadata->'nsData'->>'market_value'`);
    expect(sql).not.toMatch(/stats|NS_IMPORT/);
    expect(executeRawUnsafe).toHaveBeenCalledTimes(6);
  });

  test("the config has no junk rate", () => {
    expect(C).not.toHaveProperty("junkRate");
  });
});
