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
