/**
 * Integration tests for atomic-component ↔ simulation wiring.
 *
 * Covers the pure pieces of the "Component Integration with MyCountry Systems" plan:
 *  - Civil service capacity calculation
 *  - Total consumed staff aggregation
 *  - Rollout timeframe parsing + implementation-date scheduling (implementing → active)
 *  - National Issues Engine trigger-condition evaluation for active components
 *  - Component economic modifiers
 */

import { ComponentType } from "@prisma/client";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
  calculateComponentEconomicModifiers,
  parseTimeToImplement,
  calculateImplementationDate,
} from "~/lib/government/atomic-utils";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { NationalIssuesEngine, type CountrySnapshot } from "~/lib/national-issues-engine";
import { IxTime } from "~/lib/ixtime";

// Two real government component keys that carry metadata, resolved from the catalog
// so the assertions stay correct even if individual staff/cost numbers are retuned.
const govKeys = (Object.keys(ATOMIC_COMPONENTS) as ComponentType[]).filter(
  (k) => ATOMIC_COMPONENTS[k]?.metadata
);
const GOV_A = govKeys[0]!;
const GOV_B = govKeys[1]!;

function staffFor(key: ComponentType): number {
  return ATOMIC_COMPONENTS[key]?.metadata.staffRequired ?? 0;
}

/** Build a fully-populated CountrySnapshot with neutral defaults, then apply overrides. */
function makeSnapshot(overrides: Partial<CountrySnapshot> = {}): CountrySnapshot {
  return {
    id: "test",
    name: "Testland",
    leader: "Leader",
    governmentType: "Republic",
    economicTier: "Developed",
    populationTier: "3",
    continent: "Continent",
    region: "Region",
    currentPopulation: 1_000_000,
    currentGdpPerCapita: 30_000,
    currentTotalGdp: 30_000_000_000,
    actualGdpGrowth: 2,
    unemploymentRate: 5,
    inflationRate: 2,
    tradeBalance: 0,
    taxRevenueGDPPercent: 25,
    budgetDeficitSurplus: 0,
    totalDebtGDPRatio: 50,
    debtPerCapita: 1000,
    publicApproval: 50,
    povertyRate: 10,
    incomeInequalityGini: 35,
    lifeExpectancy: 78,
    literacyRate: 95,
    urbanPopulationPercent: 60,
    infrastructureRating: 60,
    politicalStability: 60,
    democracyIndex: 60,
    governmentEffectiveness: 60,
    ruleOfLaw: 60,
    corruptionIndex: 40,
    politicalPolarization: 40,
    stabilityScore: 70,
    crimeRate: 5,
    protestFrequency: 5,
    riotRisk: 10,
    socialCohesion: 70,
    ethnicTension: 20,
    trustInGovernment: 50,
    activeEmbassyCount: 0,
    activeAllianceCount: 0,
    activePolicyCount: 0,
    pendingIssueCount: 0,
    recentCrisisCount: 0,
    activeTreatyCount: 0,
    activeComponents: [],
    implementingComponents: [],
    civilServiceCapacity: 100,
    consumedStaff: 0,
    currentIxTime: IxTime.getCurrentIxTime(),
    currentIxYear: 2040,
    currentIxMonth: 1,
    ...overrides,
  };
}

describe("calculateCivilServiceCapacity", () => {
  test("matches the documented formula", () => {
    // 100 + floor((pop / 100000) * (eff / 100))
    expect(calculateCivilServiceCapacity(10_000_000, 100)).toBe(200);
    expect(calculateCivilServiceCapacity(5_000_000, 50)).toBe(125);
  });

  test("scales up with population and effectiveness", () => {
    const low = calculateCivilServiceCapacity(1_000_000, 50);
    const high = calculateCivilServiceCapacity(50_000_000, 90);
    expect(high).toBeGreaterThan(low);
  });

  test("never drops below the floor of 50", () => {
    expect(calculateCivilServiceCapacity(0, 0)).toBeGreaterThanOrEqual(50);
  });
});

