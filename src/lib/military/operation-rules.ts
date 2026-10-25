/**
 * Limits on military operations and strikes that keep them from being farmed.
 *
 * - Peacekeeping must deploy personnel, and its +10 relation bonus applies once per target per
 *   IxTime year.
 * - A PvNPC strike needs an existing diplomatic relation with the target in the same realm, and
 *   one nation may strike the same target once per IxTime month.
 */
import { IxTime } from "~/lib/ixtime";

/** Relation strength a peacekeeping operation adds with its target. */
export const PEACEKEEPING_RELATION_BONUS = 10;
/** IxTime days before peacekeeping with the same target raises the relation again. */
export const PEACEKEEPING_BONUS_WINDOW_IXDAYS = 365;
/** IxTime days between two PvNPC strikes on the same target by the same nation. */
export const PVNPC_STRIKE_COOLDOWN_IXDAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The real instant `ixDays` IxTime days before `now` (IxTime runs faster than real time). */
export function ixDaysAgo(ixDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - (ixDays / IxTime.getDefaultMultiplier()) * DAY_MS);
}

/** The real instant `ixDays` IxTime days after `from`. */
export function ixDaysLater(from: Date, ixDays: number): Date {
  return new Date(from.getTime() + (ixDays / IxTime.getDefaultMultiplier()) * DAY_MS);
}

// ---------------------------------------------------------------------------------------------
// Readiness. Deploying a unit costs readiness; ending the operation recovers some. Training
// recovers more than it cost, so an exercise ends with a net gain; other operations wear forces
// down. Readiness stays within 0-100.
// ---------------------------------------------------------------------------------------------

/** Readiness each deployed unit loses when an operation starts. */
export const DEPLOY_READINESS_COST = 10;
/** Readiness each recalled unit regains when a training exercise ends (net +10). */
export const TRAINING_READINESS_RECOVERY = 20;
/** Readiness each recalled unit regains when any other operation ends (net -5). */
export const OPERATION_READINESS_RECOVERY = 5;
/** The Generals' "+10% military readiness": recovery is 10% larger while they are satisfied. */
export const GENERALS_READINESS_MULTIPLIER = 1.1;

export const READINESS_MIN = 0;
export const READINESS_MAX = 100;

/** Readiness each recalled unit regains when the operation ends. */
export function readinessRecovery(operationType: string, generalsSatisfied: boolean): number {
  const base =
    operationType === "training" ? TRAINING_READINESS_RECOVERY : OPERATION_READINESS_RECOVERY;
  return Math.round(base * (generalsSatisfied ? GENERALS_READINESS_MULTIPLIER : 1));
}

export type OperationSuccessRating = "success" | "partial" | "failure";

/**
 * How an ended operation is rated, from how much of its planned IxTime duration it ran: all of it
 * (or no plan) is a success, at least half is partial, less is a failure.
 */
export function operationSuccessRating(input: {
  durationIxDays: number | null;
  startIxTime: number;
  endIxTime: number;
}): OperationSuccessRating {
  if (!input.durationIxDays || input.durationIxDays <= 0) return "success";
  const ranIxDays = (input.endIxTime - input.startIxTime) / DAY_MS;
  const share = ranIxDays / input.durationIxDays;
  if (share >= 1) return "success";
  return share >= 0.5 ? "partial" : "failure";
}
