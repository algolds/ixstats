"use client";

import type { DiagnosticLegend, LegendStop } from "~/lib/worldgen/diagnostics";

const stopLabel = (stop: LegendStop): string => stop.label ?? String(stop.value);

/** A ramp's stops as a left-to-right gradient; a log scale spaces its stops evenly, a linear one by value. */
function gradientOf({ stops, domain: [low, high], scale }: DiagnosticLegend): string {
  const span = high - low;
  const at = (stop: LegendStop, index: number) =>
    scale === "linear" && span > 0
      ? ((stop.value - low) / span) * 100
      : (index / Math.max(1, stops.length - 1)) * 100;
  return `linear-gradient(to right, ${stops
    .map((stop, index) => `${stop.color} ${at(stop, index).toFixed(1)}%`)
    .join(", ")})`;
}

function Swatches({ stops }: { stops: readonly LegendStop[] }) {
  return (
    <ul className="text-footnote grid grid-cols-2 gap-x-3 gap-y-1">
      {stops.map((stop) => (
        <li key={`${stop.value}-${stop.color}`} className="flex items-center gap-2">
          <span
            aria-hidden
            className="border-separator size-3 shrink-0 rounded-sm border"
            style={{ backgroundColor: stop.color }}
          />
          <span className="min-w-0 truncate">{stopLabel(stop)}</span>
        </li>
      ))}
    </ul>
  );
}

/** What a diagnostic's colours mean, with the ends marked where values past them are drawn at that end's colour. */
export function StudioLegend({ legend }: { legend: DiagnosticLegend }) {
  const first = legend.stops[0];
  const last = legend.stops[legend.stops.length - 1];
  const ramp = legend.scale !== "bands" && legend.stops.length > 1 && first && last;
  const clipped = legend.clipped.low || legend.clipped.high;
  return (
    <figure aria-label={`${legend.title} legend`} className="space-y-2">
      <figcaption className="text-footnote">
        {legend.title}
        {legend.unit && <span className="text-label-secondary">, {legend.unit}</span>}
      </figcaption>
      {ramp ? (
        <>
          <div
            aria-hidden
            className="border-separator h-3 rounded-full border"
            style={{ backgroundImage: gradientOf(legend) }}
          />
          <div className="text-label-secondary text-caption flex justify-between gap-2 tabular-nums">
            <span>{stopLabel(first)}</span>
            <span>{stopLabel(last)}</span>
          </div>
        </>
      ) : (
        <Swatches stops={legend.stops} />
      )}
      {clipped && (
        <p className="text-label-secondary text-caption">
          Values past the ends are drawn at the colour of that end.
        </p>
      )}
    </figure>
  );
}
