/**
 * Real-time buckets for achievement durations ("12 different weeks", "6 months"). Everything is
 * UTC and reads real `Date`s only, never IxTime, so realms with other clocks are on equal footing.
 */

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/** A real month for "N months" floors, so a duration never depends on calendar month lengths. */
export const MONTH_MS = 30.44 * DAY_MS;

/** ISO week of the date's ISO year, e.g. "2026-W42" (weeks start on Monday, UTC). */
export const weekKey = (d: Date): string => {
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || WEEK_DAYS));
  const year = thursday.getUTCFullYear();
  const dayOfYear = (thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1;
  return `${year}-W${String(Math.ceil(dayOfYear / WEEK_DAYS)).padStart(2, "0")}`;
};

/** UTC year and month, e.g. "2026-10". */
export const monthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** How many different buckets the dates fall in. */
export function distinctBuckets(dates: Date[], key: (d: Date) => string): number {
  return new Set(dates.map(key)).size;
}

/** Monday-based week number since the epoch (1970-01-01 was a Thursday), so neighbours differ by 1. */
const weekIndex = (d: Date): number =>
  Math.floor((Math.floor(d.getTime() / DAY_MS) + 3) / WEEK_DAYS);

/** The longest run of consecutive ISO weeks that each hold at least one date. */
export function longestConsecutiveWeeks(dates: Date[]): number {
  const weeks = [...new Set(dates.map(weekIndex))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  weeks.forEach((week, i) => {
    run = i > 0 && week === weeks[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/** Real time between the earliest and the latest date (0 for fewer than two). */
export function spanMs(dates: Date[]): number {
  if (dates.length < 2) return 0;
  const times = dates.map((d) => d.getTime());
  return Math.max(...times) - Math.min(...times);
}
