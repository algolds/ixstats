import { z } from "zod";

/**
 * A realm's own clock (docs/superpowers/specs/2026-10-14-realm-clocks-design.md §1), stored in
 * `Realm.settings.clock`. It runs from an anchor at a speed; switched on equal to global IxTime, so nothing stored
 * moves. The calendar offset only changes the date it reads as. Client-safe and pure.
 */
export const MAX_REALM_SPEED = 12;
export const MAX_REALM_ERA = 16;
/** The founder changes the speed at most once a week; site staff are exempt. */
export const SPEED_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 0 pauses; up to 12×. */
export const RealmSpeedSchema = z.number().min(0).max(MAX_REALM_SPEED);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Midnight UTC of a YYYY-MM-DD date, or null when the date does not exist (years 1 to 9999). */
function utcMidnight(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1) return null;
  // setUTCFullYear, not Date.UTC: Date.UTC reads years 0 to 99 as 1900 to 1999.
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  const real = value.getUTCFullYear() === year && value.getUTCMonth() === month - 1;
  return real && value.getUTCDate() === day ? value.getTime() : null;
}

/** The in-world date the realm stands at when its clock is switched on (YYYY-MM-DD, years 1 to 9999). */
export const RealmStartDateSchema = z
  .string()
  .refine((date) => utcMidnight(date) !== null, "Choose a real date between the years 1 and 9999");

export const RealmClockSchema = z.object({
  anchorRealMs: z.number().finite(),
  anchorClockMs: z.number().finite(),
  multiplier: RealmSpeedSchema,
  changedAt: z.number().finite(),
  calendarOffsetMs: z.number().finite(),
  era: z.string().trim().max(MAX_REALM_ERA),
});

export type RealmClock = z.infer<typeof RealmClockSchema>;

/** The stored clock, or null when it is missing or malformed (the realm then runs on global IxTime). */
export function parseRealmClock(stored: unknown): RealmClock | null {
  const parsed = RealmClockSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/** The clock's time (on the shared timeline every stored timestamp uses). */
export function realmClockNow(clock: RealmClock, realNowMs: number): number {
  return clock.anchorClockMs + (realNowMs - clock.anchorRealMs) * clock.multiplier;
}

/** What the realm's calendar reads: the clock's time plus the calendar offset. */
export function realmCalendarMs(clock: RealmClock, realNowMs: number): number {
  return realmClockNow(clock, realNowMs) + clock.calendarOffsetMs;
}

/**
 * Switch a realm's clock on: equal to global IxTime now, its calendar reading `startDate` at the clock's current
 * time of day.
 */
export function createRealmClock(input: {
  globalNowMs: number;
  realNowMs: number;
  startDate: string;
  era: string;
  multiplier: number;
}): RealmClock {
  const midnight = utcMidnight(input.startDate);
  if (midnight === null) throw new Error(`Not a date: ${input.startDate}`);
  const timeOfDay = ((input.globalNowMs % DAY_MS) + DAY_MS) % DAY_MS;
  return {
    anchorRealMs: input.realNowMs,
    anchorClockMs: input.globalNowMs,
    multiplier: input.multiplier,
    changedAt: input.realNowMs,
    calendarOffsetMs: midnight + timeOfDay - input.globalNowMs,
    era: input.era.trim(),
  };
}

/** The clock at a new speed from now on: re-anchored, so its time never jumps. Starts the cooldown. */
export function withSpeed(clock: RealmClock, multiplier: number, realNowMs: number): RealmClock {
  return {
    ...clock,
    anchorClockMs: realmClockNow(clock, realNowMs),
    anchorRealMs: realNowMs,
    multiplier,
    changedAt: realNowMs,
  };
}

/** When the founder may change the speed again. */
export function nextSpeedChangeAt(clock: RealmClock): number {
  return clock.changedAt + SPEED_CHANGE_COOLDOWN_MS;
}

/** "14 March 1203 AE"; no era, just the date. */
export function formatRealmDate(clock: RealmClock, realNowMs: number): string {
  const date = new Date(realmCalendarMs(clock, realNowMs));
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return clock.era ? `${label} ${clock.era}` : label;
}

/** "Paused", "×2", "×0.5". */
export function formatRealmSpeed(multiplier: number): string {
  return multiplier === 0 ? "Paused" : `×${Number(multiplier.toFixed(2))}`;
}
