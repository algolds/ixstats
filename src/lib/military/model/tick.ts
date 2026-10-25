/**
 * The monthly update on a nation's realm clock (realm time design §4.2). A nation is brought up to date lazily: the
 * number of whole in-game months since `lastTickClockMs` is applied, month by month for short gaps and with the
 * closed forms for long ones (date jumps, long absences). Pure, deterministic and idempotent: advancing to the same
 * clock time twice changes nothing, and a paused realm (whose clock does not move) never ticks.
 *
 * Inputs (budget, GDP, population) are held at their current values across a gap: the economy is read when the
 * nation is next touched.
 */
import {
  ALERT_PARAMS,
  CLOSED_FORM_SEGMENT_MONTHS,
  INFRASTRUCTURE_DELTA,
  MONTH_MS,
  RD_DELTA,
  STEPWISE_MAX_MONTHS,
  T_MAX_RESERVE,
  monthlyRate,
  type AlertLevel,
  type BudgetShares,
} from "./constants";
import { monthlyLines } from "./budget";
import {
  capacityDraw,
  domesticCapacity,
  genericInvestment,
  monthlyDepreciation,
  priceIndexAfter,
  procurementMonth,
  stepStock,
  stockAfter,
} from "./capital";
import {
  branchHeadcountTarget,
  branchSplits,
  headcountAfter,
  manpowerPool,
  memberPay,
  nationalHeadcountTarget,
  reserveInflowRate,
  reserveRetention,
  reservesAfter,
  stepHeadcount,
  stepReserves,
} from "./personnel";
import {
  alertEffectiveAt,
  conditionAfter,
  conditionTarget,
  effectiveAlert,
  maintenanceRequirement,
  omFunding,
  stepCondition,
  stepTraining,
  trainingAfter,
  trainingCap,
  trainingRequirement,
} from "./readiness";
import type { BranchState, Delivery, EconomyInputs, NationState, OrderState } from "./types";

const RD_MONTHLY = monthlyRate(RD_DELTA);
const INFRA_MONTHLY = monthlyRate(INFRASTRUCTURE_DELTA);

/** What the month's budget funded, for diagnostics. */
export interface FundingReport {
  alert: AlertLevel;
  maintenanceFunding: number;
  trainingFunding: number;
  reserveFunding: number;
  /** National active strength the personnel line affords, and the target after the manpower pool. */
  headcountAfford: number;
  headcountTarget: number;
  /** Order payments that slipped in the last month. */
  slipped: number;
}

/** The targets one month's inputs set for every branch. */
interface MonthPlan {
  report: Omit<FundingReport, "slipped">;
  lines: BudgetShares;
  wear: number[];
  capitalShare: number[];
  activeTarget: number[];
  conditionTarget: number;
  trainingCap: number;
  reserveTrainingTarget: number;
  retention: number;
  inflowRate: number;
}

/** Months between two clock times that a tick at `fromMs` has to apply. */
export const monthsDue = (fromMs: number, toMs: number) =>
  toMs > fromMs ? Math.floor((toMs - fromMs) / MONTH_MS) : 0;

function planMonth(state: NationState, econ: EconomyInputs, clockMs: number): MonthPlan {
  const { policy, branches } = state;
  const alert = effectiveAlert(policy, clockMs);
  const lines = monthlyLines(econ.defenseBudget, policy.shares);
  const pay = memberPay(policy.volunteerShare, econ.gdpPerCapita);
  const splits = branchSplits(branches);
  const head = nationalHeadcountTarget({
    personnelAnnual: lines.personnel * 12,
    reserves: branches.reduce((sum, b) => sum + b.reserves, 0),
    volunteerShare: policy.volunteerShare,
    gdpPerCapita: econ.gdpPerCapita,
    pool: manpowerPool({ ...policy, population: econ.population }),
  });
  const wear = branches.map((b) => Math.max(ALERT_PARAMS[alert].wear, b.operationWear));
  const maintenanceRequired = branches.reduce(
    (sum, b, i) => sum + maintenanceRequirement(b.capital * policy.priceIndex, alert, wear[i]!),
    0
  );
  const trainingRequired = branches.reduce(
    (sum, b) => sum + trainingRequirement(b.domain, b.active, pay, alert),
    0
  );
  const funding = omFunding({
    // Operations under way are paid first; what is left funds maintenance and training.
    omMonthly: Math.max(0, lines.om - (econ.operationsMonthly ?? 0)),
    maintenanceRequired,
    trainingRequired,
    priority: policy.omPriority,
  });
  return {
    report: {
      alert,
      maintenanceFunding: funding.maintenance,
      trainingFunding: funding.training,
      reserveFunding: head.reserveFunding,
      headcountAfford: head.afford,
      headcountTarget: head.target,
    },
    lines,
    wear,
    capitalShare: splits.capital,
    activeTarget: branches.map((b, i) =>
      branchHeadcountTarget(head.target, splits.labour[i]!, b.targetActive)
    ),
    conditionTarget: conditionTarget(funding.maintenance),
    trainingCap: trainingCap(policy.volunteerShare, funding.training, alert),
    reserveTrainingTarget: T_MAX_RESERVE * head.reserveFunding,
    retention: reserveRetention(policy.reserveYears),
    inflowRate: reserveInflowRate(policy),
  };
}

