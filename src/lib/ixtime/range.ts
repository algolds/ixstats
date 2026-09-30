import { IxTime } from "./core";

/**
 * IxTime-aware range helper for metric trend charts.
 * Uses game-year arithmetic, not real-wall 30-day months.
 */
import type { TimeRange } from "~/types/ixtime";

export const TIME_RANGE_TO_MONTHS: Record<TimeRange, number> = {
  "3m": 3,
  "6m": 6,
  "1y": 12,
  "2y": 24,
  "4y": 48,
  "5y": 60,
  "20y": 240,
  all: Infinity,
};

/**
 * Returns IxTime ms cutoff for the given range. Infinity => 0 (epoch).
 * Uses IxTime.addMonths so cutoff tracks game calendar, not real wall time.
 */
export function getIxCutoff(range: TimeRange, nowIxTime: number): number {
  if (range === "all") return 0;
  const months = TIME_RANGE_TO_MONTHS[range];
  if (!months || months === Infinity) return 0;
  // IxTime.addMonths correctly handles year wrap
  const cutoff = IxTime.addMonths(nowIxTime, -months);
  return cutoff;
}

/**
 * Filter historical points by IxTime cutoff.
 * Points must have ixTimeTimestamp (Date|number).
 */
export function filterByIxRange<T extends { ixTimeTimestamp: Date | number | string }>(
  data: T[],
  range: TimeRange,
  nowIxTime: number = IxTime.getCurrentIxTime()
): T[] {
  if (range === "all") return data;
  const cutoff = getIxCutoff(range, nowIxTime);
  return data.filter((p) => {
    const ts = IxTime.toTimestamp(p.ixTimeTimestamp as any);
    return ts !== null && ts >= cutoff;
  });
}
