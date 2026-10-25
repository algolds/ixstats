/**
 * Layer (b): pay, the manpower pool, headcount, reserves and mobilisation (research §7.2).
 */
import {
  COHORT_ELIGIBLE_SHARE,
  DAY_MS,
  DOMAIN_PARAMS,
  HEADCOUNT_RATE_DOWN,
  HEADCOUNT_RATE_UP,
  MILITARY_AGE_SHARE,
  MILITARY_AGE_YEARS,
  MOBILISATION_TAU_DAYS,
  PAY_CONSCRIPT_GDPPC,
  PAY_VOLUNTEER_GDPPC,
  RESERVE_COST_SHARE,
  RESERVE_OBLIGATION_CONSCRIPT,
  RESERVE_OBLIGATION_VOLUNTEER,
  VOLUNTEER_POOL_SHARE,
  VOLUNTEER_SEPARATION_MONTHLY,
  type BranchDomain,
  type Doctrine,
} from "./constants";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Annual pay per member: c_member = v × 2.2 GDPpc + (1 − v) × 0.6 GDPpc. */
export function memberPay(volunteerShare: number, gdpPerCapita: number): number {
  const v = clamp01(volunteerShare);
  return Math.max(0, gdpPerCapita) * (v * PAY_VOLUNTEER_GDPPC + (1 - v) * PAY_CONSCRIPT_GDPPC);
}

/** Annual refresher cost per reservist: c_res = 0.1 × c_member. */
export function reservistCost(volunteerShare: number, gdpPerCapita: number): number {
  return RESERVE_COST_SHARE * memberPay(volunteerShare, gdpPerCapita);
}

/** Most active personnel the population yields: volunteers plus the conscript cohorts in service. */
export function manpowerPool(input: {
  population: number;
  volunteerShare: number;
  serviceMonths: number;
}): number {
  const v = clamp01(input.volunteerShare);
  const militaryAge = Math.max(0, input.population) * MILITARY_AGE_SHARE;
  const volunteers = v * VOLUNTEER_POOL_SHARE * militaryAge;
  const cohort = militaryAge / MILITARY_AGE_YEARS;
  const conscripts = (1 - v) * COHORT_ELIGIBLE_SHARE * cohort * (input.serviceMonths / 12);
  return volunteers + conscripts;
}

/**
 * The national active strength the personnel line affords, within the pool:
 *   N_afford = (personnel money − c_res × Rv) / c_member,  N_target = min(N_afford, N_pool)
 * and the share of reserve refresher training paid (personnel money pays reserves first).
 */
export function nationalHeadcountTarget(input: {
  personnelAnnual: number;
  reserves: number;
  volunteerShare: number;
  gdpPerCapita: number;
  pool: number;
}): { target: number; afford: number; reserveFunding: number } {
  const pay = memberPay(input.volunteerShare, input.gdpPerCapita);
  const reserveBill = reservistCost(input.volunteerShare, input.gdpPerCapita) * input.reserves;
  const money = Math.max(0, input.personnelAnnual);
  const afford = pay > 0 ? Math.max(0, money - reserveBill) / pay : 0;
  const reserveFunding = reserveBill > 0 ? Math.min(1, money / reserveBill) : 1;
  return { target: Math.min(afford, Math.max(0, input.pool)), afford, reserveFunding };
}

/** Effort weights normalised across branches; all zero splits evenly. */
export function normaliseEffort(efforts: readonly number[]): number[] {
  const clean = efforts.map((effort) => Math.max(0, effort));
  const total = clean.reduce((sum, effort) => sum + effort, 0);
  if (total <= 0) return clean.map(() => (clean.length > 0 ? 1 / clean.length : 0));
  return clean.map((effort) => effort / total);
}

/**
 * How a national line splits across branches: labour by effort × (1 − α), capital by effort × α (the Cobb–Douglas
 * cost shares, so capital-intensive domains take more of procurement and less of personnel).
 */
