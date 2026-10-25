import { IxTime } from "~/lib/ixtime";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { addCalendarYears, calendarParts, partsToCalendarMs } from "./realm-calendar";
import {
  formatRealmDate,
  realmClockNow,
  type RealmCalendar,
  type RealmClockReader,
} from "./realm-clock";

/**
 * A nation's time as its pages show it (realm time design §1, 10-14 spec §4): dates in its realm's calendar,
 * countdowns at its realm's speed. Pure and client-safe; the reader comes from `useNationClock`.
 */

/** What a date shows while the nation's clock is loading. */
export const CLOCK_PENDING = "–";

/** A time on the nation's clock as a date in its realm's calendar, or `CLOCK_PENDING` while the clock loads. */
export function formatClockDate(
  clockMs: number | null | undefined,
  reader: Pick<RealmClockReader, "calendar"> | null,
  fallback = CLOCK_PENDING
): string {
  if (!reader) return CLOCK_PENDING;
  return typeof clockMs === "number" && Number.isFinite(clockMs)
    ? formatRealmDate(clockMs, reader.calendar)
    : fallback;
}

/**
 * The nation's clock time at a real moment (a row's createdAt). From the clock's anchor on it is the clock's own
 * reading; before it, the realm ran continuous with IxTime (realm clocks start equal to it), capped at the anchor
 * so the timeline never runs backwards. Ixnay reads IxTime.
 */
export function clockTimeAt(reader: Pick<RealmClockReader, "clock">, realMs: number): number {
  const { clock } = reader;
  if (clock && realMs >= clock.anchorRealMs) return realmClockNow(clock, realMs);
  const ixTime = IxTime.convertToIxTime(realMs);
  return clock ? Math.min(ixTime, clock.anchorClockMs) : ixTime;
}

/** A stored wall-clock stamp as the date it fell on in the nation's calendar; `fallback` when there is none. */
export function formatStampAsClockDate(
  stamp: string | Date | number | null | undefined,
  reader: Pick<RealmClockReader, "clock" | "calendar"> | null,
  fallback = "N/A"
): string {
  if (!reader) return CLOCK_PENDING;
  const ms = stamp == null ? Number.NaN : new Date(stamp).getTime();
  return Number.isFinite(ms) ? formatRealmDate(clockTimeAt(reader, ms), reader.calendar) : fallback;
}

/** The calendar year a clock time falls in. */
export function realmYear(clockMs: number, calendar: RealmCalendar): number {
  return calendarParts(clockMs + calendar.calendarOffsetMs, calendar.months).year;
}

/** The calendar year a clock time falls in, with the fraction of it gone (for ordering and chart axes). */
export function realmFractionalYear(clockMs: number, calendar: RealmCalendar): number {
  const calendarMs = clockMs + calendar.calendarOffsetMs;
  const { year } = calendarParts(calendarMs, calendar.months);
  const start = partsToCalendarMs({ year, month: 0, day: 1 }, calendar.months) ?? calendarMs;
  const length = addCalendarYears(start, 1, calendar.months) - start;
  return length > 0 ? year + (calendarMs - start) / length : year;
}

/** Real ms until the clock reaches `targetMs` at its speed, or null while it is paused. */
export function realMsUntil(targetMs: number, nowMs: number, multiplier: number): number | null {
  if (multiplier <= 0) return null;
  return Math.max(0, (targetMs - nowMs) / multiplier);
}

/**
 * A live countdown to a time on the nation's clock, in real time at the realm's speed ("2d 4h", "6h 12m", "45m",
 * "now"); "Paused" while the realm's clock is stopped, `CLOCK_PENDING` while it loads.
 */
export function formatRealmCountdown(
  targetMs: number,
  nowMs: number,
  reader: Pick<RealmClockReader, "multiplier"> | null
): string {
  if (!reader) return CLOCK_PENDING;
  if (targetMs <= nowMs) return "now";
  const realMs = realMsUntil(targetMs, nowMs, reader.multiplier);
  return realMs === null ? "Paused" : formatIxCountdown(realMs, 0);
}
