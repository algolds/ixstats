/** @jest-environment node */
/**
 * Political stability is stored 0-100 and the stability formula gets its inputs in its own units (MyCountry fix plan,
 * WP-A2). Stored growth is a decimal and Gini a 0-1 fraction; fed raw, growth 0.03 read as 0.03% (the trend could
 * never be "improving") and the stored 0-1 stability moved the score only 62 → 64 across its whole range.
 */
import { computeInternalStability } from "~/lib/statecraft/stability-store";
import {
  calculateStabilityMetrics,
  stabilityInputsFromStored,
} from "~/lib/statecraft/stability-formulas";

function db(politicalStability: number) {
  return {
    country: {
      findUnique: jest.fn().mockResolvedValue({
        adjustedGdpGrowth: 0.03,
        unemploymentRate: 5,
        incomeInequalityGini: 0.35,
        inflationRate: 2,
        currentGdpPerCapita: 35_000,
        povertyRate: 12,
        currentPopulation: 1_000_000,
        urbanPopulationPercent: 75,
        populationDensity: 100,
      }),
    },
    economicProfile: { findUnique: jest.fn().mockResolvedValue({ corruptionIndex: 30 }) },
    demographics: {
      findUnique: jest.fn().mockResolvedValue({ ethnicDiversity: 50, religiousDiversity: 50 }),
    },
    governmentStructure: {
      findUnique: jest.fn().mockResolvedValue({
        politicalStability,
        politicalPolarization: 50,
        democracyIndex: 50,
        electionCycle: 4,
      }),
    },
    policy: { findMany: jest.fn().mockResolvedValue([]) },
    internalStabilityMetrics: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe("stability formula boundary", () => {
  it("converts stored growth, Gini and political stability to the formula's units", () => {
    expect(
      stabilityInputsFromStored({ gdpGrowthDecimal: 0.03, gini: 0.35, politicalStability: 75 })
    ).toEqual({ gdpGrowth: 3, giniIndex: 35, politicalStability: 1.25 });
    expect(
      stabilityInputsFromStored({ gdpGrowthDecimal: null, gini: 0, politicalStability: null })
    ).toEqual({ gdpGrowth: 2.5, giniIndex: 35, politicalStability: 0 });
  });

  it("computes the stored country with the intended units", async () => {
    const stored = await computeInternalStability(db(60) as never, "c1");
    const intended = calculateStabilityMetrics(
      {
        gdpGrowth: 3,
        unemploymentRate: 5,
        giniIndex: 35,
        inflationRate: 2,
        gdpPerCapita: 35_000,
        povertyRate: 12,
      },
      {
        policingBudget: 200e6,
        educationBudget: 1.5e9,
        socialServicesBudget: 0.8e9,
        totalBudget: 5e9,
        corruptionIndex: 30,
      },
      {
        population: 1_000_000,
        ethnicDiversity: 50,
        religiousDiversity: 50,
        urbanizationRate: 75,
        youthUnemployment: 10,
        populationDensity: 100,
      },
      {
        politicalStability: 0.5,
        politicalPolarization: 50,
        electionCycle: 4,
        democracyIndex: 50,
        protestFrequency: 8,
      },
      []
    );
    expect(stored!.stabilityScore).toBe(intended.stabilityScore);
    expect(stored!.crimeRate).toBe(intended.crimeRate);
    expect(stored!.socialCohesion).toBe(intended.socialCohesion);
  });

  it("lets the stored 0-100 stability move the score across its range", async () => {
    const low = await computeInternalStability(db(0) as never, "c1");
    const high = await computeInternalStability(db(100) as never, "c1");
    expect(high!.stabilityScore - low!.stabilityScore).toBeGreaterThan(5);
  });
});
