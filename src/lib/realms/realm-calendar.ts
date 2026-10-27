import { z } from "zod";

/**
 * A realm's calendar (docs/superpowers/specs/2026-10-25-realm-time-design.md §1): Gregorian, or month names and
 * lengths the founder defines (no custom weekdays or leap rules). A year is the sum of its months. Calendar time is
 * the clock's time plus the calendar offset; a custom calendar counts from the first day of year 1 at 0 ms.
 * Client-safe and pure.
 */
export const MAX_REALM_MONTHS = 24;
export const MAX_MONTH_DAYS = 100;
export const MAX_MONTH_NAME = 24;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const GREGORIAN_MONTH_NAMES = [
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

const hasUniqueNames = (months: readonly { name: string }[]) =>
  new Set(months.map((m) => m.name.trim().toLowerCase())).size === months.length;

export const RealmMonthSchema = z.object({
  name: z.string().trim().min(1, "Every month needs a name").max(MAX_MONTH_NAME),
  days: z
    .number()
    .int("Days are whole numbers")
    .min(1, "A month has at least 1 day")
    .max(MAX_MONTH_DAYS, `A month has at most ${MAX_MONTH_DAYS} days`),
});

/** 1 to 24 months of 1 to 100 days, each with its own name. */
export const RealmMonthsSchema = z
  .array(RealmMonthSchema)
  .min(1, "A calendar has at least one month")
  .max(MAX_REALM_MONTHS, `A calendar has at most ${MAX_REALM_MONTHS} months`)
  .refine(hasUniqueNames, "Each month needs its own name");

export type RealmMonth = z.infer<typeof RealmMonthSchema>;

/** What reading a date needs: the clock's offset to its calendar, the era, and custom months (none: Gregorian). */
export interface RealmCalendar {
  calendarOffsetMs: number;
  era: string;
  months?: RealmMonth[] | null;
}

/** A calendar date: `month` counts from 0, `day` from 1. */
export interface RealmDateParts {
  year: number;
  month: number;
  day: number;
}

/** Why the months can't be saved, or null when they can. */
export function realmMonthsError(months: readonly RealmMonth[]): string | null {
  const parsed = RealmMonthsSchema.safeParse(months);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check the months");
}

/** Days in a custom year. */
export function yearDays(months: readonly RealmMonth[]): number {
  return months.reduce((sum, month) => sum + month.days, 0);
}

/** The calendar's month names, Gregorian when it has none of its own. */
export function realmMonthNames(months?: readonly RealmMonth[] | null): string[] {
  return months?.length ? months.map((m) => m.name) : [...GREGORIAN_MONTH_NAMES];
}

const timeOfDay = (calendarMs: number) => ((calendarMs % DAY_MS) + DAY_MS) % DAY_MS;

/** A Gregorian date's midnight (UTC), or null when it does not exist. */
function gregorianMidnight({ year, month, day }: RealmDateParts): number | null {
  // setUTCFullYear, not Date.UTC: Date.UTC reads years 0 to 99 as 1900 to 1999.
  const value = new Date(0);
  value.setUTCFullYear(year, month, day);
  const real = value.getUTCFullYear() === year && value.getUTCMonth() === month;
  return real && value.getUTCDate() === day ? value.getTime() : null;
}

function gregorianDaysIn(year: number, month: number): number {
  const value = new Date(0);
  value.setUTCFullYear(year, month + 1, 0);
  return value.getUTCDate();
}

function customParts(calendarMs: number, months: readonly RealmMonth[]): RealmDateParts {
  const dayIndex = Math.floor(calendarMs / DAY_MS);
  const length = yearDays(months);
  const yearIndex = Math.floor(dayIndex / length);
  let dayOfYear = dayIndex - yearIndex * length;
  let month = 0;
  while (dayOfYear >= months[month]!.days) {
    dayOfYear -= months[month]!.days;
    month += 1;
  }
  return { year: yearIndex + 1, month, day: dayOfYear + 1 };
}

/** The date calendar time falls on. */
export function calendarParts(
  calendarMs: number,
  months?: readonly RealmMonth[] | null
): RealmDateParts {
  if (months?.length) return customParts(calendarMs, months);
  const date = new Date(calendarMs);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** Days in a month of the calendar. */
export function monthDays(
  year: number,
  month: number,
  months?: readonly RealmMonth[] | null
): number {
  return months?.length ? (months[month]?.days ?? 0) : gregorianDaysIn(year, month);
}

/** Calendar time at the start of a date, or null when the date does not exist in the calendar. */
export function partsToCalendarMs(
  parts: RealmDateParts,
  months?: readonly RealmMonth[] | null
): number | null {
  const valid =
    Number.isInteger(parts.year) && Number.isInteger(parts.month) && Number.isInteger(parts.day);
  if (!valid) return null;
  if (!months?.length) return gregorianMidnight(parts);
  const month = months[parts.month];
  if (!month || parts.day < 1 || parts.day > month.days) return null;
  const before = yearDays(months.slice(0, parts.month));
  return ((parts.year - 1) * yearDays(months) + before + parts.day - 1) * DAY_MS;
}

/** The same date in another calendar: the year kept, the month and day clamped to what it has. */
function clampParts(parts: RealmDateParts, months?: readonly RealmMonth[] | null): RealmDateParts {
  const monthCount = months?.length ? months.length : GREGORIAN_MONTH_NAMES.length;
  const month = Math.min(parts.month, monthCount - 1);
  return {
    year: parts.year,
    month,
    day: Math.min(parts.day, monthDays(parts.year, month, months)),
  };
}

/** Calendar time read in `to` instead of `from`: the same year, month and day where they exist, and time of day. */
export function remapCalendarMs(
  calendarMs: number,
  from: readonly RealmMonth[] | null | undefined,
  to: readonly RealmMonth[] | null | undefined
): number {
  const parts = clampParts(calendarParts(calendarMs, from), to);
  return (partsToCalendarMs(parts, to) ?? 0) + timeOfDay(calendarMs);
}

/** Calendar time `years` calendar years on (Gregorian: the same day, clamped at the month's end). */
export function addCalendarYears(
  calendarMs: number,
  years: number,
  months?: readonly RealmMonth[] | null
): number {
  if (months?.length) return calendarMs + years * yearDays(months) * DAY_MS;
  const parts = calendarParts(calendarMs);
  const shifted = clampParts({ ...parts, year: parts.year + years });
  return (gregorianMidnight(shifted) ?? calendarMs) + timeOfDay(calendarMs);
}

/** "14 Frostfall 812 AE" for a time on the clock's timeline; no era, just the date. */
export function formatRealmDate(clockMs: number, calendar: RealmCalendar): string {
  const { year, month, day } = calendarParts(clockMs + calendar.calendarOffsetMs, calendar.months);
  const label = `${day} ${realmMonthNames(calendar.months)[month]} ${year}`;
  return calendar.era ? `${label} ${calendar.era}` : label;
}

/** The text without the calendar's era at its end. */
function withoutEra(text: string, era: string): string {
  const trimmed = text.trim();
  if (!era) return trimmed;
  const tail = trimmed.slice(-era.length);
  return tail.toLowerCase() === era.toLowerCase() ? trimmed.slice(0, -era.length).trim() : trimmed;
}

/**
 * The inverse of `formatRealmDate`: "14 Frostfall 812" (the era optional, any case) to the clock time the date
 * starts at, or null when it is no date of this calendar.
 */
export function parseRealmDate(text: string, calendar: RealmCalendar): number | null {
  const match = /^(\d{1,3})\s+(.+?)\s+(-?\d{1,6})$/.exec(withoutEra(text, calendar.era));
  if (!match) return null;
  const names = realmMonthNames(calendar.months).map((name) => name.toLowerCase());
  const month = names.indexOf(match[2]!.trim().toLowerCase());
  if (month < 0) return null;
  const calendarMs = partsToCalendarMs(
    { year: Number(match[3]), month, day: Number(match[1]) },
    calendar.months
  );
  return calendarMs === null ? null : calendarMs - calendar.calendarOffsetMs;
}
