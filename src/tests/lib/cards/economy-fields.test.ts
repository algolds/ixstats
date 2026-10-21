/** @jest-environment node */
/**
 * The Economy tab's number fields. The tab and the server accept exactly the numbers the stored config keeps as they
 * are, so the clamp on read never changes a save, and no rate is cut short by the basis-point maths.
 */
import {
  CARD_ECONOMY_DEFAULTS,
  clampEconomyConfig,
  type CardEconomyConfig,
} from "~/lib/cards/economy-config";
import {
  CARD_VALUE_FIELDS,
  ECONOMY_FIELDS,
  ECONOMY_SECTIONS,
  MARKET_FIELDS,
  economyProblem,
  numberFieldProblem,
  type EconomyNumberField,
} from "~/lib/cards/economy-fields";
import {
  CARD_VALUATION_DEFAULTS,
  clampValuationConfig,
  type CardValuationConfig,
} from "~/lib/cards/valuation";

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

  it("are all applied by economyProblem, the server's check", () => {
    expect(economyProblem({ ...CARD_ECONOMY_DEFAULTS, finishFoilPct: 99 })).toMatch(
      /^Foil and Holo/
    );
    expect(economyProblem({ ...CARD_ECONOMY_DEFAULTS, dailyRarePct: 8 })).toMatch(
      /^The daily odds/
    );
    expect(economyProblem({ ...CARD_ECONOMY_DEFAULTS, fusionCopies: 2 })).toMatch(/^The Foil dust/);
    expect(economyProblem({ ...CARD_ECONOMY_DEFAULTS, dustHoloMult: 10 })).toMatch(
      /^The Holo dust/
    );
  });
});

describe("card value fields", () => {
  it("accept only values the valuation clamp keeps", () => {
    for (const field of CARD_VALUE_FIELDS) {
      expect(field.max).toBeDefined();
      for (const value of [field.min, field.max ?? Number.NaN]) {
        const cfg: CardValuationConfig = { ...CARD_VALUATION_DEFAULTS, [field.key]: value };
        expect(numberFieldProblem(field, value)).toBeNull();
        expect({ key: field.key, value: clampValuationConfig(cfg)[field.key] }).toEqual({
          key: field.key,
          value,
        });
      }
    }
  });
});
