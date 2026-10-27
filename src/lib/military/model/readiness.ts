/**
 * Layer (c): readiness from O&M and time (research §7.3). Four DRRS-style sub-scores per branch, each in [0, 1]:
 * personnel fill P, equipment on hand S, equipment condition Rc and training T, combined by a soft minimum and
 * shown as C-1 … C-4.
 */
import {
  ALERT_LEVELS,
  ALERT_PARAMS,
  C_LEVEL_BANDS,
  CONSCRIPT_EQUIPMENT_NORM,
  DAY_MS,
  DOMAIN_PARAMS,
  MAINTENANCE_FUNDING_CAP,
  MAINTENANCE_OM_SHARE,
  O_M_FAVOUR_WEIGHT,
  RC_RATE_DOWN,
  RC_RATE_UP,
  READINESS_MIN_WEIGHT,
  TRAINING_HALF_LIFE_MONTHS,
  TRAINING_RATE_UP,
  T_MAX_CONSCRIPT,
  T_MAX_VOLUNTEER,
  type AlertLevel,
  type BranchDomain,
  type CLevel,
  type OmPriority,
} from "./constants";

const clamp = (min: number, max: number, value: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------------------------------------------

const alertRank = (level: AlertLevel) => ALERT_LEVELS.indexOf(level);

/** When an ordered alert level takes effect: a raise after its bite days (7 Elevated … 30 War), a lowering at once. */
export function alertEffectiveAt(input: {
  alertLevel: AlertLevel;
  previousAlertLevel: AlertLevel;
  alertChangedClockMs: number;
}): number {
  const raise = alertRank(input.alertLevel) > alertRank(input.previousAlertLevel);
  return raise
    ? input.alertChangedClockMs + ALERT_PARAMS[input.alertLevel].biteDays * DAY_MS
    : input.alertChangedClockMs;
}

/** The alert level in effect at a clock time. */
export function effectiveAlert(
  input: { alertLevel: AlertLevel; previousAlertLevel: AlertLevel; alertChangedClockMs: number },
  clockMs: number
): AlertLevel {
  return clockMs >= alertEffectiveAt(input) ? input.alertLevel : input.previousAlertLevel;
}

// ---------------------------------------------------------------------------------------------------------------
// O&M requirements and funding
// ---------------------------------------------------------------------------------------------------------------

/** Monthly maintenance requirement: ω × K (nominal) × alert × wear / 12. */
export function maintenanceRequirement(nominalCapital: number, alert: AlertLevel, wear: number) {
  return (MAINTENANCE_OM_SHARE * nominalCapital * ALERT_PARAMS[alert].omMultiplier * wear) / 12;
}

/** Monthly training requirement: τ_b × N × c_member × alert / 12. */
export function trainingRequirement(
  domain: BranchDomain,
  personnel: number,
  pay: number,
  alert: AlertLevel
) {
  return (
    (DOMAIN_PARAMS[domain].trainingShare * personnel * pay * ALERT_PARAMS[alert].omMultiplier) / 12
  );
}

/**
 * The O&M line split between maintenance and training in proportion to requirement (the favoured area weighs
 * 1.25), returned as funding ratios: f_m ∈ [0, 1.2], f_t ∈ [0, 1].
 */
export function omFunding(input: {
  omMonthly: number;
  maintenanceRequired: number;
  trainingRequired: number;
  priority: OmPriority;
}): { maintenance: number; training: number } {
  const wm = input.priority === "maintenance" ? O_M_FAVOUR_WEIGHT : 1;
  const wt = input.priority === "training" ? O_M_FAVOUR_WEIGHT : 1;
  const weighted = wm * input.maintenanceRequired + wt * input.trainingRequired;
  if (weighted <= 0) return { maintenance: 1, training: 1 };
  const perWeighted = Math.max(0, input.omMonthly) / weighted;
  return {
    maintenance: clamp(0, MAINTENANCE_FUNDING_CAP, perWeighted * wm),
    training: clamp(0, 1, perWeighted * wt),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Sub-score dynamics
// ---------------------------------------------------------------------------------------------------------------

/** Training ceiling by manpower: T_max = v × 1.0 + (1 − v) × 0.75. */
export function trainingMax(volunteerShare: number): number {
  const v = clamp(0, 1, volunteerShare);
  return v * T_MAX_VOLUNTEER + (1 - v) * T_MAX_CONSCRIPT;
}

/** T's cap: min(alert ceiling, T_max × f_t). */
export function trainingCap(volunteerShare: number, trainingFunding: number, alert: AlertLevel) {
  return Math.min(ALERT_PARAMS[alert].trainingCeiling, trainingMax(volunteerShare) * trainingFunding);
}

/** Condition's target: min(1, f_m). */
export const conditionTarget = (maintenanceFunding: number) => Math.min(1, maintenanceFunding);

/** One month of condition toward its target (backlog: up 0.06, down 0.10 a month). */
export function stepCondition(condition: number, target: number): number {
  const rate = target > condition ? RC_RATE_UP : RC_RATE_DOWN;
  return condition + rate * (target - condition);
}

/** n months of condition at a constant target. */
export function conditionAfter(condition: number, target: number, months: number): number {
  const rate = target > condition ? RC_RATE_UP : RC_RATE_DOWN;
  return target + (condition - target) * Math.pow(1 - rate, months);
}

const TRAINING_DECAY = Math.pow(2, -1 / TRAINING_HALF_LIFE_MONTHS);

/** One month of training: below the cap close 25% of the gap; above it decay with a 9-month half-life. */
export function stepTraining(training: number, cap: number): number {
  if (training < cap) return training + TRAINING_RATE_UP * (cap - training);
  return cap + (training - cap) * TRAINING_DECAY;
}

/** n months of training at a constant cap. */
export function trainingAfter(training: number, cap: number, months: number): number {
  const factor =
    training < cap ? Math.pow(1 - TRAINING_RATE_UP, months) : Math.pow(TRAINING_DECAY, months);
  return cap + (training - cap) * factor;
}

// ---------------------------------------------------------------------------------------------------------------
// Instant sub-scores and the overall rating
// ---------------------------------------------------------------------------------------------------------------

/** P: personnel against authorisation, the larger of the funded strength and the catalog crews. */
export function personnelFill(personnel: number, fundedStrength: number, crewRequired: number) {
  const authorised = Math.max(fundedStrength, crewRequired);
  if (authorised <= 0) return personnel > 0 ? 1 : 0;
  return clamp(0, 1, personnel / authorised);
}

/** S: capital on hand against the capital the force is organised around (κ_b × GDPpc per member). */
export function equipmentOnHand(input: {
  domain: BranchDomain;
  capital: number;
  personnel: number;
  gdpPerCapita: number;
  volunteerShare: number;
}): number {
  const norm = CONSCRIPT_EQUIPMENT_NORM + (1 - CONSCRIPT_EQUIPMENT_NORM) * clamp(0, 1, input.volunteerShare);
  const authorised =
    input.personnel *
    DOMAIN_PARAMS[input.domain].authorisedCapitalPerGdpPc *
    Math.max(0, input.gdpPerCapita) *
    norm;
  if (authorised <= 0) return input.capital > 0 ? 1 : 0;
  return clamp(0, 1, input.capital / authorised);
}

export interface SubScores {
  personnel: number;
  equipment: number;
  condition: number;
  training: number;
}

/** R = 0.6 × min(P, S, Rc, T) + 0.4 × (P·S·Rc·T)^(1/4). */
export function readinessScore(s: SubScores): number {
  const values = [s.personnel, s.equipment, s.condition, s.training].map((v) => clamp(0, 1, v));
  const min = Math.min(...values);
  const geometric = Math.pow(values.reduce((product, v) => product * v, 1), 1 / 4);
  return READINESS_MIN_WEIGHT * min + (1 - READINESS_MIN_WEIGHT) * geometric;
}

/** C-1 at R ≥ 0.90, C-2 ≥ 0.80, C-3 ≥ 0.70, else C-4. */
export function cLevel(readiness: number): CLevel {
  return C_LEVEL_BANDS.find((band) => readiness >= band.min)?.level ?? "C-4";
}
