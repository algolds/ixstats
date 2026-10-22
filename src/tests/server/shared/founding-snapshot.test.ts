/** @jest-environment node */
/**
 * The founding corpus. computeFoundingSnapshot founds every archetype (each at a different population and wealth
 * band, so every band pair is covered) with a coherent starting state (redesign spec §3): sectors and labor sum to
 * 100, the budget balances against tax revenue within ±1% of GDP, 5 to 9 departments with allocations summing to the
 * budget, no NaN or negative figure, and the effectiveness the real write path stores. A form's founding takes its
 * government type and departments; exact figures, renamed institutions and explicit payloads are honoured; the
 * stability matches the stored formula. The catalogues founding reads resolve (archetype bands and forms, every
 * economic component), and a nation created outside the builder (realm claim, world import) starts from the IxTime
 * baseline with its tier's growth cap and its realm's growth table.
 *
 * Folds archetype-display, economic-components and baseline-country. The preview equalling the written nation is in
 * founding-to-first-steps.
 */
import type { EconomicArchetype } from "@prisma/client";
import { buildArchetypeSeedRows, builtinArchetypes } from "~/lib/economy/archetypes/seed";
import {
  ARCHETYPE_DISPLAY,
  GOVERNMENT_FORM_IDS,
  POPULATION_BANDS,
  WEALTH_BANDS,
} from "~/lib/economy/archetypes/display";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  ECONOMIC_TEMPLATES,
  EconomicComponentType,
} from "~/lib/economy/atomic-data";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { IxTime } from "~/lib/ixtime";
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import { POPULATION_BAND_IDS, WEALTH_BAND_IDS } from "~/lib/builder/founding-bands";
import { departmentsForForm } from "~/lib/government/form-departments";
import { getGovernmentForm } from "~/lib/government/forms";
import {
  computeFoundingSnapshot,
  estimateTaxRevenuePercent,
  foundingGovernmentEffectiveness,
  normaliseTo100,
  type FoundingSnapshot,
} from "~/server/shared/founding-snapshot";
import { syncGovernmentComponents } from "~/server/shared/country-mutation-helpers";
import { computeInternalStability } from "~/lib/statecraft/stability-store";

const ARCHETYPES: EconomicArchetype[] = buildArchetypeSeedRows().map(
  (row) =>
    ({
      ...row,
      id: `arch_${row.key}`,
      createdBy: null,
      usageCount: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }) as EconomicArchetype
);

const BUDGET_YEAR = 2040;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const valuesOf = (record: unknown) => Object.values(record as Record<string, number>);

