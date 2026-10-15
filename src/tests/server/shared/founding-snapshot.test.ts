/** @jest-environment node */
/**
 * computeFoundingSnapshot founds one nation per archetype × population band × wealth band with a
 * coherent starting state (redesign spec §3): sectors and labor sum to 100, the budget balances
 * against tax revenue within ±1% of GDP, 5 to 9 departments with allocations summing to the
 * budget, and no NaN or negative figure. Its summary figures match what the real write path and
 * the stored stability formula would produce.
 */
import type { EconomicArchetype } from "@prisma/client";
import { buildArchetypeSeedRows } from "~/lib/economy/archetypes/seed";
import { POPULATION_BAND_IDS, WEALTH_BAND_IDS } from "~/lib/builder/founding-bands";
import { departmentsForForm } from "~/lib/government/form-departments";
import { getGovernmentForm } from "~/lib/government/forms";
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
import { figureForPopulationBand, figureForWealthBand } from "~/lib/builder/founding-bands";
import {
  computeFoundingSnapshot,
  estimateTaxRevenuePercent,
  foundingGovernmentEffectiveness,
  inferFormId,
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

const MATRIX = ARCHETYPES.flatMap((archetype) =>
  POPULATION_BAND_IDS.flatMap((populationBand) =>
    WEALTH_BAND_IDS.map((wealthBand) => [archetype.key, populationBand, wealthBand] as const)
  )
);

describe("computeFoundingSnapshot: every archetype × size × wealth", () => {
  it("covers all 20 built-in archetypes", () => {
    expect(ARCHETYPES).toHaveLength(20);
  });

  it.each(MATRIX)("%s, %s, %s founds a coherent nation", (key, populationBand, wealthBand) => {
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
  });

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

  it.each(["parliamentary-republic", "absolute-monarchy", "confederation", "technocracy"])(
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

  it("a named government form brings its components, type and institution titles", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Crown",
      archetype: nordic,
      foundation: null,
      governmentFormId: "absolute-monarchy",
    });
    const form = getGovernmentForm("absolute-monarchy")!;
    expect(snapshot.governmentComponents.map((c) => c.componentType).sort()).toEqual(
      [...form.components].sort()
    );
    expect(snapshot.governmentStructure).toMatchObject({
      governmentType: form.governmentType,
      headOfState: form.institutions.headOfStateTitle,
      legislatureName: form.institutions.legislatureName,
    });
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

  it("an archetype with no bands chosen starts at its typical size, wealth and form", () => {
    const display = getArchetypeDisplay("nordic")!;
    const snapshot = computeFoundingSnapshot({
      name: "Typical",
      archetype: nordic,
      foundation: null,
    });
    expect(snapshot.base.population).toBe(figureForPopulationBand(display.typicalPopulationBand));
    expect(snapshot.base.gdpPerCapita).toBe(figureForWealthBand(display.typicalWealthBand));
    expect(snapshot.governmentFormId).toBe(display.startingGovernmentForm);
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

  it("labels a deficit when the caller's budget outruns revenue", () => {
    const snapshot = computeFoundingSnapshot({
      name: "Spender",
      archetype: null,
      foundation: null,
      econ: { coreIndicators: { totalPopulation: 1_000_000, gdpPerCapita: 10_000, nominalGDP: 0 } },
      governmentStructure: { totalBudget: 1e10 * 0.35 },
    });
    // Legacy fallbacks: revenue 25% of GDP against a 35% budget.
    expect(snapshot.summary.budgetBalancePercentOfGdp).toBeCloseTo(-10, 6);
    expect(snapshot.summary.budgetBalanceLabel).toBe("Large deficit");
  });

  it("is deterministic", () => {
    const input = { name: "Same", archetype: nordic, foundation: null, budgetYear: 2040 };
    expect(computeFoundingSnapshot(input)).toEqual(computeFoundingSnapshot(input));
  });
});

describe("helpers", () => {
  it("normaliseTo100 rounds to two decimals and sums to exactly 100", () => {
    const out = normaliseTo100([1, 1, 1]);
    expect(out).toEqual([33.34, 33.33, 33.33]);
    expect(normaliseTo100([0, 0])).toEqual([100, 0]);
    expect(sum(normaliseTo100([35, 25, 20, 10, 5, 3.1]))).toBeCloseTo(100, 10);
  });

  it("inferFormId reads the component set", () => {
    expect(inferFormId(["RELIGIOUS_LEGITIMACY"])).toBe("theocracy");
    expect(inferFormId(["TRADITIONAL_LEGITIMACY", "DEMOCRATIC_PROCESS"])).toBe(
      "constitutional-monarchy"
    );
    expect(inferFormId(["TRADITIONAL_LEGITIMACY", "AUTOCRATIC_PROCESS"])).toBe("absolute-monarchy");
    expect(inferFormId(["FEDERAL_SYSTEM", "DEMOCRATIC_PROCESS"])).toBe("federal-republic");
    expect(inferFormId([])).toBe("parliamentary-republic");
  });
});

describe("summary parity with the write path", () => {
  it.each(ARCHETYPES.map((a) => [a.key, a] as const))(
    "%s: government effectiveness equals what syncGovernmentComponents writes",
    async (_key, archetype) => {
      const snapshot = computeFoundingSnapshot({ name: "P", archetype, foundation: null });
      let n = 0;
      const update = jest.fn().mockResolvedValue({});
      const tx: any = {
        governmentComponent: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(({ data }: { data: object }) =>
            Promise.resolve({ id: `gc${n++}`, ...data })
          ),
          deleteMany: jest.fn(),
        },
        componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
        governmentStructure: { update },
      };
      await syncGovernmentComponents(tx, "c1", snapshot.governmentComponents);
      const written = update.mock.calls[0]![0].data.governmentEffectiveness as number;
      expect(snapshot.summary.governmentEffectiveness).toBeCloseTo(written, 2);
      expect(foundingGovernmentEffectiveness(snapshot.governmentComponents)).toBe(written);
    }
  );

  it.each([
    ["nordic", "medium", "wealthy"],
    ["soviet-command", "very-large", "developing"],
    ["singapore", "small", "very-wealthy"],
  ] as const)("%s: stability equals the stored formula for the founded row", async (key, p, w) => {
    const archetype = ARCHETYPES.find((a) => a.key === key)!;
    const snapshot = computeFoundingSnapshot({
      name: "S",
      archetype,
      foundation: { baselinePopulation: 0, baselineGdpPerCapita: 0, landArea: 120_000 },
      populationBand: p,
      wealthBand: w,
    });
    const { numbers, base } = snapshot;
    const country = {
      ...numbers,
      currentGdpPerCapita: base.gdpPerCapita,
      currentPopulation: base.population,
      populationDensity: base.population / 120_000,
    };
    const db: any = {
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
    const stored = await computeInternalStability(db, "c1");
    expect(snapshot.summary.stability).toBe(stored!.stabilityScore);
  });
});