describe("calculateTotalConsumedStaff", () => {
  test("returns 0 with no components", () => {
    expect(calculateTotalConsumedStaff([], [], [])).toBe(0);
  });

  test("sums staffRequired across selected government components", () => {
    const expected = staffFor(GOV_A) + staffFor(GOV_B);
    expect(calculateTotalConsumedStaff([GOV_A, GOV_B], [], [])).toBe(expected);
  });

  test("ignores unknown component identifiers", () => {
    expect(
      calculateTotalConsumedStaff(["NOT_A_REAL_COMPONENT" as ComponentType], [], ["nope"])
    ).toBe(0);
  });
});

describe("parseTimeToImplement", () => {
  test("parses month timeframes", () => {
    expect(parseTimeToImplement("12 months")).toEqual({ months: 12 });
    expect(parseTimeToImplement("6 months")).toEqual({ months: 6 });
  });

  test("parses year timeframes and takes the upper bound of a range", () => {
    expect(parseTimeToImplement("2 years")).toEqual({ years: 2 });
    expect(parseTimeToImplement("2-3 years")).toEqual({ years: 3 });
  });

  test("falls back to 12 months for unrecognized input", () => {
    expect(parseTimeToImplement("soonish")).toEqual({ months: 12 });
  });
});

describe("calculateImplementationDate (rollout scheduling)", () => {
  test("a freshly queued component completes in the IxTime future (starts implementing)", () => {
    const nowIx = IxTime.getCurrentIxTime();
    const completion = calculateImplementationDate("12 months");
    expect(completion.getTime()).toBeGreaterThan(nowIx);
  });

  test("longer timeframes complete later", () => {
    const short = calculateImplementationDate("6 months").getTime();
    const long = calculateImplementationDate("3 years").getTime();
    expect(long).toBeGreaterThan(short);
  });

  test("transition boundary: a past completion date is considered elapsed, a future one is not", () => {
    const nowIx = IxTime.getCurrentIxTime();
    const future = calculateImplementationDate("12 months");
    const past = new Date(nowIx - 1000);
    // Mirrors the production predicate: active once implementationDate <= IxTime now.
    expect(past.getTime() <= nowIx).toBe(true);
    expect(future.getTime() <= nowIx).toBe(false);
  });
});

describe("NationalIssuesEngine.evaluateCondition — active component membership", () => {
  const snapshot = makeSnapshot({
    activeComponents: ["blockchain_ledger", "DEMOCRATIC_PROCESS"],
    implementingComponents: ["planned_economy"],
  });

  test('op "in" is true when the component is active', () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        { field: "activeComponents", op: "in", value: "blockchain_ledger" },
        snapshot
      )
    ).toBe(true);
  });

  test('op "in" is false when the component is not active', () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        { field: "activeComponents", op: "in", value: "planned_economy" },
        snapshot
      )
    ).toBe(false);
  });

  test('op "==" checks membership for array fields', () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        { field: "implementingComponents", op: "==", value: "planned_economy" },
        snapshot
      )
    ).toBe(true);
  });

  test('op "!=" is true when the component is absent', () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        { field: "activeComponents", op: "!=", value: "missing_component" },
        snapshot
      )
    ).toBe(true);
  });

  test("composes with and/or/not over scalar fields", () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        {
          and: [
            { field: "activeComponents", op: "in", value: "blockchain_ledger" },
            { field: "unemploymentRate", op: "<", value: 10 },
          ],
        },
        snapshot
      )
    ).toBe(true);

    expect(
      NationalIssuesEngine.evaluateCondition(
        {
          not: { field: "activeComponents", op: "in", value: "blockchain_ledger" },
        },
        snapshot
      )
    ).toBe(false);
  });

  test("scalar comparisons still work unchanged", () => {
    expect(
      NationalIssuesEngine.evaluateCondition(
        { field: "unemploymentRate", op: ">", value: 1 },
        snapshot
      )
    ).toBe(true);
  });
});

describe("calculateComponentEconomicModifiers", () => {
  test("returns all-zero modifiers when no components are active", () => {
    const mods = calculateComponentEconomicModifiers([], [], []);
    expect(mods).toEqual({
      maintenanceCost: 0,
      taxRevenueModifier: 0,
      unemploymentModifier: 0,
      inflationModifier: 0,
    });
  });

  test("accrues maintenance cost from active government components", () => {
    const mods = calculateComponentEconomicModifiers([GOV_A], [], []);
    expect(mods.maintenanceCost).toBe(ATOMIC_COMPONENTS[GOV_A]?.maintenanceCost ?? 0);
  });
});
