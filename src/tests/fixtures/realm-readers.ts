/**
 * Realm clock readers for client tests: a nation in a 6× realm on a custom calendar ("Frostfall", era AE), the same
 * realm paused, and Ixnay (Gregorian, ×2). All three stand at the same shared-timeline instant `CLOCK_NOW`.
 */
import {
  createRealmClock,
  ixnayClockReader,
  realmClockReader,
  withCalendar,
  withSpeed,
  type RealmClockReader,
} from "~/lib/realms/realm-clock";
import type { RealmMonth } from "~/lib/realms/realm-calendar";

export const REAL_NOW = Date.UTC(2026, 9, 25, 12);
/** Shared-timeline ms every reader below reads at `REAL_NOW`. */
export const CLOCK_NOW = Date.UTC(2041, 5, 2, 9, 30);
export const DAY = 86_400_000;

export const FROST_MONTHS: RealmMonth[] = [
  { name: "Thaw", days: 30 },
  { name: "Frostfall", days: 40 },
];

function frostClock(multiplier: number) {
  const founded = createRealmClock({
    globalNowMs: CLOCK_NOW,
    realNowMs: REAL_NOW,
    startDate: "0812-01-14",
    era: "AE",
    multiplier: 2,
  });
  return withSpeed(withCalendar(founded, FROST_MONTHS, REAL_NOW), multiplier, REAL_NOW);
}

/** A 6× realm on the Frostfall calendar; `now()` follows `realNow`. */
export function sixTimesReader(realNow: () => number = () => REAL_NOW): RealmClockReader {
  return realmClockReader("realm-frost", frostClock(6), realNow);
}

/** The Frostfall realm, paused. */
export function pausedReader(realNow: () => number = () => REAL_NOW): RealmClockReader {
  return realmClockReader("realm-frost", frostClock(0), realNow);
}

/** Ixnay at ×2. */
export function ixnayReader(now: () => number = () => CLOCK_NOW): RealmClockReader {
  return ixnayClockReader("ixnay", { now, multiplier: 2 });
}
