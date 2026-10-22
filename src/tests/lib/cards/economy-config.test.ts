/** @jest-environment node */
/**
 * The Economy tab's numbers (`economy-config.ts`, `economy-fields.ts`): every stored number is read clamped, so a
 * slipped digit or an unreadable row never reaches a yield, a cost, a fee or an Int column, and fusing and breaking
 * down never make dust. The tab accepts exactly the numbers the clamp keeps, so a save reads back as typed, and no
 * rate is finer than the basis-point maths can carry.
 *
 * Folds economy-fields.
 */
import {
  CARD_ECONOMY_DEFAULTS,
  clampEconomyConfig,
  clearEconomyConfigCache,
  dailyRarityOdds,
  getEconomyConfig,
  type CardEconomyConfig,
} from "~/lib/cards/economy-config";
import {
  ECONOMY_FIELDS,
  ECONOMY_SECTIONS,
  MARKET_FIELDS,
  economyProblem,
  numberFieldProblem,
  type EconomyNumberField,
} from "~/lib/cards/economy-fields";

const dbWith = (rows: Array<{ key: string; value: string }>) =>
  ({ systemConfig: { findMany: jest.fn().mockResolvedValue(rows) } }) as never;

const clamped = (over: Partial<typeof CARD_ECONOMY_DEFAULTS>) =>
  clampEconomyConfig({ ...CARD_ECONOMY_DEFAULTS, ...over });

beforeEach(() => clearEconomyConfigCache());

