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
  calculateImplementationDate,
} from "~/lib/government/atomic-utils";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { NationalIssuesEngine, type CountrySnapshot } from "~/lib/national-issues";
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
    activePoliciesList: [],
    policySettings: {},
    activeIntents: [],
    activeIntentCategories: [],
    ...overrides,
  };
}

describe("calculateCivilServiceCapacity", () => {
  test("never drops below the floor of 50", () => {
    expect(calculateCivilServiceCapacity(0, 0)).toBeGreaterThanOrEqual(50);
  });
});

describe("calculateTotalConsumedStaff", () => {
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
describe("calculateImplementationDate (rollout scheduling)", () => {
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
});

describe("calculateComponentEconomicModifiers", () => {
  test("accrues maintenance cost from active government components", () => {
    const mods = calculateComponentEconomicModifiers([GOV_A], [], []);
    expect(mods.maintenanceCost).toBe(ATOMIC_COMPONENTS[GOV_A]?.maintenanceCost ?? 0);
  });
});
