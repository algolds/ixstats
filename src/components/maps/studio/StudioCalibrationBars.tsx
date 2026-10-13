"use client";

import { percent } from "~/lib/worldgen/calibration-format";
import type { RealmFigures } from "~/hooks/useStudioCalibration";

/** One bar per source in a bar group: the world first, then each realm that has figures. */
export interface BarSeries {
  key: string;
  name: string;
  /** Tailwind background token for the bar */
  tone: string;
  /** One share (0-1) per row */
  shares: readonly number[];
}

/** The tone of each column: the world is the tint, the realms step down through the label greys. */
export const SERIES_TONES = ["bg-tint", "bg-label-secondary", "bg-label-tertiary"] as const;

/** The series a bar group draws: the world's shares and those of every realm that was measured. */
export function barSeries(
  world: readonly number[],
  columns: readonly RealmFigures[],
  sharesOf: (measures: Extract<RealmFigures, { state: "ready" }>["measures"]) => readonly number[]
): BarSeries[] {
  const realms = columns.flatMap((column) =>
    column.state === "ready" ? [{ name: column.name, shares: sharesOf(column.measures) }] : []
  );
  return [{ name: "World", shares: world }, ...realms].map((series, index) => ({
    ...series,
    key: `${index}:${series.name}`,
    tone: SERIES_TONES[index] ?? SERIES_TONES[2],
  }));
}

interface StudioCalibrationBarsProps {
  title: string;
  labels: readonly string[];
  series: readonly BarSeries[];
}

/**
 * A compact bar comparison: a row per label (a height zone, a climate group) with one thin bar per source, all on the
 * scale of the largest share in the group so the bars compare.
 */
export function StudioCalibrationBars({ title, labels, series }: StudioCalibrationBarsProps) {
  const scale = Math.max(0.01, ...series.flatMap((s) => s.shares));
  return (
    <section aria-label={title} className="space-y-2">
      <h4 className="text-footnote font-medium">{title}</h4>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={`${title} sources`}>
        {series.map((s) => (
          <li key={s.key} className="text-label-secondary text-caption flex items-center gap-1">
            <span aria-hidden className={`size-2 rounded-full ${s.tone}`} />
            {s.name}
          </li>
        ))}
      </ul>
      <ul className="space-y-2">
        {labels.map((label, row) => (
          <li
            key={label}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-2"
            aria-label={`${label}: ${series.map((s) => `${s.name} ${percent(s.shares[row] ?? 0)}`).join(", ")}`}
          >
            <span className="text-label-secondary text-caption truncate pt-px" title={label}>
              {label}
            </span>
            <div aria-hidden className="space-y-0.5">
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="bg-fill-4 h-1.5 min-w-0 flex-1 rounded-full">
                    <div
                      className={`h-full rounded-full ${s.tone}`}
                      style={{ width: `${((s.shares[row] ?? 0) / scale) * 100}%` }}
                    />
                  </div>
                  <span className="text-label-secondary text-caption w-11 text-right tabular-nums">
                    {percent(s.shares[row] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
