/**
 * Derived views: what a branch and a nation amount to now (readiness, C-level, combat power), computed from the
 * stored state on read. The strength every consumer reads (threat picture, intelligence, conflicts) comes from here,
 * so the strength a player sees is the strength a battle uses.
 */
import type { AlertLevel, BranchDomain, CLevel } from "./constants";
import { monthlyLines } from "./budget";
import { memberPay, mobilisedCount } from "./personnel";
import {
  branchQuality,
  combatEffectiveness,
  combatPower,
  enablerFactor,
  frontierLag,
} from "./power";
import {
  cLevel,
  effectiveAlert,
  equipmentOnHand,
  personnelFill,
  readinessScore,
  type SubScores,
} from "./readiness";
import { fundingAt, type FundingReport } from "./tick";
import type { AssetState, BranchState, EconomyInputs, NationState } from "./types";

export interface BranchView {
  id: string;
  domain: BranchDomain;
  active: number;
  reserves: number;
  /** Reservists who have reported under a mobilisation order. */
  mobilised: number;
  /** Active plus mobilised: the personnel that fight. */
  personnel: number;
  /** Funded strength the budget is moving the branch toward. */
  fundedStrength: number;
  capital: number;
  subScores: SubScores;
  readiness: number;
  cLevel: CLevel;
  quality: number;
  enabler: number;
  combatPower: number;
}

export interface NationView {
  branches: BranchView[];
  combatPower: number;
  /** Personnel-weighted readiness of the nation's branches. */
  readiness: number;
  cLevel: CLevel;
  cev: number;
  alert: AlertLevel;
  /** Defense spending as a share of GDP (burden m): the budget plus the emergency supplement (mobilised pay and
   * operations beyond the O&M line), which raises crowding-out and collapse risk (D3). */
  burden: number;
  /** Annual cost of operations beyond the O&M line, drawn outside the budget like the mobilisation supplement. */
  operationsOverspend: number;
  frontierLagYears: number;
  /** Annual pay of mobilised reservists, outside the budget (the emergency supplement, counted in the burden). */
  mobilisationSupplement: number;
  funding: FundingReport;
}

/** Crew the branch's catalog assets need. */
const crewOf = (assets: readonly AssetState[]) =>
  assets.reduce((sum, a) => sum + Math.max(0, a.quantity) * Math.max(0, a.crewPerUnit ?? 0), 0);

function branchView(input: {
  branch: BranchState;
  state: NationState;
  econ: EconomyInputs;
  assets: readonly AssetState[];
  fundedStrength: number;
  cev: number;
  lagYears: number;
  nowClockMs: number;
}): BranchView {
  const { branch, state, econ } = input;
  const own = input.assets.filter((a) => a.branchId === branch.id);
  // Whole reservists report: the count shown, the strength added and the supplement paid all floor alike.
  const mobilised = Math.floor(mobilisedCount({
    order: branch.mobilisationOrder,
    orderedClockMs: branch.mobilisationOrderedClockMs,
    nowClockMs: input.nowClockMs,
    doctrine: state.policy.doctrine,
  }));
  const personnel = branch.active + mobilised;
  const training =
    personnel > 0
      ? (branch.active * branch.training + mobilised * branch.reserveTraining) / personnel
      : branch.training;
  const subScores: SubScores = {
    personnel: personnelFill(personnel, input.fundedStrength, crewOf(own)),
    equipment: equipmentOnHand({
      domain: branch.domain,
      capital: branch.capital,
      personnel,
      gdpPerCapita: econ.gdpPerCapita,
      volunteerShare: state.policy.volunteerShare,
    }),
    condition: branch.condition,
    training,
  };
  const readiness = readinessScore(subScores);
  const quality = branchQuality({
    capital: branch.capital,
    assets: own,
    frontierYear: econ.frontierYear,
    lagYears: input.lagYears,
  });
  const enabler = enablerFactor({
    domain: branch.domain,
    capital: branch.capital,
    branchAssets: own,
    nationAssets: input.assets,
  });
  return {
    id: branch.id,
    domain: branch.domain,
    active: branch.active,
    reserves: branch.reserves,
    mobilised,
    personnel,
    fundedStrength: input.fundedStrength,
    capital: branch.capital,
    subScores,
    readiness,
    cLevel: cLevel(readiness),
    quality,
    enabler,
    combatPower: combatPower({
      domain: branch.domain,
      readiness,
      cev: input.cev,
      quality,
      enabler,
      capital: branch.capital,
      personnel,
    }),
  };
}

/** A nation's branches and totals now. */
export function deriveNation(
  state: NationState,
  econ: EconomyInputs,
  assets: readonly AssetState[],
  nowClockMs: number
): NationView {
  const funding = fundingAt(state, econ, nowClockMs);
  const cev = combatEffectiveness(econ.gdpPerCapita, econ.realmMedianGdpPerCapita, state.policy.doctrine);
  const lagYears = frontierLag(state.policy.rdStock, econ.gdp);
  const branches = state.branches.map((branch, i) =>
    branchView({
      branch,
      state,
      econ,
      assets,
      fundedStrength: funding.activeTarget[i] ?? 0,
      cev,
      lagYears,
      nowClockMs,
    })
  );
  const personnel = branches.reduce((sum, b) => sum + b.personnel, 0);
  const readiness =
    personnel > 0 ? branches.reduce((sum, b) => sum + b.readiness * b.personnel, 0) / personnel : 0;
  const mobilised = branches.reduce((sum, b) => sum + b.mobilised, 0);
  const mobilisationSupplement = mobilised * memberPay(state.policy.volunteerShare, econ.gdpPerCapita);
  const operationsOverspend =
    12 * Math.max(0, (econ.operationsMonthly ?? 0) - monthlyLines(econ.defenseBudget, state.policy.shares).om);
  return {
    branches,
    combatPower: branches.reduce((sum, b) => sum + b.combatPower, 0),
    readiness,
    cLevel: cLevel(readiness),
    cev,
    alert: effectiveAlert(state.policy, nowClockMs),
    burden:
      econ.gdp > 0 ? (econ.defenseBudget + mobilisationSupplement + operationsOverspend) / econ.gdp : 0,
    frontierLagYears: lagYears,
    mobilisationSupplement,
    operationsOverspend,
    funding: { ...funding.report, slipped: 0 },
  };
}
