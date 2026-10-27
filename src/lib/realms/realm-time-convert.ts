/**
 * Real time ↔ a realm's clock time (realm time design §1), for timestamps recorded in real time that a nation's
 * simulation reads on its realm's clock (a bill's real `effectiveDate`, a meeting's real date) and the reverse.
 * Ixnay's reader (no stored clock) converts through IxTime's own history (its speed changes and bot overrides);
 * another realm's converts linearly through its current anchor and speed, so an instant before its last speed
 * change or date jump reads approximately. Client-safe and pure.
 */
import { IxTime } from "~/lib/ixtime";
import { realmClockNow, type RealmClockReader } from "./realm-clock";

/**
 * The slowest speed a conversion divides by: a paused realm (speed 0) never reaches a later time, so the real instant
 * of one is pushed far out (100 real days per realm day) rather than to infinity.
 */
export const MIN_DIVISOR_SPEED = 0.01;

/** A clock speed safe to divide by: a paused clock (0) reads as MIN_DIVISOR_SPEED. */
export function divisorSpeed(multiplier: number): number {
  return Math.max(multiplier, MIN_DIVISOR_SPEED);
}

/** The realm's clock time at a real instant (ms on the shared timeline). */
export function clockTimeAt(reader: RealmClockReader, realMs: number): number {
  return reader.clock ? realmClockNow(reader.clock, realMs) : IxTime.convertToIxTime(realMs);
}

/** The real instant the realm's clock reads `clockMs` (a paused clock's later times are far out, never infinite). */
export function realTimeAt(reader: RealmClockReader, clockMs: number): number {
  if (!reader.clock) return IxTime.convertFromIxTime(clockMs);
  const { anchorRealMs, anchorClockMs, multiplier } = reader.clock;
  return anchorRealMs + (clockMs - anchorClockMs) / divisorSpeed(multiplier);
}
