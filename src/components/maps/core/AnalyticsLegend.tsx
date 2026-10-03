"use client";

/**
 * AnalyticsLegend — Legend showing the active analytics overlay's color scale and labels.
 * Rendered inside MapContainer's bottom-left stack when an overlay is active; auto-hides
 * when none are on, and says "Loading…" until the overlay's data has arrived.
 *
 * Legends are sourced from the overlay registry (`~/lib/maps/overlay-registry/) so a
 * new overlay's legend ships with its registry entry — no edits here required.
 */

import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetMaterial } from "~/components/ui/facet";
import { OVERLAY_LIST } from "~/lib/maps/overlay-registry";
import type { OverlayLegend } from "~/lib/maps/overlay-types";
import type { OverlayVisibility } from "./IxWorldMap";

interface AnalyticsLegendProps {
  overlayVisibility: OverlayVisibility;
  /** Loaded overlay data keyed by overlay id; a missing entry means it is still loading. */
  overlayData?: Record<string, unknown>;
}

export function AnalyticsLegend({ overlayVisibility, overlayData }: AnalyticsLegendProps) {
  // First visible overlay (in registry order) that declares a legend.
  const active = OVERLAY_LIST.find((o) => o.legend && overlayVisibility[o.id]);
  if (!active?.legend) return null;

  const legend: OverlayLegend = active.legend;
  const isLoading = !!overlayData && active.renderProps && overlayData[active.id] == null;

  return (
    <FacetMaterial
      material="regular"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      role="status"
      aria-live="polite"
      className="animate-in fade-in slide-in-from-bottom-2 rounded-row pointer-events-auto max-w-[16rem] px-3 py-2 duration-200"
    >
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{legend.title}</Eyebrow>
        {isLoading && <span className="text-label-secondary text-footnote">Loading…</span>}
      </div>

      {legend.type === "gradient" && (
        <div className="mt-2">
          <div
            className="h-2.5 w-full rounded-full"
            style={{
              background: `linear-gradient(to right, ${legend.stops.map((s) => s.color).join(", ")})`,
            }}
          />
          <div className="mt-0.5 flex justify-between">
            {legend.stops
              .filter((s) => s.label)
              .map((s, i) => (
                <span key={i} className="text-label-secondary text-footnote">
                  {s.label}
                </span>
              ))}
          </div>
          {/* Data-status note (e.g. "all-zero on a fresh DB"). Rendered only when
              the registry entry set one; intent is to explain "I toggled the
              overlay and nothing recolored" without users having to read the
              data model. */}
          {"note" in legend && legend.note && (
            <p className="text-label-secondary text-footnote mt-1 leading-snug italic">
              {legend.note}
            </p>
          )}
        </div>
      )}

      {legend.type === "line-legend" && (
        <div className="mt-2 space-y-1">
          {legend.lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="h-0.5 w-5 rounded-full"
                style={{
                  backgroundColor: line.color,
                  borderStyle: line.style === "dashed" ? "dashed" : undefined,
                  borderTopWidth: line.style === "dashed" ? "2px" : undefined,
                  borderColor: line.style === "dashed" ? line.color : undefined,
                  height: line.style === "dashed" ? 0 : undefined,
                }}
              />
              <span className="text-label text-footnote">{line.label}</span>
            </div>
          ))}
        </div>
      )}
    </FacetMaterial>
  );
}
