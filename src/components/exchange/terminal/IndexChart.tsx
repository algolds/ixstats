"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "~/lib/exchange/terminal";

export const RANGES = ["1D", "1W", "1M", "All"] as const;
export type Range = (typeof RANGES)[number];
const RANGE_MS: Record<Range, number> = {
  "1D": 864e5,
  "1W": 7 * 864e5,
  "1M": 30 * 864e5,
  All: Infinity,
};

export const rangeOf = (value: string | null): Range => RANGES.find((r) => r === value) ?? "1W";

/** The points inside a time range, counted back from the last point. */
export function pointsIn(series: readonly SeriesPoint[], range: Range): SeriesPoint[] {
  const last = series.at(-1)?.t ?? 0;
  return series.filter((p) => last - p.t <= RANGE_MS[range]);
}

/** A line in the Exchange tint, with no grid: the price or index over time. */
export function IndexChart({
  series,
  height = 180,
}: {
  series: readonly SeriesPoint[];
  height?: number;
}) {
  if (series.length < 2) {
    return (
      <div className="text-footnote text-label-secondary flex items-center" style={{ height }}>
        The chart fills in as the market ticks.
      </div>
    );
  }
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="t" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            labelFormatter={(t) => (typeof t === "number" ? new Date(t).toLocaleString() : t)}
            formatter={(v) => [
              typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v,
              "Value",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--tint)"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
