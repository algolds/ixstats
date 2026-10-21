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

/** The defaults with `key` at `value`, and the numbers it depends on moved so every section rule can hold. */
function around(key: Key, value: number): CardEconomyConfig {
  const cfg: CardEconomyConfig = { ...CARD_ECONOMY_DEFAULTS, [key]: value };
  if (key === "finishFoilPct") cfg.finishHoloPct = 0;
  if (key === "finishHoloPct") cfg.finishFoilPct = 0;
  if (DAILY.includes(key)) {
    for (const other of DAILY) if (other !== key) cfg[other] = 0;
    const rest = key === "dailyCommonPct" ? "dailyUncommonPct" : "dailyCommonPct";
    cfg[rest] = Math.max(0, toHundredths(100 - value));
  }
  if (key === "fusionCopies") Object.assign(cfg, { dustFoilMult: 1, dustHoloMult: 1 });
  if (key === "dustFoilMult")
    Object.assign(cfg, { fusionCopies: 10, dustHoloMult: Math.max(1, value) });
  if (key === "dustHoloMult") {
    Object.assign(cfg, {
      fusionCopies: 10,
      dustFoilMult: Math.min(10, Math.max(1, Math.ceil(value / 10))),
    });
  }
  return cfg;
}

/** The clamp keeps every number of `cfg` exactly, so a saved number reads back as the admin typed it. */
function expectKept(cfg: CardEconomyConfig) {
  const kept = clampEconomyConfig(cfg);
  for (const key of Object.keys(cfg) as Key[]) {
    expect({ key, value: kept[key] }).toEqual({ key, value: cfg[key] });
  }
}

