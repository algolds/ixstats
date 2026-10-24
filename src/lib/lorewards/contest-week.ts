/**
 * The ISO week a weekly Loreward is stored under (design decision 18): the UTC ISO week, keyed `YYYY-Www`. The key is
 * where a weekly lives; its real first day stays in `dateStart`, so `contestIdentity` (type and first day) is unchanged.
 */
import { weekKey } from "~/lib/achievements/time-buckets";

export const ISO_WEEK_KEY = /^(\d{4})-W(\d{2})$/;

/** Where a weekly contest is stored: its ISO week key, its real first day and its last. */
export interface WeeklyKey {
  date: string;
  dateStart: string;
  dateEnd: string;
}

const DAY_MS = 86_400_000;

/** Midnight UTC of `day` (YYYY-MM-DD), or null when it is not a real day ("2026-02-30"). */
function dayMs(day: string): number | null {
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day ? null : ms;
}

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The Monday (YYYY-MM-DD) of an ISO week key, or null for a key that is not a real ISO week ("2025-W53"). */
export function isoWeekStart(key: string): string | null {
  const match = ISO_WEEK_KEY.exec(key);
  if (!match) return null;
  const jan4 = Date.UTC(Number(match[1]), 0, 4);
  const isoWeekday = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (isoWeekday - 1) * DAY_MS + (Number(match[2]) - 1) * 7 * DAY_MS;
  return weekKey(new Date(monday)) === key ? dayOf(monday) : null;
}

/**
 * A weekly that starts on `firstDay` (YYYY-MM-DD): keyed by the UTC ISO week of its middle day (first day + 3), so a
 * Monday-start week is its own ISO week and a Sunday-start week (the OOL pages before 2026) the ISO week holding six of
 * its days. dateStart is `firstDay`, dateEnd `firstDay + 6`. Null when `firstDay` is not a real day.
 */
export function weeklyKeyOfFirstDay(firstDay: string): WeeklyKey | null {
  const start = dayMs(firstDay);
  if (start === null) return null;
  return {
    date: weekKey(new Date(start + 3 * DAY_MS)),
    dateStart: firstDay,
    dateEnd: dayOf(start + 6 * DAY_MS),
  };
}

/** A weekly date as the bot or a page gives it: an ISO key (Monday to Sunday) or a first day. Null otherwise. */
export function canonicalWeekly(dateOrKey: string): WeeklyKey | null {
  if (!ISO_WEEK_KEY.test(dateOrKey)) return weeklyKeyOfFirstDay(dateOrKey);
  const monday = isoWeekStart(dateOrKey);
  return monday === null ? null : weeklyKeyOfFirstDay(monday);
}
