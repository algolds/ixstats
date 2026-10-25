/** @jest-environment node */
/**
 * StorytellerEffect writes and what the projection does with them (MyCountry audit P0-14, P0-15,
 * P1-31, P2-10): every effect is stamped with IxTime through one helper, growth effects became
 * level effects that are neither retroactive nor rewritten when they end, upper-case types are
 * read, every written type has a reader, the natural-disaster GDP hit sticks, and the tier cap
 * follows the tier GDP per capita is in.
 */
import fs from "node:fs";
import path from "node:path";
import { IxStatsCalculator, StorytellerEffectType } from "~/lib/economy/calculations";
import {
  planLevelSync,
  storytellerEffectData,
  WRITABLE_EFFECT_TYPES,
  type LevelRow,
  type StorytellerEffectDraft,
} from "~/lib/economy/storyteller-effects";
import { conflictEconomicEffects } from "~/lib/military/conflict-outcome";
import { policyGdpLevelShift, POLICY_PHASE_IN_YEARS } from "~/lib/policies/effects-sync";
import { worldEventEffectDrafts } from "~/lib/economy/world-event-effects";
import { IxTime } from "~/lib/ixtime";
import type { BaseCountryData, EconomicConfig, StorytellerEffect } from "~/types/ixstats";

const config: EconomicConfig = {
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    impoverished: 0,
    developing: 10000,
    developed: 25000,
    healthy: 35000,
    strong: 45000,
    veryStrong: 55000,
    extravagant: 65000,
  },
  populationTierThresholds: {
    tier1: 0,
    tier2: 10_000_000,
    tier3: 30_000_000,
    tier4: 50_000_000,
    tier5: 80_000_000,
    tier6: 120_000_000,
    tier7: 350_000_000,
    tierX: 500_000_000,
  },
  tierGrowthModifiers: {},
  calculationIntervalMs: 60_000,
  ixTimeUpdateFrequency: 30_000,
};

const BASELINE = Date.UTC(2040, 0, 1);
/** "Now": two IxTime years after the baseline. */
const NOW = IxTime.addYears(BASELINE, 2);
const YEAR = 365.25 * 24 * 60 * 60 * 1000;

const base: BaseCountryData = {
  country: "Testland",
  population: 20_000_000,
  gdpPerCapita: 30_000,
  maxGdpGrowthRate: 0.05,
  adjustedGdpGrowth: 0.03,
  populationGrowthRate: 0.005,
  actualGdpGrowth: 0,
  projected2040Population: 0,
  projected2040Gdp: 0,
  projected2040GdpPerCapita: 0,
  localGrowthFactor: 1,
};

function project(
  at: number,
  effects: StorytellerEffect[] = [],
  overrides: Partial<BaseCountryData> = {}
) {
  const calc = new IxStatsCalculator(config, BASELINE);
  return calc.calculateTimeProgression(
    calc.initializeCountryStats({ ...base, ...overrides }),
    at,
    effects
  ).newStats;
}

/** The rows the helper writes for these drafts, as the projection reads them. */
function rows(drafts: StorytellerEffectDraft[], ixTime = NOW): StorytellerEffect[] {
  return drafts.map((d) => {
    const data = storytellerEffectData({ ixTime, ...d });
    return {
      inputType: data.inputType,
      value: data.value,
      duration: data.duration ?? null,
      isActive: true,
      ixTimeTimestamp: new Date(data.ixTimeTimestamp).getTime(),
    };
  });
}

const gdppc = (at: number, effects: StorytellerEffect[] = []) =>
  project(at, effects).currentGdpPerCapita;

describe("P0-14: one helper stamps IxTime", () => {
  it("refuses a wall-clock start: real 2026 is before the IxTime epoch, so the projection would drop it", () => {
    const wallClock = Date.UTC(2026, 5, 21);
    expect(() =>
      storytellerEffectData({
        countryId: "c1",
        inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
        value: -0.0075,
        ixTime: wallClock,
      })
    ).toThrow(/before the IxTime epoch/);
  });

  it("a severe sanction and a lost war now cost GDP (they used to leave it untouched)", () => {
    const sanction = rows([
      {
        countryId: "c1",
        inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
        value: -0.0075,
        duration: 4,
      },
    ]);
    const at = NOW + 4 * YEAR;
    expect(gdppc(at, sanction) / gdppc(at)).toBeCloseTo(0.9925, 6);

    const war = rows(
      conflictEconomicEffects({
        initiator: { id: "c1", name: "A" },
        defender: { id: "c2", name: "B" },
        outcome: {
          initiatorWins: false,
          initiatorCasualties: 0,
          defenderCasualties: 0,
          economicDamage: 0.02,
        },
        createdBy: "u1",
        defenderWinLabel: "victory",
      }).filter((d) => d.countryId === "c1")
    );
    expect(gdppc(at, war) / gdppc(at)).toBeCloseTo(0.97, 6);
  });
});

