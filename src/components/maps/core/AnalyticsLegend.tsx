"use client";

/**
 * AnalyticsLegend — Floating legend showing the active analytics overlay's
 * color scale and labels. Appears bottom-left when an overlay is active,
 * auto-hides when none are on.
 */

import type { OverlayVisibility } from "./IxWorldMap";

interface AnalyticsLegendProps {
  overlayVisibility: OverlayVisibility;
}

interface LegendConfig {
  title: string;
  type: "gradient" | "line-legend";
  stops?: { color: string; label: string }[];
  lines?: { color: string; style: string; label: string }[];
}

const LEGENDS: Record<string, LegendConfig> = {
  wealth: {
    title: "Wealth Map — GDP per Capita",
    type: "gradient",
    stops: [
      { color: "#94a3b8", label: "Low" },
      { color: "#6ee7b7", label: "" },
      { color: "#34d399", label: "Mid" },
      { color: "#fbbf24", label: "" },
      { color: "#f59e0b", label: "High" },
    ],
  },
  population: {
    title: "Population Density",
    type: "gradient",
    stops: [
      { color: "#e0f2fe", label: "Sparse" },
      { color: "#7dd3fc", label: "" },
      { color: "#6366f1", label: "Mid" },
      { color: "#a855f7", label: "" },
      { color: "#ec4899", label: "Dense" },
    ],
  },
  crises: {
    title: "Crisis Risk",
    type: "gradient",
    stops: [
      { color: "#22c55e", label: "Low" },
      { color: "#facc15", label: "Moderate" },
      { color: "#f97316", label: "Elevated" },
      { color: "#dc2626", label: "High" },
    ],
  },
  diplomacy: {
    title: "Diplomatic Relations",
    type: "line-legend",
    lines: [
      { color: "#22c55e", style: "solid", label: "Friendly" },
      { color: "#f59e0b", style: "dashed", label: "Neutral" },
      { color: "#ef4444", style: "solid", label: "Hostile" },
    ],
  },
  transport: {
    title: "Transport Network",
    type: "line-legend",
    lines: [
      { color: "#374151", style: "solid", label: "Rail" },
      { color: "#f97316", style: "solid", label: "Highway" },
      { color: "#92400e", style: "dashed", label: "Road" },
      { color: "#3b82f6", style: "dashed", label: "Shipping" },
    ],
  },
};

export function AnalyticsLegend({ overlayVisibility }: AnalyticsLegendProps) {
  // Find active overlay
  const activeKey = (["wealth", "population", "crises", "diplomacy", "transport"] as const).find(
    (k) => overlayVisibility[k]
  );

  if (!activeKey) return null;

  const legend = LEGENDS[activeKey];
  if (!legend) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 bg-card/95 ring-border/50 absolute bottom-6 left-3 z-10 rounded-lg px-3 py-2.5 shadow-lg ring-1 backdrop-blur-sm duration-200 sm:bottom-8">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {legend.title}
      </div>

      {legend.type === "gradient" && legend.stops && (
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
        </div>
      )}

      {legend.type === "line-legend" && legend.lines && (
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
