/** @jest-environment node */
/**
 * Edge cases and properties of the economy engines MyCountry shows: the projection (`projectCountryStats`, the one
 * every surface and the stat progression run), the founding snapshot, and the revenue from saved tax rates.
 *
 * Whatever a nation's figures (no one, one person, no output, the editor's maxima, missing optional columns, growth
 * inputs in the wrong unit), the projection stays finite and non-negative, total GDP is population times GDP per
 * capita, the tier matches the GDP per capita, and the figures move continuously from the baseline on (no jump a few
 * hours after a founding or a size save). Founding stays inside its revenue band for every band and tax profile.
 */
import { projectCountryStats } from "~/server/shared/country-helpers";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { computeFoundingSnapshot, REVENUE_TARGET_RANGE } from "~/server/shared/founding-snapshot";
import { computeTaxYields, TAX_CHANNELS } from "~/components/mycountry/shell/fiscal/taxChannels";
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

  it("is continuous from the baseline on: level effects and component modifiers apply from the first hour", () => {
    const n = nation({
      storytellerEffects: [
        {
          inputType: "gdp_level_adjustment",
          value: 0.1,
          duration: 0,
          isActive: true,
          ixTimeTimestamp: new Date(IxTime.addYears(T0, -1)),
        },
      ],
    });
    const first = project(n, T0 + HOUR, COMPONENTS);
    const later = project(n, T0 + 12 * HOUR, COMPONENTS);
    expect(later.currentGdpPerCapita / first.currentGdpPerCapita).toBeLessThan(1.001);
    expect(first.totalGovernmentSpending).toBe(later.totalGovernmentSpending);
    expect(first.unemploymentRate).toBe(later.unemploymentRate);
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