export function branchSplits(branches: readonly { domain: BranchDomain; effortShare: number }[]): {
  labour: number[];
  capital: number[];
} {
  const effort = normaliseEffort(branches.map((b) => b.effortShare));
  const labour = branches.map((b, i) => effort[i]! * (1 - DOMAIN_PARAMS[b.domain].alpha));
  const capital = branches.map((b, i) => effort[i]! * DOMAIN_PARAMS[b.domain].alpha);
  return { labour: normaliseEffort(labour), capital: normaliseEffort(capital) };
}

/** A branch's headcount target: its labour share of the national target, capped by the player's desired strength. */
export function branchHeadcountTarget(
  nationalTarget: number,
  labourShare: number,
  targetActive: number | null
): number {
  const funded = nationalTarget * labourShare;
  return targetActive === null ? funded : Math.min(funded, Math.max(0, targetActive));
}

/** The month's headcount rate: recruiting is slower than discharge. */
export const headcountRate = (current: number, target: number) =>
  target > current ? HEADCOUNT_RATE_UP : HEADCOUNT_RATE_DOWN;

/** One month of headcount adjustment toward the target. */
export function stepHeadcount(current: number, target: number): number {
  return current + headcountRate(current, target) * (target - current);
}

/** n months of headcount adjustment at a constant target: N_n = N* + (N_0 − N*)(1 − r)^n. */
export function headcountAfter(current: number, target: number, months: number): number {
  return target + (current - target) * Math.pow(1 - headcountRate(current, target), months);
}

/** The reserve's monthly retention: 1 − 1/(12 × reserve years); no obligation keeps no reserve. */
export function reserveRetention(reserveYears: number): number {
  return reserveYears > 0 ? 1 - 1 / (12 * reserveYears) : 0;
}

/** Reservists gained per active member per month (conscripts finishing service, volunteers separating). */
export function reserveInflowRate(input: {
  volunteerShare: number;
  serviceMonths: number;
  reserveYears: number;
}): number {
  if (input.reserveYears <= 0) return 0;
  const v = clamp01(input.volunteerShare);
  const conscripts = ((1 - v) / Math.max(1, input.serviceMonths)) * RESERVE_OBLIGATION_CONSCRIPT;
  const volunteers = v * VOLUNTEER_SEPARATION_MONTHLY * RESERVE_OBLIGATION_VOLUNTEER;
  return conscripts + volunteers;
}

/** One month of the reserve: Rv ← Rv × retention + discharges × obligation (discharges from this month's N). */
export function stepReserves(reserves: number, active: number, retention: number, inflowRate: number) {
  return reserves * retention + active * inflowRate;
}

/**
 * n months of the reserve while N approaches its target geometrically (N_k = N* + g b^k):
 *   Rv_n = a^n Rv_0 + c N* (1 − a^n)/(1 − a) + c g (a^n − b^n)/(a − b)
 * exact against `stepReserves` + `stepHeadcount` at constant inputs.
 */
export function reservesAfter(input: {
  reserves: number;
  active: number;
  activeTarget: number;
  retention: number;
  inflowRate: number;
  months: number;
}): number {
  const { retention: a, inflowRate: c, months: n } = input;
  const b = 1 - headcountRate(input.active, input.activeTarget);
  const gap = input.active - input.activeTarget;
  const an = Math.pow(a, n);
  const steady = a < 1 ? (c * input.activeTarget * (1 - an)) / (1 - a) : c * input.activeTarget * n;
  const transient =
    Math.abs(a - b) > 1e-12
      ? (c * gap * (an - Math.pow(b, n))) / (a - b)
      : c * gap * n * Math.pow(a, n - 1);
  return an * input.reserves + steady + transient;
}

/** Reservists who have reported: M × (1 − e^(−t/τ_mob)), t in days since the order on the realm clock. */
export function mobilisedCount(input: {
  order: number;
  orderedClockMs: number | null;
  nowClockMs: number;
  doctrine: Doctrine;
}): number {
  if (input.order <= 0 || input.orderedClockMs === null) return 0;
  const days = Math.max(0, (input.nowClockMs - input.orderedClockMs) / DAY_MS);
  return input.order * (1 - Math.exp(-days / MOBILISATION_TAU_DAYS[input.doctrine]));
}