describe("P0-15: growth effects are level effects", () => {
  const policy = (gdpEffect: number) =>
    rows([
      {
        countryId: "c1",
        inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
        value: policyGdpLevelShift(gdpEffect),
        duration: POLICY_PHASE_IN_YEARS,
        createdBy: "POLICY:p1",
      },
    ]);

  it("policy gdpEffect +2 is a +2% GDP level, phased in, never back-dated", () => {
    const effects = policy(2);
    expect(gdppc(NOW - 1000, effects)).toBe(gdppc(NOW - 1000));
    expect(gdppc(NOW + 1000, effects) / gdppc(NOW + 1000)).toBeCloseTo(1, 4);
    expect(gdppc(NOW + 3 * YEAR, effects) / gdppc(NOW + 3 * YEAR)).toBeCloseTo(1.02, 6);
  });

  it("ending it unwinds from then on and leaves the projected past alone", () => {
    const enacted = policy(2);
    const existing: LevelRow[] = [
      {
        countryId: "c1",
        inputType: "gdp_level_adjustment",
        value: 0.02,
        duration: 1,
        description: "Active policy: P",
        createdBy: "POLICY:p1",
        worldEventId: null,
      },
    ];
    const end = NOW + 2 * YEAR;
    const reversal = rows(planLevelSync(existing, []), end);
    expect(reversal).toHaveLength(1);
    const ended = [...enacted, ...reversal];

    for (const at of [NOW + YEAR / 2, NOW + YEAR, end]) {
      expect(gdppc(at, ended)).toBeCloseTo(gdppc(at, enacted), 6);
    }
    expect(gdppc(end + 2 * YEAR, ended) / gdppc(end + 2 * YEAR)).toBeCloseTo(1, 6);
  });

  it("re-syncing an unchanged level writes nothing; a changed one writes only the difference", () => {
    const existing: LevelRow[] = [
      {
        countryId: "c1",
        inputType: "gdp_level_adjustment",
        value: 0.003,
        duration: 5,
        description: "[GovComponent] Institutions",
        createdBy: "component:Institutions",
        worldEventId: null,
      },
    ];
    const target = {
      countryId: "c1",
      inputType: "gdp_level_adjustment",
      duration: 5,
      description: "[GovComponent] Institutions",
      createdBy: "component:Institutions",
    };
    expect(planLevelSync(existing, [{ ...target, value: 0.003 }])).toEqual([]);
    const [delta] = planLevelSync(existing, [{ ...target, value: 0.006 }]);
    expect((1 + 0.003) * (1 + delta!.value)).toBeCloseTo(1.006, 6);
  });

  it("an admin world event writes the GDP and population levels its preview promises", () => {
    const drafts = worldEventEffectDrafts({
      countryId: "c1",
      type: "pandemic",
      severity: 0.5,
      label: "[WorldEvent: Flu]",
      duration: null,
      startIxTime: NOW,
      worldEventId: "we1",
      createdBy: "admin",
    });
    const stats = project(NOW + YEAR, rows(drafts));
    const without = project(NOW + YEAR);
    expect(stats.currentGdpPerCapita / without.currentGdpPerCapita).toBeCloseTo(0.9, 6);
    expect(stats.currentPopulation / without.currentPopulation).toBeCloseTo(0.99, 6);
  });
});

