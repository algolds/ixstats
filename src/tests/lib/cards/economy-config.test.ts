/** @jest-environment node */
import {
  CARD_ECONOMY_DEFAULTS,
  clampEconomyConfig,
  clearEconomyConfigCache,
  dailyRarityOdds,
  ECONOMY_CONFIG_KEYS,
  getEconomyConfig,
  setEconomyConfig,
} from "~/lib/cards/economy-config";

const dbWith = (rows: Array<{ key: string; value: string }>) =>
  ({ systemConfig: { findMany: jest.fn().mockResolvedValue(rows) } }) as never;

const clamped = (over: Partial<typeof CARD_ECONOMY_DEFAULTS>) =>
  clampEconomyConfig({ ...CARD_ECONOMY_DEFAULTS, ...over });

beforeEach(() => clearEconomyConfigCache());

describe("card economy config", () => {
  it("defaults to the spec's numbers", async () => {
    const cfg = await getEconomyConfig(dbWith([]));
    expect(cfg).toEqual(CARD_ECONOMY_DEFAULTS);
    expect([cfg.finishFoilPct, cfg.finishHoloPct]).toEqual([8, 2]);
    expect([cfg.dustCommon, cfg.dustEpic, cfg.dustLegendary]).toEqual([5, 500, 1500]);
    expect([cfg.dustFoilMult, cfg.dustHoloMult, cfg.dustImportMult]).toEqual([3, 9, 0.25]);
    expect([cfg.listingFee, cfg.listingFeeFeatured, cfg.listingRefundPct, cfg.listingDays]).toEqual(
      [5, 10, 50, 14]
    );
    expect([cfg.xpPack, cfg.xpDaily, cfg.xpTradePerCard, cfg.xpAuctionWin]).toEqual([
      10, 10, 25, 50,
    ]);
  });

  it("reads stored rows and ignores unreadable ones", async () => {
    const cfg = await getEconomyConfig(
      dbWith([
        { key: "card_economy_listing_fee", value: "7" },
        { key: "card_economy_royalty_pct", value: "abc" },
        { key: "card_economy_xp_pack", value: " " },
        { key: "card_economy_xp_daily", value: "Infinity" },
      ])
    );
    expect(cfg.listingFee).toBe(7);
    expect(cfg.royaltyPct).toBe(2);
    expect(cfg.xpPack).toBe(10);
    expect(cfg.xpDaily).toBe(10);
  });

  it("names one card_economy_ key per field", () => {
    const keys = Object.values(ECONOMY_CONFIG_KEYS);
    expect(Object.keys(ECONOMY_CONFIG_KEYS).sort()).toEqual(
      Object.keys(CARD_ECONOMY_DEFAULTS).sort()
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^card_economy_[a-z_]+$/);
  });

  it("keeps fusion and dust from ever adding dust", () => {
    const cfg = clamped({
      fusionCopies: 2,
      dustFoilMult: 7.4,
      dustHoloMult: 100,
      dustImportMult: 3,
      craftDustMult: 0.2,
    });
    expect(cfg.dustFoilMult).toBe(2);
    expect(cfg.dustHoloMult).toBe(4);
    expect(cfg.dustImportMult).toBe(1);
    expect(cfg.craftDustMult).toBe(1);
  });

  it("allows fusion to be exactly neutral, and no more", () => {
    expect(clamped({ fusionCopies: 4, dustFoilMult: 4, dustHoloMult: 16 })).toMatchObject({
      dustFoilMult: 4,
      dustHoloMult: 16,
    });
    expect(clamped({ fusionCopies: 4, dustFoilMult: 5, dustHoloMult: 17 })).toMatchObject({
      dustFoilMult: 4,
      dustHoloMult: 16,
    });
    expect(clamped({ dustFoilMult: 0, dustHoloMult: 0 })).toMatchObject({
      dustFoilMult: 1,
      dustHoloMult: 1,
    });
    expect(clamped({ dustFoilMult: 3, dustHoloMult: 2 }).dustHoloMult).toBe(3);
  });

  it("keeps fusion between 2 and 10 copies", () => {
    expect(clamped({ fusionCopies: 1 }).fusionCopies).toBe(2);
    expect(clamped({ fusionCopies: 2 }).fusionCopies).toBe(2);
    expect(clamped({ fusionCopies: 10 }).fusionCopies).toBe(10);
    expect(clamped({ fusionCopies: 11 }).fusionCopies).toBe(10);
    expect(clamped({ fusionCopies: 2.6 }).fusionCopies).toBe(3);
  });

  it("keeps the finish odds within 100% and every number non-negative", () => {
    const cfg = clamped({ finishHoloPct: 70, finishFoilPct: 60, xpPack: -5 });
    expect(cfg.finishHoloPct + cfg.finishFoilPct).toBe(100);
    expect(cfg.xpPack).toBe(0);
    expect(clamped({ finishHoloPct: 120 })).toMatchObject({ finishHoloPct: 100, finishFoilPct: 0 });
  });

  it("stores counts, dust, multiples and XP as whole numbers, and leaves the rest as entered", () => {
    const raised = { ...CARD_ECONOMY_DEFAULTS };
    for (const key of Object.keys(raised) as (keyof typeof raised)[]) raised[key] += 0.4;
    const cfg = clampEconomyConfig(raised);
    const whole = [
      "dustCommon",
      "dustUncommon",
      "dustRare",
      "dustUltraRare",
      "dustEpic",
      "dustLegendary",
      "dustFoilMult",
      "dustHoloMult",
      "fusionCopies",
      "listingFee",
      "listingFeeFeatured",
      "listingDays",
      "xpPack",
      "xpDaily",
      "xpTradePerCard",
      "xpAuctionWin",
      "xpHoldingTick",
      "xpDailyCapPerCopy",
    ] as const;
    for (const key of whole)
      expect([key, cfg[key]]).toEqual([key, Math.round(CARD_ECONOMY_DEFAULTS[key] + 0.4)]);
    expect(cfg).toMatchObject({
      finishFoilPct: 8.4,
      finishHoloPct: 2.4,
      dustImportMult: 0.65,
      craftDustMult: 8.4,
      listingRefundPct: 50.4,
      saleFeeThreshold: 100.4,
      royaltyPct: 2.4,
    });
  });

  it("puts a number that is not finite back to its default", () => {
    const cfg = clamped({
      dustHoloMult: Number.POSITIVE_INFINITY,
      xpPack: Number.NaN,
      royaltyPct: Number.NaN,
    });
    expect([cfg.dustHoloMult, cfg.xpPack, cfg.royaltyPct]).toEqual([9, 10, 2]);
  });

  it("bounds the listing days, the refund and the royalty", () => {
    expect(clamped({ listingDays: 0, listingRefundPct: 150, royaltyPct: 60 })).toMatchObject({
      listingDays: 1,
      listingRefundPct: 100,
      royaltyPct: 50,
    });
    expect(clamped({ listingDays: 61 }).listingDays).toBe(60);
    expect(clamped({ listingDays: 60, listingRefundPct: 100, royaltyPct: 50 })).toMatchObject({
      listingDays: 60,
      listingRefundPct: 100,
      royaltyPct: 50,
    });
  });

  it("gives the daily card pack-style odds by rarity", () => {
    expect(dailyRarityOdds(CARD_ECONOMY_DEFAULTS)).toEqual({
      COMMON: 65,
      UNCOMMON: 25,
      RARE: 7,
      ULTRA_RARE: 2,
      EPIC: 0.9,
      LEGENDARY: 0.1,
    });
  });

  it("gives Common whatever a hand-edited daily row leaves over, rarest odds first", () => {
    expect(dailyRarityOdds(clamped({ dailyCommonPct: 90 }))).toEqual(
      dailyRarityOdds(CARD_ECONOMY_DEFAULTS)
    );
    expect(dailyRarityOdds(clamped({ dailyCommonPct: 0, dailyUncommonPct: 5 }))).toMatchObject({
      COMMON: 85,
      UNCOMMON: 5,
    });
    expect(
      dailyRarityOdds(clamped({ dailyLegendaryPct: 60, dailyEpicPct: 50, dailyUltraRarePct: 10 }))
    ).toEqual({ COMMON: 0, UNCOMMON: 0, RARE: 0, ULTRA_RARE: 0, EPIC: 40, LEGENDARY: 60 });
    const odds = dailyRarityOdds(
      clamped({
        dailyLegendaryPct: 0.1,
        dailyEpicPct: 0.6,
        dailyUltraRarePct: 3.3,
        dailyRarePct: 7.7,
        dailyUncommonPct: 24.4,
      })
    );
    expect(odds.COMMON).toBe(63.9);
    expect(Object.values(odds).reduce((sum, pct) => sum + pct, 0)).toBeCloseTo(100, 9);
  });

  it("reads only the economy rows, and again once the minute's cache runs out", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const db = { systemConfig: { findMany } } as never;
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      await getEconomyConfig(db);
      now.mockReturnValue(1_059_999);
      await getEconomyConfig(db);
      expect(findMany).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1_060_000);
      await getEconomyConfig(db);
      expect(findMany).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
    expect(findMany).toHaveBeenCalledWith({
      where: { key: { startsWith: "card_economy_" } },
      select: { key: true, value: true },
    });
  });

  it("stores one number and clears the cache only for the app client", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const read = { systemConfig: { findMany } } as never;
    await getEconomyConfig(read);
    const tx = { systemConfig: { upsert: jest.fn() } };
    await setEconomyConfig(tx as never, "listingFee", 7);
    expect(tx.systemConfig.upsert).toHaveBeenCalledWith({
      where: { key: "card_economy_listing_fee" },
      create: {
        key: "card_economy_listing_fee",
        value: "7",
        description: "Card economy: listingFee",
      },
      update: { value: "7" },
    });
    await getEconomyConfig(read);
    expect(findMany).toHaveBeenCalledTimes(1);
    const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
    await setEconomyConfig(app as never, "listingFee", 7);
    await getEconomyConfig(read);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
