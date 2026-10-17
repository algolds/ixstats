/** @jest-environment node */
/** The per-wiki rarity tables in SystemConfig (Economy tab). */
import { getRarityThresholds, setRarityThresholds } from "~/server/modules/cards/cards.config";
import { DEFAULT_RARITY_THRESHOLDS } from "~/lib/cards/rarity-engine";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("rarity thresholds config", () => {
  it("falls back to the defaults for a missing, malformed or non-rising stored table", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([
      {
        key: "card_rarity_thresholds_iiwiki",
        value: JSON.stringify({ UNCOMMON: 10, RARE: 30, ULTRA_RARE: 50, EPIC: 70, LEGENDARY: 90 }),
      },
      { key: "card_rarity_thresholds_althistory", value: "{not json" },
      {
        key: "card_rarity_thresholds_commons",
        value: JSON.stringify({ UNCOMMON: 50, RARE: 40, ULTRA_RARE: 60, EPIC: 70, LEGENDARY: 80 }),
      },
    ]);
    const tables = await getRarityThresholds(db as never);
    expect(tables.iiwiki.UNCOMMON).toBe(10);
    expect(tables.althistory).toEqual(DEFAULT_RARITY_THRESHOLDS.althistory);
    expect(tables.commons).toEqual(DEFAULT_RARITY_THRESHOLDS.commons);
    expect(tables.ixwiki).toEqual(DEFAULT_RARITY_THRESHOLDS.ixwiki);
  });

  it("refuses to store a table whose minimums do not rise, and writes nothing", async () => {
    const db = createMockPrisma();
    await expect(
      setRarityThresholds(db as never, "iiwiki", {
        UNCOMMON: 30,
        RARE: 30,
        ULTRA_RARE: 50,
        EPIC: 70,
        LEGENDARY: 90,
      })
    ).rejects.toThrow(/higher minimum/);
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("stores a valid table under its source's key", async () => {
    const db = createMockPrisma();
    await setRarityThresholds(db as never, "althistory", {
      UNCOMMON: 5,
      RARE: 25,
      ULTRA_RARE: 45,
      EPIC: 65,
      LEGENDARY: 85,
    });
    const value = JSON.stringify({
      UNCOMMON: 5,
      RARE: 25,
      ULTRA_RARE: 45,
      EPIC: 65,
      LEGENDARY: 85,
    });
    expect(db.systemConfig.upsert).toHaveBeenCalledWith({
      where: { key: "card_rarity_thresholds_althistory" },
      update: { value },
      create: {
        key: "card_rarity_thresholds_althistory",
        value,
        description: "Card rarity thresholds: althistory",
      },
    });
  });
});
