import { z } from "zod";
import {
  addCalendarYears,
  calendarParts,
  DAY_MS,
  partsToCalendarMs,
  RealmMonthsSchema,
  remapCalendarMs,
  type RealmCalendar,
  type RealmDateParts,
  type RealmMonth,
} from "./realm-calendar";

export {
  formatRealmDate,
  parseRealmDate,
  type RealmCalendar,
  type RealmDateParts,
  type RealmMonth,
} from "./realm-calendar";

/**
 * A realm's own clock (docs/specs/2026-10-25-realm-time-design.md §1, revising the 2026-10-14 realm
 * clocks spec), stored in `Realm.settings.clock`. Every realm but Ixnay has one from founding (Ixnay's clock is the
 * bot-synced IxTime). It runs from an anchor at a speed on the shared timeline every stored IxTime column uses; the
 * calendar offset and months only change the date it reads as. Client-safe and pure.
 */
export const MAX_REALM_SPEED = 12;
export const MAX_REALM_ERA = 16;
/** A new realm's speed unless its founder picks another: Ixnay's. */
export const DEFAULT_REALM_SPEED = 2;
/** The founder changes the speed at most once a week; site staff are exempt. */
export const SPEED_CHANGE_COOLDOWN_MS = 7 * DAY_MS;
/** The founder jumps the date at most once a week; site staff are exempt. */
export const JUMP_COOLDOWN_MS = 7 * DAY_MS;
/** One jump moves the date at most this many of the realm's years. */
export const MAX_JUMP_YEARS = 5;
/** The longest jump any calendar allows (24 months of 100 days, 5 years), for input bounds. */
export const MAX_JUMP_DAYS = MAX_JUMP_YEARS * 24 * 100;

/** 0 pauses; up to 12×. */
export const RealmSpeedSchema = z.number().min(0).max(MAX_REALM_SPEED);

export const RealmEraSchema = z.string().trim().max(MAX_REALM_ERA);

/** Midnight UTC of a YYYY-MM-DD date, or null when the date does not exist (years 1 to 9999). */
function utcMidnight(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1) return null;
  return partsToCalendarMs({ year, month: Number(match[2]) - 1, day: Number(match[3]) });
}

/** The in-world date the realm stands at when its clock is switched on (YYYY-MM-DD, years 1 to 9999). */
export const RealmStartDateSchema = z
  .string()
  .refine((date) => utcMidnight(date) !== null, "Choose a real date between the years 1 and 9999");

export const RealmClockSchema = z.object({
  anchorRealMs: z.number().finite(),
  anchorClockMs: z.number().finite(),
  multiplier: RealmSpeedSchema,
  /** When the speed last changed (real ms): the speed cooldown. */
  changedAt: z.number().finite(),
  calendarOffsetMs: z.number().finite(),
  era: RealmEraSchema,
  /** The founder's months; absent is Gregorian. */
  months: RealmMonthsSchema.optional(),
  /** When the date last jumped (real ms): the jump cooldown. */
  jumpedAt: z.number().finite().optional(),
});

export type RealmClock = z.infer<typeof RealmClockSchema>;

/** What founding a realm asks for: the date it starts at, its era and its speed (default ×2). */
export const RealmFoundingClockSchema = z.object({
  startDate: RealmStartDateSchema,
  era: RealmEraSchema,
  multiplier: RealmSpeedSchema.default(DEFAULT_REALM_SPEED),
});

export type RealmFoundingClock = z.infer<typeof RealmFoundingClockSchema>;

/**
 * A realm's time as every reader sees it: the server API (`~/server/shared/realm-time`) and the client hooks
 * (`useRealmClock`, `useCountryClock`) return one.
 */
export interface RealmClockReader {
  readonly realmId: string;
  /** The realm's time now, in ms on the shared timeline every stored IxTime column uses. */
  now(): number;
  readonly multiplier: number;
  readonly paused: boolean;
  /** For `formatRealmDate(reader.now(), reader.calendar)` and `parseRealmDate`. */
  readonly calendar: RealmCalendar;
  /** The stored clock; null when the reader runs on Ixnay's clock (bot-synced IxTime). */
  readonly clock: RealmClock | null;
  /** The realm should have a clock but has none (logged): it reads Ixnay's clock until it gets one. */
  readonly fallback: boolean;
}

/** Ixnay's calendar: Gregorian, no era, no offset. */
export const IXNAY_CALENDAR: RealmCalendar = { calendarOffsetMs: 0, era: "" };

