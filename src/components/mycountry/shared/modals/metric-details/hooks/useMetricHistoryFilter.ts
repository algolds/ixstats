import { subMonths } from "date-fns";
import { addRealmMonths, formatRealmMonth } from "~/lib/realms/nation-time";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import type { TimeRange } from "../types";

interface MetricHistoryPoint {
  id?: string;
  countryId?: string;
  ixTimeTimestamp?: string | number | Date;
  timestamp?: string | number | Date;
  date?: string | number | Date;
  population?: number;
  populationGrowthRate?: number;
  populationDensity?: number | null;
  totalGdp?: number;
  gdpPerCapita?: number;
  gdpGrowthRate?: number;
  gdpGrowth?: number;
  landArea?: number | null;
  [key: string]: unknown;
}

/**
 * Calculates historical cutoff date from a TimeRange enum
 */
const RANGE_MONTHS: Record<TimeRange, number> = {
  "3m": 3,
  "6m": 6,
  "1y": 12,
  "2y": 24,
  "4y": 48,
  "5y": 60,
  "20y": 240,
  all: Infinity,
};

function getCutoffDate(timeRange: TimeRange, now: Date = new Date()): Date {
  const months = RANGE_MONTHS[timeRange] ?? 12;
  return months === Infinity ? new Date(0) : subMonths(now, months);
}

/** The window's start on the nation's realm clock, in its calendar's months (0: all time). */
function clockCutoff(timeRange: TimeRange, clock: Pick<RealmClockReader, "now" | "calendar">) {
  const months = RANGE_MONTHS[timeRange] ?? 12;
  return months === Infinity ? 0 : addRealmMonths(clock.now(), -months, clock.calendar);
}

const toMs = (value: string | number | Date) =>
  typeof value === "number" ? value : new Date(value).getTime();

/**
 * Pure function to filter, slice, transform, and chronologically sort historical metric data. Points stamped on
 * the clock (`ixTimeTimestamp`) are windowed on the nation's realm clock and labelled in its calendar.
 */
export function filterAndSortHistory<T extends MetricHistoryPoint, R>(
  data: T[] | undefined | null,
  timeRange: TimeRange,
  transform: (point: T, formattedDate: string, timestamp: string | number | Date) => R,
  maxPoints: number,
  clock: Pick<RealmClockReader, "now" | "calendar">
): R[] {
  if (!data || data.length === 0) return [];

  const cutoffIx = clockCutoff(timeRange, clock);
  const cutoffReal = getCutoffDate(timeRange);

  return data
    .filter((point) => {
      if (point.ixTimeTimestamp !== undefined && point.ixTimeTimestamp !== null) {
        const ts = toMs(point.ixTimeTimestamp);
        return Number.isFinite(ts) && ts >= cutoffIx;
      }
      const rawDate = point.timestamp ?? point.date;
      if (!rawDate) return true;
      return new Date(rawDate) >= cutoffReal;
    })
    .slice(-maxPoints)
    .map((point) => {
      const rawDate = point.ixTimeTimestamp ?? point.timestamp ?? point.date ?? new Date();
      const ms = toMs(rawDate);
      const formattedDate = Number.isFinite(ms) ? formatRealmMonth(ms, clock.calendar) : "";
      return transform(point, formattedDate, rawDate);
    })
    .sort((a, b) => {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
      const timeA = new Date(
        (objA.timestamp ?? objA.date ?? 0) as string | number | Date
      ).getTime();
      const timeB = new Date(
        (objB.timestamp ?? objB.date ?? 0) as string | number | Date
      ).getTime();
      return timeA - timeB;
    });
}
