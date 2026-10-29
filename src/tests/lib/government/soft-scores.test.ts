/**
 * Soft scores derived from the sim (owner decision 3, 2026-10-28): bounded, deterministic, driven
 * by what the nation has and does, with the stored value's gap from its seeded default carried as
 * a lasting offset.
 */
import { describe, expect, it } from "@jest/globals";
import {
  SOFT_SCORE_SEEDED_DEFAULTS,
  budgetShare,
  deriveSoftScores,
  effectiveSoftScores,
  isSoftScoreField,
  stabilityBudget,
  wealthOf,
  withStoredOffset,
  type SoftScoreField,
  type SoftScoreInputs,
} from "~/lib/government/soft-scores";
import { governmentEffectiveness } from "~/lib/government/effectiveness";
import {
  calculateStabilityMetrics,
  stabilityFormulaArgs,
  welfareFactor,
  type StabilitySimState,
} from "~/lib/statecraft/stability-formulas";

const BLANK: SoftScoreInputs = {
  gdpPerCapita: null,
  growthPercent: null,
  unemploymentRate: null,
  inflationRate: null,
  giniPoints: null,
  publicApproval: null,
  governmentType: null,
  components: [],
  budgetShares: null,
};

const TYPICAL: SoftScoreInputs = {
  ...BLANK,
  gdpPerCapita: 35_000,
  growthPercent: 1,
  unemploymentRate: 5,
  inflationRate: 2,
  publicApproval: 50,
  governmentType: "Unitary parliamentary republic",
};

const FIELDS = Object.keys(SOFT_SCORE_SEEDED_DEFAULTS) as SoftScoreField[];

function expectBounded(scores: Record<string, number>) {
  for (const [field, value] of Object.entries(scores)) {
    expect({ field, finite: Number.isFinite(value) }).toEqual({ field, finite: true });
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  }
}

