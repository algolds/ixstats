/** @jest-environment node */
/**
 * Edge cases and properties of the economy engines MyCountry shows: the projection (`projectCountryStats`, the one
 * every surface and the stat progression run), the founding snapshot, and the revenue from saved tax rates.
 *
 * Whatever a nation's figures (no one, one person, no output, the editor's maxima, missing optional columns, growth
 * inputs in the wrong unit), the projection stays finite and non-negative, total GDP is population times GDP per
 * capita, and the tier matches the GDP per capita. A baseline (founding, size save) shows its own figures for the rest
 * of its IxTime day; growth and effects take hold from the next IxTime day, once. Founding stays inside its revenue band for every band and tax profile.
 */
import { projectCountryStats } from "~/server/shared/country-helpers";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { nextIxDayStart, roundToIxDay } from "~/lib/ixtime/day";
import { computeFoundingSnapshot, REVENUE_TARGET_RANGE } from "~/server/shared/founding-snapshot";
import { computeTaxYields, TAX_CHANNELS } from "~/lib/economy/tax-channels";
import { POPULATION_BAND_IDS, WEALTH_BAND_IDS } from "~/lib/builder/founding-bands";
import type { EconomicArchetype } from "@prisma/client";

const T0 = IxTime.addYears(IxTime.getInGameEpoch(), 2);
const HOUR = 3_600_000;
const config = getDefaultEconomicConfig();
const NO_COMPONENTS = {
  activeGovComponents: [],
  activeEconComponents: [],
  activeTaxComponents: [],
  implementingGovComponents: [],
  implementingEconComponents: [],
  implementingTaxComponents: [],
  activePolicyMaintenanceCost: 0,
};
const COMPONENTS = {
  ...NO_COMPONENTS,
  activeGovComponents: ["PROFESSIONAL_BUREAUCRACY", "RULE_OF_LAW", "TECHNOCRATIC_AGENCIES"],
};

interface Nation {
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  [key: string]: unknown;
}

function nation(overrides: Partial<Nation> = {}): Nation {
  return {
    name: "Testland",
    baselinePopulation: 10_000_000,
    baselineGdpPerCapita: 30_000,
    baselineDate: new Date(T0),
    adjustedGdpGrowth: 0.02,
    populationGrowthRate: 0.01,
    maxGdpGrowthRate: 0.15,
    unemploymentRate: 5,
    inflationRate: 2,
    taxRevenueGDPPercent: 20,
    totalGovernmentSpending: 1e10,
    storytellerEffects: [],
    ...overrides,
  };
}

const project = (n: Nation, at: number, components = NO_COMPONENTS) =>
  projectCountryStats(n, components, config, at);

const TIERS: Array<[number, string]> = [
  [65000, "Extravagant"],
  [55000, "Very Strong"],
  [45000, "Strong"],
  [35000, "Healthy"],
  [25000, "Developed"],
  [10000, "Developing"],
  [0, "Impoverished"],
];
const tierFor = (gdpPerCapita: number) => TIERS.find(([min]) => gdpPerCapita >= min)![1];