/** Every number reachable in a value; for the "no NaN, no negative" sweep. */
function numbersIn(value: unknown, path = "", out: Array<[string, number]> = []) {
  if (typeof value === "number") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => numbersIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) numbersIn(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function assertCoherent(snapshot: FoundingSnapshot) {
  const { numbers, base, governmentStructure, taxSystemData, economyBuilderState, summary } =
    snapshot;
  const gdp = base.nominalGDP;

  // Sectors from the archetype's focus, normalised to 100.
  const sectors = economyBuilderState.sectors as Array<{
    gdpContribution: number;
    employmentShare: number;
  }>;
  expect(sectors.length).toBeGreaterThan(0);
  expect(Math.abs(sum(sectors.map((s) => s.gdpContribution)) - 100)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(sum(sectors.map((s) => s.employmentShare)) - 100)).toBeLessThanOrEqual(0.01);

  // Labor and demographic distributions each sum to 100.
  const labor = economyBuilderState.laborMarket as Record<string, unknown>;
  const demographics = economyBuilderState.demographics as Record<string, unknown>;
  for (const distribution of [
    labor.sectorDistribution,
    labor.employmentType,
    demographics.ageDistribution,
    demographics.urbanRuralSplit,
    demographics.educationLevels,
  ]) {
    expect(Math.abs(sum(valuesOf(distribution)) - 100)).toBeLessThanOrEqual(0.01);
  }

  // Balanced budget: written spending vs country revenue and vs the tax system's revenue.
  const totalBudget = governmentStructure.totalBudget!;
  expect(totalBudget).toBeGreaterThan(0);
  expect(
    Math.abs(((numbers.governmentRevenueTotal - totalBudget) / gdp) * 100)
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(estimateTaxRevenuePercent(taxSystemData) - (totalBudget / gdp) * 100)
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(summary.budgetBalancePercentOfGdp)).toBeLessThanOrEqual(1);
  expect(summary.budgetBalanceLabel).toBe("Balanced");
  expect(numbers.taxRevenueGDPPercent).toBeCloseTo(numbers.spendingGDPPercent, 6);

  // 5 to 9 departments with allocations summing to the total budget.
  const departments = governmentStructure.departments as Array<{ name: string }>;
  expect(departments.length).toBeGreaterThanOrEqual(5);
  expect(departments.length).toBeLessThanOrEqual(9);
  const allocations = governmentStructure.budgetAllocations as Array<{
    departmentId: string;
    budgetYear: number;
    allocatedAmount: number;
  }>;
  expect(allocations).toHaveLength(departments.length);
  expect(allocations.map((a) => a.departmentId)).toEqual(departments.map((_, i) => String(i)));
  expect(allocations.every((a) => a.budgetYear === BUDGET_YEAR)).toBe(true);
  expect(sum(allocations.map((a) => a.allocatedAmount))).toBeCloseTo(totalBudget, 0);

  // Derived figures follow GDP per capita.
  expect(numbers.averageAnnualIncome).toBeCloseTo(base.gdpPerCapita * 0.8, 6);
  expect(labor.averageAnnualIncome).toBe(numbers.averageAnnualIncome);

  // No NaN, infinite or negative figure anywhere.
  for (const [path, value] of numbersIn(snapshot)) {
    expect({ path, finite: Number.isFinite(value) }).toEqual({ path, finite: true });
    expect({
      path,
      nonNegative: value >= 0 || path === "summary.budgetBalancePercentOfGdp",
    }).toEqual({
      path,
      nonNegative: true,
    });
  }
  expect(summary.stability).toBeGreaterThanOrEqual(0);
  expect(summary.stability).toBeLessThanOrEqual(100);
  expect(summary.governmentEffectiveness).toBeGreaterThanOrEqual(0);
  expect(summary.governmentEffectiveness).toBeLessThanOrEqual(100);
}

/** What `syncGovernmentComponents` writes for a founding's components on a nation with none yet. */
async function writtenEffectiveness(snapshot: FoundingSnapshot): Promise<number> {
  let n = 0;
  const update = jest.fn().mockResolvedValue({});
  const tx = {
    governmentComponent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: `gc${n++}`, ...data })),
      deleteMany: jest.fn(),
    },
    componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
    governmentStructure: { update },
  };
  await syncGovernmentComponents(tx as never, "c1", snapshot.governmentComponents);
  return update.mock.calls[0]![0].data.governmentEffectiveness as number;
}

/** Each archetype at its own band pair: archetype i takes population band i mod 4 and wealth band (i div 4) mod 4. */
const MATRIX = ARCHETYPES.map(
  (archetype, i) =>
    [
      archetype.key,
      POPULATION_BAND_IDS[i % POPULATION_BAND_IDS.length]!,
      WEALTH_BAND_IDS[Math.floor(i / POPULATION_BAND_IDS.length) % WEALTH_BAND_IDS.length]!,
    ] as const
);

describe("computeFoundingSnapshot: every archetype, every band pair", () => {
  it.each(MATRIX)(
    "%s, %s, %s founds a coherent nation at the effectiveness the save writes",
    async (key, populationBand, wealthBand) => {
      const archetype = ARCHETYPES.find((a) => a.key === key)!;
      const snapshot = computeFoundingSnapshot({
        name: "Aurelia",
        archetype,
        foundation: null,
        populationBand,
        wealthBand,
        budgetYear: BUDGET_YEAR,
      });
      assertCoherent(snapshot);
      const written = await writtenEffectiveness(snapshot);
      expect(snapshot.summary.governmentEffectiveness).toBeCloseTo(written, 2);
      expect(foundingGovernmentEffectiveness(snapshot.governmentComponents)).toBe(written);
    }
  );

  it("blank founding (no archetype) uses the default sector mix and still balances", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Blank",
      archetype: null,
      foundation: null,
      budgetYear: BUDGET_YEAR,
    });
    assertCoherent(snapshot);
    expect((snapshot.economyBuilderState.sectors as unknown[]).length).toBe(7);
  });

  it.each(["absolute-monarchy"])(
    "a %s founding takes the form's government type and departments",
    (formId) => {
      const snapshot = computeFoundingSnapshot({
        name: "Formed",
        archetype: ARCHETYPES[0]!,
        foundation: null,
        governmentFormId: formId,
        budgetYear: BUDGET_YEAR,
      });
      assertCoherent(snapshot);
      expect(snapshot.governmentFormId).toBe(formId);
      expect(
        (snapshot.governmentStructure.departments as Array<{ name: string }>).map((d) => d.name)
      ).toEqual(departmentsForForm(formId).map((d) => d.name));
      expect(snapshot.governmentStructure.governmentType).not.toBe(ARCHETYPES[0]!.name);
    }
  );
});

