/**
 * Limits on military operations and strikes that keep them from being farmed, timed on the nation's realm clock
 * (realm time design: operation durations, conflict windows and strike cooldowns use the nation's realm clock; a
 * paused realm's operations wait).
 *
 * - Peacekeeping must deploy personnel, and its +10 relation bonus applies once per target per in-game year.
 * - A PvNPC strike needs an existing diplomatic relation with the target in the same realm, and one nation may
 *   strike the same target once per in-game month.
 *
 * Readiness writes live in the defense model (`DEPLOY_CONDITION_COST`, `TRAINING_EXERCISE_GAIN`,
 * `OPERATION_RESET_COST` in `./model/constants`, applied by `applyOperationReadiness`).
 */

/** Relation strength a peacekeeping operation adds with its target. */
export const PEACEKEEPING_RELATION_BONUS = 10;
/** In-game days before peacekeeping with the same target raises the relation again. */
export const PEACEKEEPING_BONUS_WINDOW_IXDAYS = 365;
/** In-game days between two PvNPC strikes on the same target by the same nation. */
export const PVNPC_STRIKE_COOLDOWN_IXDAYS = 30;
/** The Generals' "+10% military readiness": a training exercise's gain is 10% larger while they are satisfied. */
export const GENERALS_READINESS_MULTIPLIER = 1.1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The realm clock's speed, as `RealmClockReader` carries it (0 when paused). */
interface ClockSpeed {
  multiplier: number;
}

/**
 * The real instant `ixDays` in-game days before `now` on a realm clock. A paused realm's window never closes
 * (the epoch), so a cooldown started there waits for the clock.
 */
export function ixDaysAgo(ixDays: number, clock: ClockSpeed, now: Date = new Date()): Date {
  if (clock.multiplier <= 0) return new Date(0);
  return new Date(now.getTime() - (ixDays / clock.multiplier) * DAY_MS);
}

/** The real instant `ixDays` in-game days after `from` at the realm clock's speed; null while it is paused. */
export function ixDaysLater(from: Date, ixDays: number, clock: ClockSpeed): Date | null {
  if (clock.multiplier <= 0) return null;
  return new Date(from.getTime() + (ixDays / clock.multiplier) * DAY_MS);
}

export type OperationSuccessRating = "success" | "partial" | "failure";

/**
 * How an ended operation is rated, from how much of its planned duration it ran on the realm clock: all of it (or
 * no plan) is a success, at least half is partial, less is a failure.
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

/**
 * The nations an operation may target, from the caller's relations: one per nation, only those in the caller's realm
 * (relations made before the cross-realm rule remain, but the server refuses a target in another realm).
 */
export function operationTargets(
  relations: readonly { targetCountryId: string; targetCountry?: string | null; sameRealm: boolean }[]
): { id: string; name: string }[] {
  const byId = new Map<string, { id: string; name: string }>();
  for (const r of relations) {
    if (r.sameRealm && !byId.has(r.targetCountryId))
      byId.set(r.targetCountryId, { id: r.targetCountryId, name: r.targetCountry ?? r.targetCountryId });
  }
  return [...byId.values()];
}