function expectSane(stats: ReturnType<typeof project>) {
  for (const value of [stats.currentPopulation, stats.currentGdpPerCapita, stats.currentTotalGdp]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  expect(stats.currentTotalGdp).toBeCloseTo(stats.currentPopulation * stats.currentGdpPerCapita, 0);
  expect(stats.economicTier).toBe(tierFor(stats.currentGdpPerCapita));
  for (const value of [stats.unemploymentRate, stats.inflationRate, stats.taxRevenueGDPPercent]) {
    expect(Number.isFinite(value)).toBe(true);
  }
  expect(stats.taxRevenueGDPPercent!).toBeGreaterThanOrEqual(0);
  expect(stats.taxRevenueGDPPercent!).toBeLessThanOrEqual(100);
  expect(Number.isFinite(stats.effectiveGdpGrowth)).toBe(true);
}

describe("projection edge cases", () => {
  it.each([
    ["no one", { baselinePopulation: 0 }],
    ["one person", { baselinePopulation: 1 }],
    ["no output", { baselineGdpPerCapita: 0 }],
    ["the editor's maxima", { baselinePopulation: 5e9, baselineGdpPerCapita: 500_000 }],
    ["0% tax", { taxRevenueGDPPercent: 0 }],
    ["100% tax", { taxRevenueGDPPercent: 100 }],
    [
      "missing optional columns",
      {
        adjustedGdpGrowth: null,
        populationGrowthRate: null,
        maxGdpGrowthRate: null,
        unemploymentRate: null,
        inflationRate: null,
        taxRevenueGDPPercent: null,
        totalGovernmentSpending: null,
      },
    ],
    ["growth in percent, not decimal", { adjustedGdpGrowth: 3, populationGrowthRate: 1.2 }],
    ["a collapsing population", { populationGrowthRate: -0.9 }],
    ["non-numeric growth", { adjustedGdpGrowth: Number.NaN, populationGrowthRate: Infinity }],
  ])("stays finite and consistent for %s, now and 1/5/50/100 years on", (_label, overrides) => {
    const n = nation(overrides as Partial<Nation>);
    for (const years of [0, 1, 5, 50, 100]) {
      expectSane(project(n, IxTime.addYears(T0, years), COMPONENTS));
    }
  });

  it("projects backwards from the baseline without going negative", () => {
    const stats = project(nation(), IxTime.addYears(T0, -10));
    expectSane(stats);
    expect(stats.currentGdpPerCapita).toBeLessThan(30_000);
  });

  it("never grows faster than the tier cap allows, even from absurd growth inputs", () => {
    for (const gdpPerCapita of [600, 15_000, 30_000, 40_000, 50_000, 60_000, 120_000]) {
      const stats = project(
        nation({ baselineGdpPerCapita: gdpPerCapita, adjustedGdpGrowth: 0.5 }),
        IxTime.addYears(T0, 1)
      );
      expect(stats.effectiveGdpGrowth!).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(stats.currentGdpPerCapita / gdpPerCapita).toBeLessThanOrEqual(1.1 + 1e-9);
    }
  });

  describe("effects and baselines take hold the next IxTime day (owner ruling 2026-10-28)", () => {
    const BASE = roundToIxDay(T0) + 6 * HOUR; // 06:00 on the baseline's IxTime day
    const NEXT_DAY = nextIxDayStart(BASE);
    const levelEffect = (
      value: number,
      startMs: number,
      duration = 0,
      inputType = "gdp_level_adjustment"
    ) => ({
      inputType,
      value,
      duration,
      isActive: true,
      ixTimeTimestamp: new Date(startMs),
    });
    const at = (effects: object[], when: number, components = COMPONENTS) =>
      project(
        nation({ baselineDate: new Date(BASE), storytellerEffects: effects }),
        when,
        components
      );

    it("shows a baseline's own figures exactly for the rest of its day, then running level effects on top, once", () => {
      const running = [levelEffect(0.1, IxTime.addYears(BASE, -1))];
      for (const when of [BASE, BASE + HOUR, NEXT_DAY - 1]) {
        const stats = at(running, when);
        expect(stats.currentGdpPerCapita).toBe(30_000);
        expect(stats.currentPopulation).toBe(10_000_000);
      }
      expect(at(running, NEXT_DAY).currentGdpPerCapita).toBeCloseTo(33_000, 6);
      const yearOn = IxTime.addYears(NEXT_DAY, 1);
      expect(
        at(running, yearOn).currentGdpPerCapita / at([], yearOn).currentGdpPerCapita
      ).toBeCloseTo(1.1, 9);
    });

    it("an effect begun mid-day waits for the next day and ramps its phase-in from there", () => {
      const begins = NEXT_DAY + 5 * HOUR;
      const effect = [levelEffect(0.1, begins, 1)];
      const sameDay = begins + 10 * HOUR;
      expect(at(effect, sameDay).currentGdpPerCapita).toBe(at([], sameDay).currentGdpPerCapita);
      const halfYear = IxTime.addYears(nextIxDayStart(begins), 0.5);
      expect(
        at(effect, halfYear).currentGdpPerCapita / at([], halfYear).currentGdpPerCapita
      ).toBeCloseTo(1.05, 6);
    });

    it("a disaster lands the next day too", () => {
      const begins = NEXT_DAY + 5 * HOUR;
      const disaster = [levelEffect(-0.1, begins, 0, "natural_disaster")];
      expect(at(disaster, begins + HOUR).currentPopulation).toBe(
        at([], begins + HOUR).currentPopulation
      );
      expect(at(disaster, nextIxDayStart(begins)).currentPopulation).toBeCloseTo(
        at([], nextIxDayStart(begins)).currentPopulation * 0.9,
        3
      );
    });

    it("keeps the component modifiers continuous through the baseline day", () => {
      expect(at([], BASE + HOUR).unemploymentRate).toBe(at([], NEXT_DAY + HOUR).unemploymentRate);
      expect(at([], BASE + HOUR).totalGovernmentSpending).toBe(
        at([], NEXT_DAY + HOUR).totalGovernmentSpending
      );
    });
  });

  it("holds GDP = population x GDP per capita and tier consistency over a seeded random sweep", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 300; i++) {
      const n = nation({
        baselinePopulation: Math.round(10 ** (rand() * 9.7)),
        baselineGdpPerCapita: 100 + rand() * 499_900,
        adjustedGdpGrowth: rand() * 0.2 - 0.05,
        populationGrowthRate: rand() * 0.06 - 0.02,
      });
      expectSane(project(n, IxTime.addYears(T0, rand() * 30), COMPONENTS));
    }
  });
});