/** The month's funding and every branch's funded strength at `clockMs`, for the derived views. */
export function fundingAt(state: NationState, econ: EconomyInputs, clockMs: number) {
  const plan = planMonth(state, econ, clockMs);
  return { report: plan.report, activeTarget: plan.activeTarget };
}

const surgeMonthsAt = (surgeStartedClockMs: number | null, clockMs: number) =>
  surgeStartedClockMs === null ? null : Math.max(0, (clockMs - surgeStartedClockMs) / MONTH_MS);

/** One month of procurement: order payments and deliveries, then uncatalogued capital per branch (real). */
function procureMonth(
  state: NationState,
  econ: EconomyInputs,
  plan: MonthPlan,
  clockMs: number,
  priceIndex: number
) {
  const month = procurementMonth(state.orders, plan.lines.procurement, clockMs);
  const surgeMonths = surgeMonthsAt(state.policy.surgeStartedClockMs, clockMs);
  const capacity = domesticCapacity({
    gdp: econ.gdp,
    manufacturingShare: econ.manufacturingShare,
    surgeMonths,
    priceIndex,
  });
  const generic = genericInvestment({
    leftover: month.leftover,
    capacity,
    capacityUsed: month.orders.reduce((sum, o) => sum + capacityDraw(o), 0),
    priceIndex,
    surging: surgeMonths !== null,
  });
  const inflow = state.branches.map((b, i) => {
    const delivered = month.deliveries
      .filter((d) => d.branchId === b.id)
      .reduce((sum, d) => sum + d.quantity * d.unitRealValue, 0);
    return generic * plan.capitalShare[i]! + delivered;
  });
  return { orders: month.orders, deliveries: month.deliveries, inflow, slipped: month.slipped };
}

/** Mobilisation orders never exceed the reserve. */
const clampOrder = (b: BranchState): BranchState =>
  b.mobilisationOrder > b.reserves ? { ...b, mobilisationOrder: Math.floor(b.reserves) } : b;

/** One in-game month ending at `clockMs`. */
export function stepMonth(state: NationState, econ: EconomyInputs, clockMs: number) {
  const plan = planMonth(state, econ, clockMs);
  const { policy } = state;
  const procured = procureMonth(state, econ, plan, clockMs, policy.priceIndex);
  const branches = state.branches.map((b, i) =>
    clampOrder({
      ...b,
      reserves: stepReserves(b.reserves, b.active, plan.retention, plan.inflowRate),
      active: stepHeadcount(b.active, plan.activeTarget[i]!),
      capital: stepStock(b.capital, monthlyDepreciation(b.domain, plan.wear[i]!), procured.inflow[i]!),
      condition: stepCondition(b.condition, plan.conditionTarget),
      training: stepTraining(b.training, plan.trainingCap),
      reserveTraining: stepTraining(b.reserveTraining, plan.reserveTrainingTarget),
    })
  );
  const next: NationState = {
    policy: {
      ...policy,
      rdStock: stepStock(policy.rdStock, RD_MONTHLY, plan.lines.rd / policy.priceIndex),
      infrastructureStock: stepStock(
        policy.infrastructureStock,
        INFRA_MONTHLY,
        plan.lines.infrastructure / policy.priceIndex
      ),
      priceIndex: priceIndexAfter(policy.priceIndex, 1),
    },
    branches,
    orders: procured.orders,
    lastTickClockMs: clockMs,
  };
  return {
    state: next,
    deliveries: procured.deliveries,
    report: { ...plan.report, slipped: procured.slipped },
  };
}

