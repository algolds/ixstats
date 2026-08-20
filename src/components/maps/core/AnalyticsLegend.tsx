"use client";

/**
 * AnalyticsLegend — Floating legend showing the active analytics overlay's
 * color scale and labels. Appears bottom-left when an overlay is active,
 * auto-hides when none are on.
 *
 * Legends are sourced from the overlay registry (`~/lib/maps/overlay-registry/) so a
 * new overlay's legend ships with its registry entry — no edits here required.
 */

import { OVERLAY_LIST } from "~/lib/maps/overlay-registry";
import type { OverlayLegend } from "~/lib/maps/overlay-types";
import type { OverlayVisibility } from "./IxWorldMap";

interface AnalyticsLegendProps {
  overlayVisibility: OverlayVisibility;
}

export function AnalyticsLegend({ overlayVisibility }: AnalyticsLegendProps) {
  // First visible overlay (in registry order) that declares a legend.
  const active = OVERLAY_LIST.find((o) => o.legend && overlayVisibility[o.id]);
  if (!active?.legend) return null;

  const legend: OverlayLegend = active.legend;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="animate-in fade-in slide-in-from-bottom-2 bg-card/95 ring-border/50 absolute bottom-6 left-3 z-10 rounded-lg px-3 py-2.5 shadow-lg ring-1 backdrop-blur-sm duration-200 sm:bottom-8"
    >
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {legend.title}
      </div>

      {legend.type === "gradient" && (
        <div className="mt-1.5">
          {/* Gradient bar */}
          <div
            className="h-2.5 w-full rounded-full"
            style={{
              background: `linear-gradient(to right, ${legend.stops.map((s) => s.color).join(", ")})`,
            }}
          />
          {/* Labels below gradient */}
          <div className="mt-0.5 flex justify-between">
            {legend.stops
              .filter((s) => s.label)
              .map((s, i) => (
                <span key={i} className="text-muted-foreground text-[9px]">
                  {s.label}
                </span>
              ))}
          </div>
          {/* Data-status note (e.g. "all-zero on a fresh DB"). Rendered only when
              the registry entry set one; intent is to explain "I toggled the
              overlay and nothing recolored" without users having to read the
              data model. */}
          {"note" in legend && legend.note && (
            <p className="text-muted-foreground/70 mt-1 text-[9px] leading-snug italic">
              {legend.note}
            </p>
          )}
        </div>
      )}

      {legend.type === "line-legend" && (
        <div className="mt-1.5 space-y-1">
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
              <span className="text-foreground/80 text-[10px]">{line.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