describe("founding snapshot edge cases", () => {
  const archetype = (taxProfile: object) =>
    ({ key: "custom", taxProfile: JSON.stringify(taxProfile) }) as unknown as EconomicArchetype;

  it.each([
    ["blank", null],
    [
      "a 100% corporate tax profile",
      archetype({
        corporateRate: 100,
        incomeRate: 13,
        consumptionRate: 0,
        revenueEfficiency: 0.82,
      }),
    ],
    [
      "a zero-tax profile",
      archetype({ corporateRate: 0, incomeRate: 0, consumptionRate: 0, revenueEfficiency: 0.5 }),
    ],
    [
      "a punitive profile",
      archetype({
        corporateRate: 100,
        incomeRate: 100,
        consumptionRate: 100,
        revenueEfficiency: 1,
      }),
    ],
  ])(
    "keeps revenue in band and every figure finite for %s, at every size and wealth",
    (_label, arch) => {
      for (const populationBand of POPULATION_BAND_IDS) {
        for (const wealthBand of WEALTH_BAND_IDS) {
          const snap = computeFoundingSnapshot({
            name: "Edge",
            archetype: arch,
            foundation: null,
            populationBand,
            wealthBand,
            budgetYear: 2043,
          });
          expect(snap.numbers.taxRevenueGDPPercent).toBeGreaterThanOrEqual(
            REVENUE_TARGET_RANGE.min - 0.01
          );
          expect(snap.numbers.taxRevenueGDPPercent).toBeLessThanOrEqual(
            REVENUE_TARGET_RANGE.max + 0.01
          );
          for (const value of Object.values(snap.summary)) {
            if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
          }
          expect(snap.summary.gdp).toBeCloseTo(
            snap.summary.population * snap.summary.gdpPerCapita,
            0
          );
          const sectors = snap.economyBuilderState.sectors as Array<{ gdpContribution: number }>;
          expect(sectors.reduce((sum, s) => sum + s.gdpContribution, 0)).toBeCloseTo(100, 6);
        }
      }
    }
  );

  it("founds a one-band-floor microstate and a two-billion giant with finite figures", () => {
    for (const totalPopulation of [10_000, 2_000_000_000]) {
      const snap = computeFoundingSnapshot({
        name: "Edge",
        archetype: null,
        foundation: null,
        econ: { coreIndicators: { totalPopulation, gdpPerCapita: 500, nominalGDP: 0 } },
        budgetYear: 2043,
      });
      expect(snap.base.nominalGDP).toBe(totalPopulation * 500);
      expect(Number.isFinite(snap.summary.expectedGrowth)).toBe(true);
    }
  });
});

describe("revenue from saved tax rates", () => {
  const weights = Object.fromEntries(TAX_CHANNELS.map((c) => [c.key, c.fallbackWeight]));
  it("is zero at 0%, never more than GDP at every channel's maximum, and unknown without GDP", () => {
    const zero = Object.fromEntries(TAX_CHANNELS.map((c) => [c.key, 0]));
    const max = Object.fromEntries(TAX_CHANNELS.map((c) => [c.key, c.max]));
    expect(computeTaxYields(zero, 1e12, 0.9, weights).total).toBe(0);
    const top = computeTaxYields(max, 1e12, 1, weights).total!;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(1e12);
    expect(computeTaxYields(max, null, 1, weights).total).toBeNull();
    expect(computeTaxYields(max, 0, 1, weights).total).toBeNull();
  });
});
