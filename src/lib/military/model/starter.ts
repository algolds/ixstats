/**
 * Starter forces (owner decision: existing forces reset to a starter force under the new model; NPCs get the same).
 * A starter force is the equilibrium of the nation's current budget: personnel from the budget split and pay within
 * the manpower pool, reserves at their steady state, capital as the accumulated (depreciated) procurement spending of
 * that budget, and readiness at the level the O&M line sustains.
 */
import {
  ALERT_PARAMS,
  DEFAULT_RESERVE_YEARS,
  DEFAULT_SERVICE_MONTHS,
  DEFAULT_SHARES,
  DOMAIN_LABELS,
  DOMAIN_PARAMS,
  INFRASTRUCTURE_DELTA,
  RD_DELTA,
  T_MAX_RESERVE,
  monthlyRate,
  type BranchDomain,
} from "./constants";
import { monthlyLines } from "./budget";
import { domesticCapacity, genericInvestment, monthlyDepreciation } from "./capital";
import {
  branchHeadcountTarget,
  branchSplits,
  manpowerPool,
  normaliseEffort,
  nationalHeadcountTarget,
  reserveInflowRate,
  reserveRetention,
} from "./personnel";
import { fundingAt } from "./tick";
import { conditionTarget, trainingCap } from "./readiness";
import type { BranchState, EconomyInputs, NationState, PolicyState } from "./types";

/** Share of the steady-state capital (accumulated, depreciated procurement) a starter force holds (designer). */
export const STARTER_CAPITAL_SHARE = 1;
/** Fixed-point rounds for headcount against reserve cost (converges well within this). */
const EQUILIBRIUM_ROUNDS = 40;

/** The starter branches: army, navy and air force (55 / 25 / 20). */
export const STARTER_DOMAINS: readonly BranchDomain[] = ["land", "sea", "air"];

export const STARTER_BRANCH_NAMES: Record<BranchDomain, string> = {
  land: "Army",
  sea: "Navy",
  air: "Air force",
  marines: "Marines",
  space: "Space force",
  strategic_missile: "Strategic missile force",
};

/** A policy record at its defaults (alert peacetime since `clockMs`). */
export function defaultPolicy(clockMs: number, overrides: Partial<PolicyState> = {}): PolicyState {
  return {
    shares: { ...DEFAULT_SHARES },
    volunteerShare: 1,
    serviceMonths: DEFAULT_SERVICE_MONTHS,
    reserveYears: DEFAULT_RESERVE_YEARS,
    doctrine: "balanced",
    alertLevel: "peacetime",
    previousAlertLevel: "peacetime",
    alertChangedClockMs: clockMs,
    omPriority: "balanced",
    rdStock: 0,
    infrastructureStock: 0,
    priceIndex: 1,
    surgeStartedClockMs: null,
    ...overrides,
  };
}

export interface StarterBranchSpec {
  id: string;
  domain: BranchDomain;
  effortShare: number;
}

/** The default starter branch specs (ids are placeholders the persistence layer replaces). */
export const starterBranchSpecs = (): StarterBranchSpec[] =>
  STARTER_DOMAINS.map((domain) => ({
    id: `starter-${domain}`,
    domain,
    effortShare: DOMAIN_PARAMS[domain].starterEffort,
  }));

/** National active strength and reserves at their joint steady state (reserve pay crowds out headcount). */
function personnelEquilibrium(policy: PolicyState, econ: EconomyInputs) {
  const lines = monthlyLines(econ.defenseBudget, policy.shares);
  const pool = manpowerPool({ ...policy, population: econ.population });
  const retention = reserveRetention(policy.reserveYears);
  const inflow = reserveInflowRate(policy);
  let reserves = 0;
  let active = 0;
  for (let round = 0; round < EQUILIBRIUM_ROUNDS; round++) {
    active = nationalHeadcountTarget({
      personnelAnnual: lines.personnel * 12,
      reserves,
      volunteerShare: policy.volunteerShare,
      gdpPerCapita: econ.gdpPerCapita,
      pool,
    }).target;
    const steady = retention < 1 ? (active * inflow) / (1 - retention) : 0;
    // Damped so the reserve cost and headcount settle instead of oscillating.
    reserves = round === 0 ? steady : (reserves + steady) / 2;
  }
  return { active, reserves };
}

function steadyCapital(policy: PolicyState, econ: EconomyInputs, specs: readonly StarterBranchSpec[]) {
  const lines = monthlyLines(econ.defenseBudget, policy.shares);
  const investment = genericInvestment({
    leftover: lines.procurement,
    capacity: domesticCapacity({
      gdp: econ.gdp,
      manufacturingShare: econ.manufacturingShare,
      surgeMonths: null,
      priceIndex: policy.priceIndex,
    }),
    capacityUsed: 0,
    priceIndex: policy.priceIndex,
    surging: false,
  });
  const { capital } = branchSplits(specs);
  const wear = ALERT_PARAMS[policy.alertLevel].wear;
  return specs.map(
    (spec, i) =>
      (STARTER_CAPITAL_SHARE * investment * capital[i]!) / monthlyDepreciation(spec.domain, wear)
  );
}

/**
 * The equilibrium force of a nation's budget at `clockMs`, for the reset and for NPCs. Deterministic: the same
 * economy and policy give the same force.
 */
export function starterNation(input: {
  econ: EconomyInputs;
  clockMs: number;
  policy?: Partial<PolicyState>;
  branches?: readonly StarterBranchSpec[];
}): NationState {
  const { econ, clockMs } = input;
  const specs = input.branches ?? starterBranchSpecs();
  const base = defaultPolicy(clockMs, input.policy);
  const lines = monthlyLines(econ.defenseBudget, base.shares);
  const policy: PolicyState = {
    ...base,
    rdStock: lines.rd / monthlyRate(RD_DELTA),
    infrastructureStock: lines.infrastructure / monthlyRate(INFRASTRUCTURE_DELTA),
  };
  const people = personnelEquilibrium(policy, econ);
  const capital = steadyCapital(policy, econ, specs);
  const { labour } = branchSplits(specs);
  // Stored shares sum to 1 (the model normalises them anyway; a nation with only an army and a navy gets 69/31).
  const efforts = normaliseEffort(specs.map((spec) => spec.effortShare));
  const branches: BranchState[] = specs.map((spec, i) => ({
    id: spec.id,
    domain: spec.domain,
    effortShare: efforts[i]!,
    targetActive: null,
    active: branchHeadcountTarget(people.active, labour[i]!, null),
    reserves: people.reserves * labour[i]!,
    capital: capital[i]!,
    condition: 1,
    training: 0,
    reserveTraining: 0,
    mobilisationOrder: 0,
    mobilisationOrderedClockMs: null,
    operationWear: 1,
  }));
  const draft: NationState = { policy, branches, orders: [], lastTickClockMs: clockMs };
  // Readiness at the level the O&M line sustains for this force.
  const funding = fundingAt(draft, econ, clockMs).report;
  const condition = conditionTarget(funding.maintenanceFunding);
  const training = trainingCap(policy.volunteerShare, funding.trainingFunding, funding.alert);
  const reserveTraining = T_MAX_RESERVE * funding.reserveFunding;
  return {
    ...draft,
    branches: branches.map((b) => ({ ...b, condition, training, reserveTraining })),
  };
}

/** Display names for starter branches (the player renames them). */
export const starterBranchName = (domain: BranchDomain) =>
  STARTER_BRANCH_NAMES[domain] ?? DOMAIN_LABELS[domain];