/** The months in a closed-form segment: at most a segment, and cut where a raised alert bites. */
function segmentLength(state: NationState, remaining: number): number {
  const { policy, lastTickClockMs } = state;
  let months = Math.min(CLOSED_FORM_SEGMENT_MONTHS, remaining);
  const bite = monthsDue(lastTickClockMs, alertEffectiveAt(policy));
  if (bite >= 1 && bite < months) months = bite;
  return months;
}

/**
 * n months with the plan held at the segment's start: closed forms for headcount, reserves, condition, training,
 * the R&D and infrastructure stocks and the price index; capital follows its exact recurrence because order
 * payments and deliveries are discrete monthly events.
 */
function advanceSegment(state: NationState, econ: EconomyInputs, months: number) {
  const plan = planMonth(state, econ, state.lastTickClockMs + months * MONTH_MS);
  let orders: OrderState[] = state.orders;
  let capital = state.branches.map((b) => b.capital);
  const deliveries: Delivery[] = [];
  let slipped = 0;
  for (let k = 1; k <= months; k++) {
    const clockMs = state.lastTickClockMs + k * MONTH_MS;
    const priceIndex = priceIndexAfter(state.policy.priceIndex, k - 1);
    const procured = procureMonth({ ...state, orders }, econ, plan, clockMs, priceIndex);
    orders = procured.orders;
    deliveries.push(...procured.deliveries);
    slipped = procured.slipped;
    capital = capital.map((K, i) =>
      stepStock(K, monthlyDepreciation(state.branches[i]!.domain, plan.wear[i]!), procured.inflow[i]!)
    );
  }
  const branches = state.branches.map((b, i) =>
    clampOrder({
      ...b,
      reserves: reservesAfter({
        reserves: b.reserves,
        active: b.active,
        activeTarget: plan.activeTarget[i]!,
        retention: plan.retention,
        inflowRate: plan.inflowRate,
        months,
      }),
      active: headcountAfter(b.active, plan.activeTarget[i]!, months),
      capital: capital[i]!,
      condition: conditionAfter(b.condition, plan.conditionTarget, months),
      training: trainingAfter(b.training, plan.trainingCap, months),
      reserveTraining: trainingAfter(b.reserveTraining, plan.reserveTrainingTarget, months),
    })
  );
  const { policy } = state;
  // Real R&D and infrastructure money per month falls as the price index rises; hold the segment's average.
  const midPrice = priceIndexAfter(policy.priceIndex, (months - 1) / 2);
  const next: NationState = {
    policy: {
      ...policy,
      rdStock: stockAfter(policy.rdStock, RD_MONTHLY, plan.lines.rd / midPrice, months),
      infrastructureStock: stockAfter(
        policy.infrastructureStock,
        INFRA_MONTHLY,
        plan.lines.infrastructure / midPrice,
        months
      ),
      priceIndex: priceIndexAfter(policy.priceIndex, months),
    },
    branches,
    orders,
    lastTickClockMs: state.lastTickClockMs + months * MONTH_MS,
  };
  return { state: next, deliveries, report: { ...plan.report, slipped } };
}

export interface AdvanceResult {
  state: NationState;
  deliveries: Delivery[];
  months: number;
  /** The last month's funding; null when no month passed. */
  report: FundingReport | null;
}

/**
 * Bring a nation up to `toClockMs`: whole months only (the remainder waits for the next read), month by month up to
 * STEPWISE_MAX_MONTHS and in closed-form segments beyond (`mode` forces one path, for tests).
 */
export function advanceNation(
  state: NationState,
  econ: EconomyInputs,
  toClockMs: number,
  mode: "auto" | "stepwise" | "closed" = "auto"
): AdvanceResult {
  const months = monthsDue(state.lastTickClockMs, toClockMs);
  const closed = mode === "closed" || (mode === "auto" && months > STEPWISE_MAX_MONTHS);
  let current = state;
  let report: FundingReport | null = null;
  const deliveries: Delivery[] = [];
  let done = 0;
  while (done < months) {
    const n = closed ? segmentLength(current, months - done) : 1;
    const result =
      closed && n > 1
        ? advanceSegment(current, econ, n)
        : stepMonth(current, econ, current.lastTickClockMs + MONTH_MS);
    current = result.state;
    report = result.report;
    deliveries.push(...result.deliveries);
    done += closed ? n : 1;
  }
  return { state: current, deliveries, months, report };
}