describe("computeFoundingSnapshot: inputs", () => {
  const nordic = ARCHETYPES.find((a) => a.key === "nordic")!;

  it("an exact figure wins over a band", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Exact",
      archetype: nordic,
      foundation: null,
      populationBand: "small",
      wealthBand: "developing",
      econ: { coreIndicators: { totalPopulation: 8_400_000, gdpPerCapita: 61_000, nominalGDP: 0 } },
    });
    expect(snapshot.base.population).toBe(8_400_000);
    expect(snapshot.base.gdpPerCapita).toBe(61_000);
    expect(snapshot.economicTier).toBe("Very Strong");
  });
  it("renamed institutions replace only the names the player changed", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Crown",
      archetype: nordic,
      foundation: null,
      governmentFormId: "absolute-monarchy",
      institutionNames: { headOfStateTitle: "Grand Duke", legislatureName: "  " },
    });
    const form = getGovernmentForm("absolute-monarchy")!;
    expect(snapshot.governmentStructure).toMatchObject({
      headOfState: "Grand Duke",
      legislatureName: form.institutions.legislatureName,
      judicialName: form.institutions.judicialName,
    });
  });
  it("derives the economic tier and income from GDP per capita, never the builder's placeholders", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Rich",
      archetype: nordic,
      foundation: null,
      econ: { coreIndicators: { totalPopulation: 5_000_000, gdpPerCapita: 70_000, nominalGDP: 0 } },
      taxSystemData: { taxSystemName: "Sent" },
      governmentStructure: { governmentName: "Sent", totalBudget: 1 },
      economyBuilderState: {
        structure: { economicTier: "Developing", totalGDP: 1 },
        laborMarket: { averageAnnualIncome: 30000 },
        sectors: [],
      },
    });
    expect(snapshot.economicTier).toBe("Extravagant");
    const structure = snapshot.economyBuilderState.structure as Record<string, unknown>;
    const labor = snapshot.economyBuilderState.laborMarket as Record<string, unknown>;
    expect(structure.economicTier).toBe("Advanced");
    expect(labor.averageAnnualIncome).toBe(56_000);
    // An explicit state with no sectors gets the archetype's.
    expect((snapshot.economyBuilderState.sectors as unknown[]).length).toBeGreaterThan(0);
    // Explicit payloads are kept as sent.
    expect(snapshot.taxSystemData).toEqual({ taxSystemName: "Sent" });
    expect(snapshot.governmentStructure.totalBudget).toBe(1);
  });

  it("an exact revenue figure sets both revenue and spending", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Taxed",
      archetype: nordic,
      foundation: null,
      econ: { fiscalSystem: { taxRevenueGDPPercent: 30 } },
      budgetYear: BUDGET_YEAR,
    });
    expect(snapshot.numbers.taxRevenueGDPPercent).toBe(30);
    expect(snapshot.numbers.spendingGDPPercent).toBe(30);
    expect(estimateTaxRevenuePercent(snapshot.taxSystemData)).toBeCloseTo(30, 1);
    expect(snapshot.summary.budgetBalanceLabel).toBe("Balanced");
  });
});

describe("helpers", () => {
  it("normaliseTo100 rounds to two decimals and sums to exactly 100", () => {
    const out = normaliseTo100([1, 1, 1]);
    expect(out).toEqual([33.34, 33.33, 33.33]);
    expect(normaliseTo100([0, 0])).toEqual([100, 0]);
    expect(sum(normaliseTo100([35, 25, 20, 10, 5, 3.1]))).toBeCloseTo(100, 10);
  });
});

