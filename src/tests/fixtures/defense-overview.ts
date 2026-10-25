/**
 * An owner's Defense overview (`security.getDefensePolicy`) for client tests: a mid-sized volunteer force of two
 * branches at the default split, standing at the realm readers' `CLOCK_NOW`.
 */
import { DEFAULT_SHARES, defaultPolicy } from "~/lib/military/model";
import type { OwnerBranch, OwnerDefense } from "~/hooks/useDefenseConsole";
import { CLOCK_NOW } from "./realm-readers";

export function ownerBranch(overrides: Partial<OwnerBranch> = {}): OwnerBranch {
  return {
    id: "b-land",
    domain: "land",
    name: "Royal Army",
    motto: null,
    imageUrl: null,
    active: 120_000,
    reserves: 80_000,
    mobilised: 0,
    personnel: 120_000,
    fundedStrength: 125_000,
    capital: 30e9,
    nominalCapital: 30e9,
    subScores: { personnel: 0.96, equipment: 0.88, condition: 0.74, training: 0.82 },
    readiness: 0.8,
    cLevel: "C-2",
    quality: 0.71,
    enabler: 0.9,
    combatPower: 98_000,
    effortShare: 0.6,
    targetActive: null,
    mobilisationOrder: 0,
    operationWear: 1,
    ...overrides,
  };
}

export function ownerDefense(overrides: Partial<OwnerDefense> = {}): OwnerDefense {
  const policy = defaultPolicy(CLOCK_NOW - 400 * 86_400_000);
  return {
    countryId: "c1",
    clockMs: CLOCK_NOW,
    budget: { annual: 12e9, source: "defenseDepartment", burden: 0.021 },
    policy: {
      ...policy,
      shares: { ...DEFAULT_SHARES },
      alertInEffect: "peacetime",
      alertEffectiveAtClockMs: policy.alertChangedClockMs,
      surging: false,
    },
    combatPower: 140_000,
    readiness: 0.8,
    cLevel: "C-2",
    cev: 1.04,
    frontierLagYears: 3.2,
    mobilisationSupplement: 0,
    funding: {
      alert: "peacetime",
      maintenanceFunding: 0.9,
      trainingFunding: 0.85,
      reserveFunding: 1,
      headcountAfford: 160_000,
      headcountTarget: 150_000,
      slipped: 0,
    },
    economy: { population: 30e6, gdpPerCapita: 19_000, gdp: 570e9 },
    procurement: {
      capacityMonthly: 140e6,
      capacityUsedMonthly: 40e6,
      frontierYear: 2033.4,
      accessibleYear: 2030.2,
    },
    warnings: [],
    branches: [
      ownerBranch(),
      ownerBranch({
        id: "b-sea",
        domain: "sea",
        name: "Royal Navy",
        active: 30_000,
        reserves: 10_000,
        personnel: 30_000,
        subScores: { personnel: 0.9, equipment: 0.95, condition: 0.62, training: 0.8 },
        readiness: 0.72,
        cLevel: "C-3",
        combatPower: 42_000,
        effortShare: 0.4,
      }),
    ],
    ...overrides,
  };
}
