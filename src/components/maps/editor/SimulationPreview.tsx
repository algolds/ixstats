"use client";

/**
 * SimulationPreview — Shows predicted impact of geographic changes.
 *
 * Displays before/after values for key economic modifiers when
 * a geography change is pending. Uses the existing geo-analytics
 * engine to compute hypothetical impacts without committing.
 */

import { Activity } from "lucide-react";
import { api } from "~/trpc/react";

interface SimulationPreviewProps {
  countryId: string;
  /** Whether to show the preview (e.g., only when changes pending) */
  visible: boolean;
}

export function SimulationPreview({ countryId, visible }: SimulationPreviewProps) {
  const { data: profile } = api.geo.getCountryGeoProfile.useQuery(
    { countryId },
    { enabled: visible, staleTime: 60_000 }
  );

  const { data: transportStats } = api.transport.getTransportStats.useQuery(
    { countryId },
    { enabled: visible, staleTime: 60_000 }
  );

  if (!visible || !profile) return null;

  const metrics = [
    {
      label: "GDP Modifier",
      value: profile.economic.gdpModifier,
      format: (v: number) => `×${v.toFixed(2)}`,
      good: (v: number) => v >= 1,
    },
    {
      label: "Trade Modifier",
      value: profile.economic.tradeModifier,
      format: (v: number) => `×${v.toFixed(2)}`,
      good: (v: number) => v >= 1,
    },
    {
      label: "Infra Cost",
      value: profile.economic.infraCostModifier,
      format: (v: number) => `×${v.toFixed(2)}`,
      good: (v: number) => v <= 1,
    },
    {
      label: "Coastline",
      value: profile.derived.coastlineKm,
      format: (v: number) => `${v.toLocaleString()} km`,
      good: () => true,
    },
    {
      label: "Neighbors",
      value: profile.derived.neighborCount,
      format: (v: number) => String(v),
      good: () => true,
    },
    {
      label: "Arable Land",
      value: profile.derived.arableLandPercent,
      format: (v: number) => `${v}%`,
      good: (v: number) => v > 30,
    },
  ];

  return (
    <div className="border-border bg-card/50 border-t p-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
        <Activity className="h-3 w-3" />
        Geographic Profile
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {metrics.map((m) => {
          const isGood = m.good(m.value);
          return (
            <div key={m.label} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{m.label}</span>
              <span
                className={`font-medium tabular-nums ${isGood ? "text-emerald-600" : "text-amber-600"}`}
              >
                {m.format(m.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Transport stats */}
      {transportStats && transportStats.totalRoutes > 0 && (
        <div className="border-border mt-2 border-t pt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Transport Routes</span>
            <span className="text-foreground font-medium tabular-nums">
              {transportStats.totalRoutes}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Network Length</span>
            <span className="text-foreground font-medium tabular-nums">
              {transportStats.totalKm.toLocaleString()} km
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