/** The reader for a stored clock. */
export function realmClockReader(
  realmId: string,
  clock: RealmClock,
  realNow: () => number = Date.now
): RealmClockReader {
  return {
    realmId,
    now: () => realmClockNow(clock, realNow()),
    multiplier: clock.multiplier,
    paused: clock.multiplier === 0,
    calendar: clock,
    clock,
    fallback: false,
  };
}

/** A reader on Ixnay's clock (`now`, its speed), for Ixnay itself or, with `fallback`, a realm missing its clock. */
export function ixnayClockReader(
  realmId: string,
  source: { now: () => number; multiplier: number },
  fallback = false
): RealmClockReader {
  return {
    realmId,
    now: source.now,
    multiplier: source.multiplier,
    paused: source.multiplier === 0,
    calendar: IXNAY_CALENDAR,
    clock: null,
    fallback,
  };
}

/** The stored clock, or null when it is missing or malformed (an error for every realm but Ixnay). */
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

const timeOfDay = (ms: number) => ((ms % DAY_MS) + DAY_MS) % DAY_MS;

/**
 * A new clock: equal to Ixnay's time now (so no stored timestamp moves), its calendar reading `startDate` at the
 * clock's current time of day.
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
  return {
    anchorRealMs: input.realNowMs,
    anchorClockMs: input.globalNowMs,
    multiplier: input.multiplier,
    changedAt: input.realNowMs,
    calendarOffsetMs: midnight + timeOfDay(input.globalNowMs) - input.globalNowMs,
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

/**
 * The clock on new months (null: Gregorian). Today keeps its year, and its month and day where the new calendar has
 * them (else the last one); the clock's own time does not move.
 */
export function withCalendar(
  clock: RealmClock,
  months: RealmMonth[] | null,
  realNowMs: number
): RealmClock {
  const clockNow = realmClockNow(clock, realNowMs);
  const calendarNow = remapCalendarMs(clockNow + clock.calendarOffsetMs, clock.months, months);
  const { months: _previous, ...rest } = clock;
  return {
    ...rest,
    ...(months && { months }),
    calendarOffsetMs: calendarNow - clockNow,
  };
}

/** When the founder may change the speed again. */
export function nextSpeedChangeAt(clock: RealmClock): number {
  return clock.changedAt + SPEED_CHANGE_COOLDOWN_MS;
}

/** When the founder may jump the date again (0: now). */
export function nextJumpAt(clock: Pick<RealmClock, "jumpedAt">): number {
  return clock.jumpedAt === undefined ? 0 : clock.jumpedAt + JUMP_COOLDOWN_MS;
}

/** The most days one jump may move a calendar standing at `calendarMs`: 5 of its years. */
export function maxJumpDays(calendarMs: number, months?: readonly RealmMonth[] | null): number {
  return Math.floor((addCalendarYears(calendarMs, MAX_JUMP_YEARS, months) - calendarMs) / DAY_MS);
}

/** Whole days from today in the calendar to `target`, or null when the target is no date of it. */
export function daysUntil(
  calendarMs: number,
  target: RealmDateParts,
  months?: readonly RealmMonth[] | null
): number | null {
  const targetMs = partsToCalendarMs(target, months);
  if (targetMs === null) return null;
  return Math.round((targetMs - (calendarMs - timeOfDay(calendarMs))) / DAY_MS);
}

/** The clock `days` ahead: time really passes for the realm. Starts the jump cooldown. */
export function withJump(clock: RealmClock, days: number, realNowMs: number): RealmClock {
  return { ...clock, anchorClockMs: clock.anchorClockMs + days * DAY_MS, jumpedAt: realNowMs };
}

/** Today's date in the clock's calendar. */
export function realmToday(clock: RealmClock, realNowMs: number): RealmDateParts {
  return calendarParts(realmCalendarMs(clock, realNowMs), clock.months);
}

/** "Paused", "×2", "×0.5". */
export function formatRealmSpeed(multiplier: number): string {
  return multiplier === 0 ? "Paused" : `×${Number(multiplier.toFixed(2))}`;
}

/** The speed field's text as a speed, or null when it is not one (empty is not 0). */
export function parseRealmSpeed(text: string): number | null {
  const value = Number(text);
  return text.trim() !== "" && RealmSpeedSchema.safeParse(value).success ? value : null;
}
