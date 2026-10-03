"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { formatBig } from "~/app/countries/[slug]/_utils/profileLayer";

const W = 320;
const H = 96;
const PAD_X = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;

/**
 * EconomyTrend — total GDP over the engine's model history as one thin line,
 * with a crosshair tooltip on hover/focus and a screen-reader table. Single series, so no
 * legend: the caption names it. Renders nothing with fewer than two points.
 */
export function EconomyTrend({
  points,
  className,
  caption = "Total GDP, model history",
}: {
  points: readonly { year: number; gdp: number }[];
  className?: string;
  caption?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.gdp);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max || 1;
    const x = (i: number) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
    const coords = points.map((p, i) => ({ x: x(i), y: y(p.gdp) }));
    const line = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    return { coords, line };
  }, [points]);

  if (!geometry) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const active = hover != null ? points[hover] : null;
  const activeCoord = hover != null ? geometry.coords[hover] : null;

  const pick = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <figcaption
        id={`${id}-caption`}
        className="text-footnote text-label-secondary flex items-baseline justify-between gap-2"
      >
        <span>{caption}</span>
        <span className="tabular-nums">
          {first.year}–{last.year}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-24 w-full overflow-visible"
          role="img"
          aria-labelledby={`${id}-caption`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(points.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length - 1) - 1));
            if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? 0) + 1));
          }}
        >
          <line
            x1={0}
            x2={W}
            y1={H - PAD_BOTTOM}
            y2={H - PAD_BOTTOM}
            className="stroke-separator"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={geometry.line}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {activeCoord && (
            <line
              x1={activeCoord.x}
              x2={activeCoord.x}
              y1={0}
              y2={H}
              className="stroke-separator-opaque"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {active && activeCoord && (
          <div
            aria-hidden
            className="bg-surface-elevated border-separator shadow-floating rounded-control-sm pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full border px-2 py-1 whitespace-nowrap"
            style={{ left: `${(activeCoord.x / W) * 100}%` }}
          >
            <span className="text-caption text-label-secondary tabular-nums">{active.year}</span>{" "}
            <span className="text-caption text-label tabular-nums">
              {formatBig(active.gdp, { currency: true })}
            </span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Total GDP</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.year}>
              <td>{p.year}</td>
              <td>{formatBig(p.gdp, { currency: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