/** Deterministic pseudo-random numbers (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("deriveSoftScores edges", () => {
  it("a nation with no structure, budget, components or figures gets finite middling scores", () => {
    const scores = deriveSoftScores(BLANK);
    expectBounded(scores);
    for (const field of FIELDS) {
      expect(scores[field]).toBeGreaterThan(20);
      expect(scores[field]).toBeLessThan(80);
    }
  });

  it("stays bounded for extreme and non-finite inputs", () => {
    const extremes: SoftScoreInputs[] = [
      {
        ...TYPICAL,
        gdpPerCapita: 0,
        growthPercent: -50,
        unemploymentRate: 90,
        inflationRate: 1e6,
        publicApproval: 0,
        giniPoints: 100,
      },
      {
        ...TYPICAL,
        gdpPerCapita: 1e12,
        growthPercent: 400,
        unemploymentRate: 0,
        inflationRate: -50,
        publicApproval: 1000,
      },
      {
        ...TYPICAL,
        gdpPerCapita: Number.NaN,
        growthPercent: Number.POSITIVE_INFINITY,
        unemploymentRate: Number.NaN,
        publicApproval: Number.NEGATIVE_INFINITY,
        budgetShares: { Transportation: 1e9, Justice: -500, Health: Number.NaN },
      },
    ];
    for (const inputs of extremes) expectBounded(deriveSoftScores(inputs));
  });

  it("stays bounded and deterministic over random states", () => {
    const next = rng(42);
    const forms = ["", "Absolute monarchy", "Federal republic", "Military junta", "custom", null];
    for (let i = 0; i < 400; i++) {
      const inputs: SoftScoreInputs = {
        gdpPerCapita: 10 ** (next() * 7),
        growthPercent: next() * 40 - 20,
        unemploymentRate: next() * 60,
        inflationRate: next() * 200 - 20,
        giniPoints: next() * 100,
        publicApproval: next() * 100,
        governmentType: forms[Math.floor(next() * forms.length)] ?? null,
        components:
          next() < 0.3 ? [{ componentType: "RULE_OF_LAW", effectivenessScore: next() * 100 }] : [],
        budgetShares: next() < 0.5 ? { Transportation: next() * 40, Interior: next() * 30 } : null,
      };
      const scores = deriveSoftScores(inputs);
      expectBounded(scores);
      expect(deriveSoftScores(inputs)).toEqual(scores);
    }
  });

  it("takes the component computation as effectiveness, extremes included", () => {
    for (const effectivenessScore of [0, 100]) {
      const components = [
        { componentType: "PROFESSIONAL_BUREAUCRACY", effectivenessScore },
        { componentType: "RULE_OF_LAW", effectivenessScore },
        { componentType: "TECHNOCRATIC_AGENCIES", effectivenessScore },
      ];
      const scores = deriveSoftScores({ ...TYPICAL, components });
      expect(scores.governmentEffectiveness).toBeCloseTo(governmentEffectiveness(components), 1);
      expectBounded(scores);
    }
  });
});

describe("deriveSoftScores tracks what the nation has and does", () => {
  it("a bigger infrastructure share rates higher", () => {
    const low = deriveSoftScores({ ...TYPICAL, budgetShares: { Transportation: 3, Health: 97 } });
    const high = deriveSoftScores({
      ...TYPICAL,
      budgetShares: { Transportation: 15, Energy: 5, Housing: 5, Health: 75 },
    });
    expect(high.infrastructureRating - low.infrastructureRating).toBeGreaterThan(15);
  });

  it("Justice and Interior spending lowers corruption and raises the rule of law", () => {
    const low = deriveSoftScores({ ...TYPICAL, budgetShares: { Justice: 2, Health: 98 } });
    const high = deriveSoftScores({
      ...TYPICAL,
      budgetShares: { Justice: 12, Interior: 10, Health: 78 },
    });
    expect(high.corruptionIndex).toBeLessThan(low.corruptionIndex);
    expect(high.ruleOfLaw).toBeGreaterThan(low.ruleOfLaw);
  });

  it("richer nations build more, govern better and steal less", () => {
    const poor = deriveSoftScores({ ...TYPICAL, gdpPerCapita: 2_000 });
    const rich = deriveSoftScores({ ...TYPICAL, gdpPerCapita: 80_000 });
    expect(rich.infrastructureRating).toBeGreaterThan(poor.infrastructureRating + 30);
    expect(rich.governmentEffectiveness).toBeGreaterThan(poor.governmentEffectiveness + 20);
    expect(rich.corruptionIndex).toBeLessThan(poor.corruptionIndex - 20);
  });

  it("the government form sets democracy; a blank type sits between", () => {
    const of = (governmentType: string | null) =>
      deriveSoftScores({ ...TYPICAL, governmentType }).democracyIndex;
    expect(of("Unitary absolute monarchy")).toBeLessThan(of(null));
    expect(of(null)).toBeLessThan(of("Federal parliamentary republic"));
    expect(of("Military junta")).toBeLessThan(of("Unitary absolute monarchy"));
  });

  it("approval and growth steady the government; unemployment and inflation shake it", () => {
    const base = deriveSoftScores(TYPICAL).politicalStability;
    expect(deriveSoftScores({ ...TYPICAL, publicApproval: 80 }).politicalStability).toBeGreaterThan(
      base
    );
    expect(deriveSoftScores({ ...TYPICAL, growthPercent: 4 }).politicalStability).toBeGreaterThan(
      base
    );
    expect(deriveSoftScores({ ...TYPICAL, unemploymentRate: 20 }).politicalStability).toBeLessThan(
      base
    );
    expect(deriveSoftScores({ ...TYPICAL, inflationRate: 30 }).politicalStability).toBeLessThan(
      base
    );
  });

  it("wealth is 0 at $1k, 1 at $100k, 0.5 when unknown", () => {
    expect(wealthOf(1_000)).toBe(0);
    expect(wealthOf(100_000)).toBe(1);
    expect(wealthOf(null)).toBe(0.5);
    expect(wealthOf(-5)).toBe(0.5);
  });
});

describe("the stored value is a lasting offset", () => {
  it("adds stored minus the seeded default, bounded, and nothing when unset", () => {
    expect(withStoredOffset("corruptionIndex", 40, 50)).toBe(40);
    expect(withStoredOffset("corruptionIndex", 40, 62)).toBe(52);
    expect(withStoredOffset("corruptionIndex", 40, 20)).toBe(10);
    expect(withStoredOffset("corruptionIndex", 40, null)).toBe(40);
    expect(withStoredOffset("infrastructureRating", 90, 80)).toBe(100);
    expect(withStoredOffset("infrastructureRating", 10, 0)).toBe(0);
  });

  it("carries every stored score's offset onto its derived score", () => {
    const derived = deriveSoftScores(TYPICAL);
    const stored = Object.fromEntries(FIELDS.map((f) => [f, SOFT_SCORE_SEEDED_DEFAULTS[f] + 3]));
    const effective = effectiveSoftScores(TYPICAL, stored);
    for (const field of FIELDS) expect(effective[field]).toBeCloseTo(derived[field] + 3, 5);
  });

  it("a nation with components keeps its stored effectiveness as is (it is the component computation)", () => {
    const components = [{ componentType: "RULE_OF_LAW", effectivenessScore: 50 }];
    const effective = effectiveSoftScores(
      { ...TYPICAL, components },
      { governmentEffectiveness: 83 }
    );
    expect(effective.governmentEffectiveness).toBe(83);
    expect(effectiveSoftScores({ ...TYPICAL, components }, {}).governmentEffectiveness).toBe(
      deriveSoftScores({ ...TYPICAL, components }).governmentEffectiveness
    );
  });

  it("knows which fields are soft scores", () => {
    expect(isSoftScoreField("ruleOfLaw")).toBe(true);
    expect(isSoftScoreField("infrastructureRating")).toBe(true);
    expect(isSoftScoreField("stabilityScore")).toBe(false);
    expect(isSoftScoreField("toString")).toBe(false);
  });
});

describe("stability budget lines", () => {
  it("without a budget: GDP times 30% at the neutral shares", () => {
    const budget = stabilityBudget({
      population: 1_000,
      gdpPerCapita: 10_000,
      totalBudget: null,
      taxRevenueGDPPercent: null,
      budgetShares: null,
    });
    expect(budget.totalBudget).toBe(3_000_000);
    expect(budget.policingBudget).toBeCloseTo(360_000);
    expect(budget.educationBudget + budget.socialServicesBudget).toBeCloseTo(1_650_000);
  });

  it("reads the set budget and its shares; empty shares count as none", () => {
    const shares = { Interior: 10, Justice: 10, Education: 20, Health: 20, Defense: 40 };
    const budget = stabilityBudget({
      population: 1,
      gdpPerCapita: 1,
      totalBudget: 1_000,
      taxRevenueGDPPercent: 40,
      budgetShares: shares,
    });
    expect(budget.policingBudget).toBe(200);
    expect(budget.educationBudget + budget.socialServicesBudget).toBe(400);
    expect(budgetShare({}, "policing")).toBe(12);
  });

  it("is finite for a nation with no population or GDP", () => {
    const budget = stabilityBudget({
      population: 0,
      gdpPerCapita: null,
      totalBudget: 0,
      taxRevenueGDPPercent: null,
      budgetShares: null,
    });
    expect(Object.values(budget).every((v) => Number.isFinite(v) && v === 0)).toBe(true);
  });
});

describe("stability formula inputs", () => {
  const state = (patch: Partial<StabilitySimState> = {}): StabilitySimState => ({
    gdpGrowthDecimal: 0.01,
    gini: null,
    unemploymentRate: 5,
    inflationRate: 2,
    gdpPerCapita: 30_000,
    povertyRate: null,
    population: 1_000_000,
    urbanPopulationPercent: null,
    populationDensity: null,
    ethnicDiversity: null,
    religiousDiversity: null,
    governance: {
      politicalStability: 50,
      politicalPolarization: 40,
      democracyIndex: 60,
      corruptionIndex: 40,
    },
    electionCycle: null,
    publicApproval: null,
    budget: stabilityBudget({
      population: 1_000_000,
      gdpPerCapita: 30_000,
      totalBudget: null,
      taxRevenueGDPPercent: null,
      budgetShares: null,
    }),
    ...patch,
  });
  const metrics = (patch: Partial<StabilitySimState>) =>
    calculateStabilityMetrics(...stabilityFormulaArgs(state(patch)), []);

  it("welfare spending lifts cohesion and trust, within its +-7.5 points", () => {
    const lean = metrics({
      budget: { ...state().budget, educationBudget: 0, socialServicesBudget: 0 },
    });
    const rich = metrics({
      budget: { ...state().budget, educationBudget: 3e9, socialServicesBudget: 6e9 },
    });
    expect(rich.socialCohesion).toBeGreaterThan(lean.socialCohesion);
    expect(rich.trustInGovernment).toBeGreaterThan(lean.trustInGovernment);
    expect(welfareFactor({ ...state().budget, corruptionIndex: 0, totalBudget: 0 })).toBe(0);
  });

  it("policing spending per head lifts policing effectiveness and cuts crime", () => {
    const low = metrics({ budget: { ...state().budget, policingBudget: 1e7 } });
    const high = metrics({ budget: { ...state().budget, policingBudget: 1.5e9 } });
    expect(high.policingEffectiveness).toBeGreaterThan(low.policingEffectiveness + 20);
    expect(high.crimeRate).toBeLessThan(low.crimeRate);
  });

  it("approval builds trust in government", () => {
    expect(metrics({ publicApproval: 90 }).trustInGovernment).toBeGreaterThan(
      metrics({ publicApproval: 10 }).trustInGovernment
    );
  });
});