describe("P1-31: effect types", () => {
  it("reads TRADE_AGREEMENT whatever its case, as a phased level", () => {
    const trade = (inputType: string): StorytellerEffect[] => [
      { inputType, value: 0.0045, duration: 4, isActive: true, ixTimeTimestamp: NOW },
    ];
    const at = NOW + 5 * YEAR;
    expect(gdppc(at, trade("TRADE_AGREEMENT")) / gdppc(at)).toBeCloseTo(1.0045, 6);
    expect(gdppc(NOW + 1000, trade("TRADE_AGREEMENT")) / gdppc(NOW + 1000)).toBeCloseTo(1, 4);
  });

  it("refuses types no engine reads", () => {
    for (const inputType of [
      "economic_policy",
      "growth_rate_modifier",
      "transport_gdp_bonus",
      "PARTY_INFLUENCE",
    ]) {
      expect(() =>
        storytellerEffectData({ countryId: "c1", inputType, value: 0.01, ixTime: NOW })
      ).toThrow(/not read by any engine/);
    }
  });

  it("every writable engine type moves the projection", () => {
    const engineTypes = [...WRITABLE_EFFECT_TYPES].filter((t) => !t.startsWith("sports_"));
    const at = NOW + 5 * YEAR;
    for (const inputType of engineTypes) {
      const moved = project(at, rows([{ countryId: "c1", inputType, value: 0.01, duration: 1 }]));
      expect(moved.currentTotalGdp).not.toBeCloseTo(project(at).currentTotalGdp, 0);
    }
    const teamRating = fs.readFileSync(
      path.join(process.cwd(), "src/lib/sports/team-rating.ts"),
      "utf8"
    );
    for (const sportsType of [...WRITABLE_EFFECT_TYPES].filter((t) => t.startsWith("sports_"))) {
      expect(teamRating).toContain(`"${sportsType}"`);
    }
  });

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "tests" ? [] : sourceFiles(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
  const allSources = sourceFiles(path.join(process.cwd(), "src"));
  const writerFiles = allSources.filter((file) => {
    const text = fs.readFileSync(file, "utf8");
    return /storyteller-effects|storytellerEffect\./.test(text);
  });

  it("every inputType written in src/ is one an engine reads", () => {
    const enumValues = new Map(Object.entries(StorytellerEffectType));
    const written = new Set<string>();
    for (const file of writerFiles) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/inputType:\s*"([^"]+)"/g)) written.add(m[1]!.toLowerCase());
    }
    // Typed writers name the enum (the engine itself, calculations.ts, is the reader).
    for (const file of allSources.filter(
      (f) => !f.endsWith(path.join("economy", "calculations.ts"))
    )) {
      for (const m of fs.readFileSync(file, "utf8").matchAll(/StorytellerEffectType\.(\w+)/g)) {
        written.add(enumValues.get(m[1]!)!);
      }
    }
    expect([...written].sort()).toEqual(
      expect.arrayContaining([
        "gdp_level_adjustment",
        "population_level_adjustment",
        "trade_agreement",
      ])
    );
    expect([...written].filter((t) => !WRITABLE_EFFECT_TYPES.has(t))).toEqual([]);
  });

  it("only the helper creates or edits StorytellerEffect rows", () => {
    const direct = writerFiles
      .filter((file) => !file.endsWith(path.join("economy", "storyteller-effects.ts")))
      .filter((file) =>
        /storytellerEffect\s*\.\s*(create|createMany|upsert|update)\s*\(/.test(
          fs.readFileSync(file, "utf8")
        )
      )
      .map((file) => path.relative(process.cwd(), file));
    expect(direct).toEqual([]);
  });
});

describe("P2-10: projection fixes", () => {
  it("a natural disaster of -10% takes 15% off total GDP", () => {
    const quake: StorytellerEffect[] = [
      { inputType: "natural_disaster", value: -0.1, isActive: true, ixTimeTimestamp: NOW },
    ];
    const at = NOW + YEAR;
    const hit = project(at, quake);
    const without = project(at);
    expect(hit.currentTotalGdp / without.currentTotalGdp).toBeCloseTo(0.85, 6);
    expect(hit.currentPopulation / without.currentPopulation).toBeCloseTo(0.9, 6);
  });

  it("caps growth by the tier GDP per capita has reached, not the baseline tier", () => {
    // Developing at 24,000 growing 7% x 1.0321 = 7.2247% (under its 7.5% cap). Past 25,000 it is
    // Developed (5% cap), past 35,000 Healthy (3.5% cap).
    const rate = 0.07 * 1.0321;
    const years = 10;
    const t1 = Math.log(25000 / 24000) / Math.log(1 + rate);
    const t2 = Math.log(35000 / 25000) / Math.log(1.05);
    const expected = 35000 * Math.pow(1.035, years - t1 - t2);
    const at = IxTime.addYears(BASELINE, years);
    const actual = project(at, [], {
      gdpPerCapita: 24000,
      adjustedGdpGrowth: 0.07,
    }).currentGdpPerCapita;
    expect(actual).toBeCloseTo(expected, 0);
    expect(actual).toBeLessThan(24000 * Math.pow(1 + rate, years));
  });
});