describe("summary parity with the stored stability formula", () => {
  it("nordic, medium, wealthy: stability equals the stored formula for the founded row", async () => {
    const archetype = ARCHETYPES.find((a) => a.key === "nordic")!;
    const snapshot = computeFoundingSnapshot({
      name: "S",
      archetype,
      foundation: { baselinePopulation: 0, baselineGdpPerCapita: 0, landArea: 120_000 },
      populationBand: "medium",
      wealthBand: "wealthy",
    });
    const { numbers, base } = snapshot;
    const country = {
      ...numbers,
      currentGdpPerCapita: base.gdpPerCapita,
      currentPopulation: base.population,
      populationDensity: base.population / 120_000,
    };
    const db = {
      country: { findUnique: jest.fn().mockResolvedValue(country) },
      economicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      demographics: {
        findUnique: jest.fn().mockResolvedValue({ ethnicDiversity: 50, religiousDiversity: 50 }),
      },
      governmentStructure: {
        findUnique: jest.fn().mockResolvedValue({
          politicalStability: 0.5,
          politicalPolarization: 50,
          democracyIndex: 50,
          electionCycle: 4,
        }),
      },
      policy: { findMany: jest.fn().mockResolvedValue([]) },
      internalStabilityMetrics: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const stored = await computeInternalStability(db as never, "c1");
    expect(snapshot.summary.stability).toBe(stored!.stabilityScore);
  });
});

describe("the catalogues founding reads", () => {
  it("gives every archetype a valid typical band pair and starting form", () => {
    const invalid = Object.entries(ARCHETYPE_DISPLAY).filter(
      ([, d]) =>
        !POPULATION_BANDS.includes(d.typicalPopulationBand) ||
        !WEALTH_BANDS.includes(d.typicalWealthBand) ||
        !(GOVERNMENT_FORM_IDS as readonly string[]).includes(d.startingGovernmentForm)
    );
    expect(invalid.map(([id]) => id)).toEqual([]);
  });

  it("defines every economic component the archetypes and templates name, with symmetric synergies and conflicts", () => {
    const all = Object.values(EconomicComponentType);
    const definitionOf = (type: EconomicComponentType) => ATOMIC_ECONOMIC_COMPONENTS[type];
    expect(all.filter((type) => !definitionOf(type))).toEqual([]);
    const oneSided = all.flatMap((type) => [
      ...definitionOf(type)!
        .synergies.filter((o) => !definitionOf(o)?.synergies.includes(type))
        .map((o) => `${type} synergy ${o}`),
      ...definitionOf(type)!
        .conflicts.filter((o) => !definitionOf(o)?.conflicts.includes(type))
        .map((o) => `${type} conflict ${o}`),
    ]);
    expect(oneSided).toEqual([]);
    const archetypes = builtinArchetypes();
    expect(archetypes).toHaveLength(20);
    const unresolved = [
      ...ECONOMIC_TEMPLATES.flatMap((t) =>
        t.components.map((c) => [`template ${t.id}`, c] as const)
      ),
      ...archetypes.flatMap((a) =>
        a.economicComponents.map((c) => [`archetype ${a.id}`, c] as const)
      ),
    ].filter(([, type]) => !definitionOf(type));
    expect(unresolved).toEqual([]);
    expect(archetypes.filter((a) => a.economicComponents.length === 0)).toEqual([]);
  });
});

describe("a nation created outside the builder (realm claim, world import)", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-09-28T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  it("starts from the IxTime baseline with the default figures", () => {
    const data = buildBaselineCountryData("Aurelia");
    const now = new Date(IxTime.getCurrentIxTime());
    expect(data).toMatchObject({
      name: "Aurelia",
      // Unknown stays empty, as on Ixnay's countries: every reader shows its own fallback.
      continent: null,
      region: null,
      baselinePopulation: 1_000_000,
      baselineGdpPerCapita: 50_000,
      landArea: 100_000,
      baselineDate: now,
      lastCalculated: now,
      nominalGDP: 1_000_000 * 50_000,
    });
    expect(data.governmentType).toBeUndefined();
    expect(data).not.toHaveProperty("slug");
  });

  it("caps GDP growth by its tier and takes the growth defaults of the tier or of its realm", () => {
    expect(buildBaselineCountryData("Aurelia")).toMatchObject({
      maxGdpGrowthRate: 0.0275,
      ...IXSTATS_NATION_GROWTH_DEFAULTS.Strong,
    });
    expect(buildBaselineCountryData("Borea", { baselineGdpPerCapita: 5_000 })).toMatchObject({
      maxGdpGrowthRate: 0.1,
      ...IXSTATS_NATION_GROWTH_DEFAULTS.Impoverished,
    });
    const table: NationGrowthTable = {
      ...IXSTATS_NATION_GROWTH_DEFAULTS,
      Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
    };
    expect(
      buildBaselineCountryData("Calder", { baselineGdpPerCapita: 15_000 }, table)
    ).toMatchObject({
      populationGrowthRate: 0.02,
      adjustedGdpGrowth: 0.004,
      maxGdpGrowthRate: 0.075,
    });
  });
});
