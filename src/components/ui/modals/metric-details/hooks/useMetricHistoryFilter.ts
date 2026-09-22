import { useMemo } from "react";
import { subMonths, format } from "date-fns";
import { IxTime } from "~/lib/ixtime";
import { getIxCutoff } from "~/lib/ixtime/range";
import type { TimeRange } from "../types";

export interface MetricHistoryPoint {
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
export function getCutoffDate(timeRange: TimeRange, now: Date = new Date()): Date {
  const rangeMap: Record<TimeRange, number> = {
    "3m": 3,
    "6m": 6,
    "1y": 12,
    "2y": 24,
    "4y": 48,
    "5y": 60,
    "20y": 240,
    all: Infinity,
  };

  const months = rangeMap[timeRange] ?? 12;
  return months === Infinity ? new Date(0) : subMonths(now, months);
}

/**
 * Pure function to filter, slice, transform, and chronologically sort historical metric data
 */
export function filterAndSortHistory<T extends MetricHistoryPoint, R>(
  data: T[] | undefined | null,
  timeRange: TimeRange,
  transform: (point: T, formattedDate: string, timestamp: string | number | Date) => R,
  maxPoints: number = 100
): R[] {
  if (!data || data.length === 0) return [];

  const nowIx = IxTime.getCurrentIxTime();
  const cutoffIx = getIxCutoff(timeRange, nowIx);
  const cutoffReal = getCutoffDate(timeRange);

  return data
    .filter((point) => {
      if (point.ixTimeTimestamp !== undefined && point.ixTimeTimestamp !== null) {
        const ts = IxTime.toTimestamp(point.ixTimeTimestamp as string | number | Date);
        return ts !== null && ts >= cutoffIx;
      }
      const rawDate = point.timestamp ?? point.date;
      if (!rawDate) return true;
      return new Date(rawDate) >= cutoffReal;
    })
    .slice(-maxPoints)
    .map((point) => {
      const rawDate = point.ixTimeTimestamp ?? point.timestamp ?? point.date ?? new Date();
      const dateObj = new Date(rawDate);
      const formattedDate = !isNaN(dateObj.getTime()) ? format(dateObj, "MMM yyyy") : "";
      return transform(point, formattedDate, rawDate);
    })
    .sort((a, b) => {
      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
      const timeA = new Date((objA.timestamp ?? objA.date ?? 0) as string | number | Date).getTime();
      const timeB = new Date((objB.timestamp ?? objB.date ?? 0) as string | number | Date).getTime();
      return timeA - timeB;
    });
}

/**
 * React hook to memoize filtered and sorted historical metric chart points
 */
export function useMetricHistoryFilter<T extends MetricHistoryPoint, R>(
  data: T[] | undefined | null,
  timeRange: TimeRange,
  transform: (point: T, formattedDate: string, timestamp: string | number | Date) => R,
  maxPoints: number = 100
): R[] {
  return useMemo(() => {
    return filterAndSortHistory(data, timeRange, transform, maxPoints);
  }, [data, timeRange, transform, maxPoints]);
}