describe("card economy config", () => {
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

  it("keeps the finish odds within 100% and every number non-negative", () => {
    const cfg = clamped({ finishHoloPct: 70, finishFoilPct: 60, xpPack: -5 });
    expect(cfg.finishHoloPct + cfg.finishFoilPct).toBe(100);
    expect(cfg.xpPack).toBe(0);
    expect(clamped({ finishHoloPct: 120 })).toMatchObject({ finishHoloPct: 100, finishFoilPct: 0 });
  });

  it("caps every number against a slipped digit, so no yield, cost, fee or XP passes an Int", () => {
    const set = (value: number) => {
      const cfg = { ...CARD_ECONOMY_DEFAULTS };
      for (const key of Object.keys(cfg) as (keyof typeof cfg)[]) cfg[key] = value;
      return clampEconomyConfig(cfg);
    };
    const dust = 1_000_000;
    const most = 100_000;
    expect(set(1e12)).toEqual({
      finishFoilPct: 0,
      finishHoloPct: 100,
      dailyCommonPct: 0,
      dailyUncommonPct: 0,
      dailyRarePct: 0,
      dailyUltraRarePct: 0,
      dailyEpicPct: 0,
      dailyLegendaryPct: 100,
      dustCommon: dust,
      dustUncommon: dust,
      dustRare: dust,
      dustUltraRare: dust,
      dustEpic: dust,
      dustLegendary: dust,
      dustFoilMult: 10,
      dustHoloMult: 100,
      dustImportMult: 1,
      fusionCopies: 10,
      craftDustMult: 100,
      listingFee: most,
      listingFeeFeatured: most,
      listingRefundPct: 100,
      listingDays: 60,
      saleFeeThreshold: 1_000_000,
      royaltyPct: 50,
      xpPack: most,
      xpDaily: most,
      xpTradePerCard: most,
      xpAuctionWin: most,
      xpHoldingTick: most,
      xpDailyCapPerCopy: most,
    });
    expect(set(-1e12)).toEqual({
      finishFoilPct: 0,
      finishHoloPct: 0,
      dailyCommonPct: 100,
      dailyUncommonPct: 0,
      dailyRarePct: 0,
      dailyUltraRarePct: 0,
      dailyEpicPct: 0,
      dailyLegendaryPct: 0,
      dustCommon: 0,
      dustUncommon: 0,
      dustRare: 0,
      dustUltraRare: 0,
      dustEpic: 0,
      dustLegendary: 0,
      dustFoilMult: 1,
      dustHoloMult: 1,
      dustImportMult: 0,
      fusionCopies: 2,
      craftDustMult: 1,
      listingFee: 0,
      listingFeeFeatured: 0,
      listingRefundPct: 0,
      listingDays: 1,
      saleFeeThreshold: 0,
      royaltyPct: 0,
      xpPack: 0,
      xpDaily: 0,
      xpTradePerCard: 0,
      xpAuctionWin: 0,
      xpHoldingTick: 0,
      xpDailyCapPerCopy: 0,
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

  it("keeps the daily odds to the hundredth, so they add up to exactly 100", () => {
    const total = (pct: Record<string, number>) =>
      Object.values(pct).reduce((sum, p) => sum + p, 0);
    const down = dailyRarityOdds(clamped({ dailyLegendaryPct: 0.123 }));
    expect([down.LEGENDARY, down.COMMON]).toEqual([0.12, 64.98]);
    expect(total(down)).toBeCloseTo(100, 9);
    const up = dailyRarityOdds(clamped({ dailyLegendaryPct: 0.126 }));
    expect([up.LEGENDARY, up.COMMON]).toEqual([0.13, 64.97]);
    expect(total(up)).toBeCloseTo(100, 9);
  });
});

type Key = keyof CardEconomyConfig;

function fieldOf<K extends string>(fields: ReadonlyArray<EconomyNumberField<K>>, key: K) {
  const field = fields.find((f) => f.key === key);
  if (!field) throw new Error(`No field for ${key}`);
  return field;
}
const economyField = (key: Key) => fieldOf(ECONOMY_FIELDS, key);

const toHundredths = (value: number) => Math.round(value * 100) / 100;

const DAILY: readonly Key[] = [
  "dailyCommonPct",
  "dailyUncommonPct",
  "dailyRarePct",
  "dailyUltraRarePct",
  "dailyEpicPct",
  "dailyLegendaryPct",
];

/** The clamp keeps every number of `cfg` exactly, so a saved number reads back as the admin typed it. */
function expectKept(cfg: CardEconomyConfig) {
  const kept = clampEconomyConfig(cfg);
  for (const key of Object.keys(cfg) as Key[]) {
    expect({ key, value: kept[key] }).toEqual({ key, value: cfg[key] });
  }
}

/** A seeded generator, so a failure repeats. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number `field` accepts within `low` and `high`: often an end, otherwise anywhere at the field's precision. */
function draw(random: () => number, field: EconomyNumberField, low: number, high: number): number {
  const pick = random();
  if (pick < 0.125) return low;
  if (pick < 0.25) return high;
  const value = low + random() * (high - low);
  if (field.whole) return Math.round(value);
  const unit = 10 ** (field.decimals ?? 0);
  return Math.min(high, Math.max(low, Math.round(value * unit) / unit));
}

/** A whole config the Economy tab would save: each number in bounds, and every section rule holding. */
function savableConfig(random: () => number): CardEconomyConfig {
  const cfg = { ...CARD_ECONOMY_DEFAULTS };
  const take = (key: Key, low: number, high: number) => {
    cfg[key] = draw(random, economyField(key), low, high);
  };
  for (const field of ECONOMY_FIELDS) take(field.key, field.min, field.max ?? field.min);
  take("finishFoilPct", 0, toHundredths(100 - cfg.finishHoloPct));
  let left = 100;
  for (const key of DAILY.slice(1).reverse()) {
    take(key, 0, left);
    left = toHundredths(left - cfg[key]);
  }
  cfg.dailyCommonPct = left;
  take("dustFoilMult", 1, cfg.fusionCopies);
  take("dustHoloMult", cfg.dustFoilMult, cfg.fusionCopies * cfg.dustFoilMult);
  return cfg;
}

describe("the economy fields", () => {
  it("accept only configs the clamp keeps as they are", () => {
    const random = seeded(24);
    for (let run = 0; run < 1000; run++) {
      const cfg = savableConfig(random);
      for (const field of ECONOMY_FIELDS) {
        expect(numberFieldProblem(field, cfg[field.key])).toBeNull();
      }
      expect(economyProblem(cfg)).toBeNull();
      expectKept(cfg);
    }
  });
});

describe("rates and shares", () => {
  it("refuse a rate finer than a hundredth, so the basis-point maths never cuts one short", () => {
    const rake = fieldOf(MARKET_FIELDS, "auctionHouseRakePct");
    expect(numberFieldProblem(rake, 7.555)).toBe(
      "Market fee (%): enter a number from 0 to 50 with at most 2 decimal places."
    );
    expect(numberFieldProblem(rake, 7.5500001)).not.toBeNull();
    for (const value of [7.55, 0.29, 0.57, 50]) expect(numberFieldProblem(rake, value)).toBeNull();
    expect(numberFieldProblem(rake, 50.01)).toBe(
      "Market fee (%): enter a number from 0 to 50 with at most 2 decimal places."
    );
    for (const [key, finer, hundredth] of [
      ["royaltyPct", 1.005, 1.01],
      ["listingRefundPct", 1.005, 1.01],
      ["craftDustMult", 1.005, 1.01],
      ["dustImportMult", 0.505, 0.51],
      ["finishFoilPct", 0.125, 0.13],
      ["dailyEpicPct", 0.125, 0.13],
    ] as const) {
      expect(numberFieldProblem(economyField(key), finer)).toMatch(
        /with at most 2 decimal places\.$/
      );
      expect(numberFieldProblem(economyField(key), hundredth)).toBeNull();
    }
  });
});

describe("section rules", () => {
  const sectionCheck = (id: string) => {
    const check = ECONOMY_SECTIONS.find((section) => section.id === id)?.check;
    if (!check) throw new Error(`No check on ${id}`);
    return check;
  };
  it("keep fusing and breaking down from ever making dust, in the dust and the crafting sections", () => {
    for (const id of ["dust", "crafting"]) {
      const loop = (fusionCopies: number, dustFoilMult: number, dustHoloMult: number) =>
        sectionCheck(id)({ ...CARD_ECONOMY_DEFAULTS, fusionCopies, dustFoilMult, dustHoloMult });
      expect(loop(3, 3, 9)).toBeNull();
      expect(loop(3, 1, 1)).toBeNull();
      expect(loop(2, 3, 6)).toBe(
        "The Foil dust multiple can be at most the copies per fusion, 2, or fusing would make dust."
      );
      expect(loop(3, 3, 10)).toBe(
        "The Holo dust multiple needs to be from 3 to 9: at least the Foil multiple, and at most the copies per fusion times it."
      );
      expect(loop(3, 3, 2)).toBe(
        "The Holo dust multiple needs to be from 3 to 9: at least the Foil multiple, and at most the copies per fusion times it."
      );
    }
  });
});