/** What reading `cfg` back gets wrong: a number the clamp changed, or one its own field or section now refuses. */
function readBackProblems(cfg: CardEconomyConfig): string[] {
  const kept = clampEconomyConfig(cfg);
  const changed = (Object.keys(cfg) as Key[]).filter((key) => !Object.is(kept[key], cfg[key]));
  const refused = ECONOMY_FIELDS.flatMap(
    (field) => numberFieldProblem(field, kept[field.key]) ?? []
  );
  return [...changed, ...refused, ...(economyProblem(kept) ?? [])];
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
  it("have one field for every economy number, in one section each", () => {
    const keys = ECONOMY_FIELDS.map((field) => field.key);
    expect([...keys].sort()).toEqual(Object.keys(CARD_ECONOMY_DEFAULTS).sort());
    expect(ECONOMY_SECTIONS.flatMap((section) => section.fields)).toEqual(ECONOMY_FIELDS);
    expect(ECONOMY_SECTIONS.map((section) => section.id)).toEqual([
      "finishes",
      "daily",
      "dust",
      "crafting",
      "listings",
      "xp",
    ]);
  });

  it("accept the defaults", () => {
    for (const field of ECONOMY_FIELDS) {
      expect(numberFieldProblem(field, CARD_ECONOMY_DEFAULTS[field.key])).toBeNull();
    }
    expect(economyProblem(CARD_ECONOMY_DEFAULTS)).toBeNull();
  });

  it.each(ECONOMY_FIELDS.map((field) => [field.key, field] as const))(
    "bound %s where the clamp does",
    (key, field) => {
      expect(field.max).toBeDefined();
      const max = field.max ?? Number.NaN;
      const past = field.whole ? 1 : 0.01;
      for (const value of [field.min, max]) {
        const cfg = around(key, value);
        expect(numberFieldProblem(field, value)).toBeNull();
        expect(economyProblem(cfg)).toBeNull();
        expectKept(cfg);
      }
      for (const value of [toHundredths(field.min - past), toHundredths(max + past)]) {
        expect(numberFieldProblem(field, value)).not.toBeNull();
        expect(clampEconomyConfig(around(key, value))[key]).not.toBe(value);
      }
    }
  );

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

  it("read back Foil and Holo chances that add up to exactly 100%, every two-place pair", () => {
    expectKept({ ...CARD_ECONOMY_DEFAULTS, finishFoilPct: 91.79, finishHoloPct: 8.21 });
    const broken: string[] = [];
    for (let holo = 0; holo <= 10_000; holo++) {
      const cfg = {
        ...CARD_ECONOMY_DEFAULTS,
        finishFoilPct: (10_000 - holo) / 100,
        finishHoloPct: holo / 100,
      };
      const problems = readBackProblems(cfg);
      if (problems.length > 0)
        broken.push(`${cfg.finishFoilPct} + ${cfg.finishHoloPct}: ${problems.join("; ")}`);
    }
    expect(broken).toEqual([]);
  });

  it("read back daily odds that add up to 100 exactly", () => {
    const random = seeded(7339);
    const broken: string[] = [];
    for (let run = 0; run < 20_000; run++) {
      const cfg = { ...CARD_ECONOMY_DEFAULTS };
      let left = 10_000;
      for (const key of DAILY.slice(1).reverse()) {
        const share = Math.floor(random() * (left + 1));
        cfg[key] = share / 100;
        left -= share;
      }
      cfg.dailyCommonPct = left / 100;
      const problems = readBackProblems(cfg);
      if (problems.length > 0)
        broken.push(`${DAILY.map((key) => cfg[key]).join(", ")}: ${problems.join("; ")}`);
    }
    expect(broken).toEqual([]);
  });

  it("step each input by what the server accepts", () => {
    for (const field of [...ECONOMY_FIELDS, ...MARKET_FIELDS]) {
      const step = field.whole ? (field.step ?? 1) : field.step;
      const expected = field.whole ? 1 : 10 ** -(field.decimals ?? Number.NaN);
      expect({ key: field.key, step }).toEqual({ key: field.key, step: expected });
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

  it("say which bounds a whole number has, without a precision", () => {
    expect(numberFieldProblem(economyField("listingDays"), 0)).toBe(
      "Listing length (days): enter a whole number from 1 to 60."
    );
    expect(numberFieldProblem(economyField("dustCommon"), 2.5)).toBe(
      "Common dust: enter a whole number from 0 to 1,000,000."
    );
  });
});

describe("section rules", () => {
  const sectionCheck = (id: string) => {
    const check = ECONOMY_SECTIONS.find((section) => section.id === id)?.check;
    if (!check) throw new Error(`No check on ${id}`);
    return check;
  };

  it("keep the Foil and Holo chances at 100% together at most", () => {
    const at = (finishFoilPct: number, finishHoloPct: number) =>
      sectionCheck("finishes")({ ...CARD_ECONOMY_DEFAULTS, finishFoilPct, finishHoloPct });
    expect(at(66.67, 33.33)).toBeNull();
    expect(at(98, 3)).toBe("Foil and Holo chances add up to 101%. Keep them at 100% or less.");
    expect(at(66.67, 33.34)).toBe(
      "Foil and Holo chances add up to 100.01%. Keep them at 100% or less."
    );
  });

  it("make the daily odds add up to 100, like a pack's", () => {
    const daily = sectionCheck("daily");
    expect(
      daily({ ...CARD_ECONOMY_DEFAULTS, dailyEpicPct: 0.7, dailyLegendaryPct: 0.3 })
    ).toBeNull();
    expect(daily({ ...CARD_ECONOMY_DEFAULTS, dailyLegendaryPct: 0.2 })).toBe(
      "The daily odds add up to 100.1%. Make them 100%."
    );
    expect(daily({ ...CARD_ECONOMY_DEFAULTS, dailyCommonPct: 60 })).toBe(
      "The daily odds add up to 95%. Make them 100%."
    );
  });

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

  it.each([
    ["multTrophy", 0, 100, 0.05],
    ["finishFoil", 1, 100, 0.5],
    ["finishHolo", 1, 100, 0.5],
    ["levelBonusPerLevel", 0, 0.2, 0.01],
    ["levelBonusCap", 0, 1, 0.05],
    ["medianSales", 1, 50, undefined],
    ["medianDays", 1, 365, undefined],
  ] as const)("bound %s from %s to %s", (key, min, max, step) => {
    const field = fieldOf(CARD_VALUE_FIELDS, key);
    const past = field.whole ? 1 : 0.01;
    expect(field.step).toBe(step);
    expect(numberFieldProblem(field, min)).toBeNull();
    expect(numberFieldProblem(field, max)).toBeNull();
    expect(numberFieldProblem(field, toHundredths(min - past))).not.toBeNull();
    expect(numberFieldProblem(field, toHundredths(max + past))).not.toBeNull();
  });

  it("take the sale counts and days as whole numbers", () => {
    expect(numberFieldProblem(fieldOf(CARD_VALUE_FIELDS, "medianSales"), 4.5)).toBe(
      "Market median sales: enter a whole number from 1 to 50."
    );
    expect(numberFieldProblem(fieldOf(CARD_VALUE_FIELDS, "medianDays"), 30.5)).toBe(
      "Market median window (days): enter a whole number from 1 to 365."
    );
  });
});
