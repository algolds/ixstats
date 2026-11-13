"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "~/lib/exchange/terminal";
import { formatSovereignFigure } from "./brand";

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

/** A custom Facet overlay tooltip for Recharts so dark/light themes and glass elevation hold. */
function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = "",
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
  label?: number | string;
  valuePrefix?: string;
}) {
  const point = payload?.[0]?.value;
  if (!active || typeof point !== "number") return null;
  const timeLabel =
    typeof label === "number" ? new Date(label).toLocaleString() : String(label ?? "");
  return (
    <div className="facet-overlay rounded-control px-3 py-2 text-footnote tabular-nums">
      <p className="text-caption text-label-secondary">{timeLabel}</p>
      <p className="text-callout text-label font-semibold">
        {valuePrefix}
        {point.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

/** A line in the Exchange tint inside a recessed stage: the price or index over time. */
export function IndexChart({
  series,
  height = 180,
  valuePrefix = "",
}: {
  series: readonly SeriesPoint[];
  height?: number;
  valuePrefix?: string;
}) {
  if (series.length < 2) {
    return (
      <div
        className="facet-well rounded-row text-footnote text-label-secondary relative flex flex-col justify-between overflow-hidden px-4 py-3"
        style={{ height }}
      >
        <div
          aria-hidden
          className="border-separator pointer-events-none absolute inset-x-4 top-1/2 border-t border-dashed"
        />
        <span className="text-caption text-label-tertiary font-mono">Awaiting tick telemetry</span>
        <span className="relative">The chart fills in as the market ticks.</span>
      </div>
    );
  }

  let low = series[0]!.value;
  let high = series[0]!.value;
  for (const pt of series) {
    if (pt.value < low) low = pt.value;
    if (pt.value > high) high = pt.value;
  }

  return (
    <div className="facet-well rounded-row space-y-2 p-3">
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 6, bottom: 4, left: 6 }}>
            <XAxis dataKey="t" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip content={<ChartTooltip valuePrefix={valuePrefix} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--tint)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "var(--tint)", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="border-separator text-caption text-label-secondary flex flex-wrap items-center justify-between gap-2 border-t pt-2 font-mono tabular-nums">
        <span>
          Low {valuePrefix}
          {formatSovereignFigure(low)}
        </span>
        <span>{series.length} pts</span>
        <span>
          High {valuePrefix}
          {formatSovereignFigure(high)}
        </span>
      </div>
    </div>
  );
}
