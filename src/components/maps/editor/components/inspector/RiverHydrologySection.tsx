"use client";

import React, { useMemo } from "react";
import {
  SeaWaves as Waves,
  NavArrowRight as ArrowRight,
  Compass,
  ModernTv as Mountain,
} from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { polylineLengthKm, polylineLengthMi, bearing, compassDirection } from "~/lib/maps/geo-math";
import { api } from "~/trpc/react";

interface RiverHydrologySectionProps {
  feature: EditorFeature;
}

function extractLineCoordinates(geom: unknown): [number, number][] {
  if (!geom || typeof geom !== "object") return [];
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === "LineString" && Array.isArray(g.coordinates)) {
    return g.coordinates as [number, number][];
  }
  if (
    g.type === "MultiLineString" &&
    Array.isArray(g.coordinates) &&
    Array.isArray(g.coordinates[0])
  ) {
    const list: [number, number][] = [];
    for (const line of g.coordinates as [number, number][][]) {
      list.push(...line);
    }
    return list;
  }
  return [];
}

export const RiverHydrologySection = React.memo(function RiverHydrologySection({
  feature,
}: RiverHydrologySectionProps) {
  const coords = useMemo(() => {
    const fromGeom = extractLineCoordinates(feature.geometry);
    if (fromGeom.length > 0) return fromGeom;
    if (feature.coordinates && feature.coordinates[0] !== 0) {
      return [feature.coordinates];
    }
    return [];
  }, [feature.geometry, feature.coordinates]);

  const source = coords[0] ?? null;
  const mouth = coords.length > 1 ? coords[coords.length - 1]! : null;

  const lengthKm = useMemo(() => {
    if (coords.length >= 2) return polylineLengthKm(coords);
    if (typeof feature.properties?.lengthKm === "number") return feature.properties.lengthKm;
    return null;
  }, [coords, feature.properties?.lengthKm]);

  const lengthMi = lengthKm != null ? polylineLengthMi(coords.length >= 2 ? coords : [[0, 0], [0, 0]]) || (lengthKm / 1.60934) : null;

  // Sample terrain elevation at river source and mouth
  const sourceSample = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: source?.[0] ?? 0, lat: source?.[1] ?? 0 },
    { enabled: !!source && (source[0] !== 0 || source[1] !== 0) }
  );

  const mouthSample = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: mouth?.[0] ?? 0, lat: mouth?.[1] ?? 0 },
    { enabled: !!mouth && (mouth[0] !== 0 || mouth[1] !== 0) }
  );

  const sourceElev = sourceSample.data?.midpoint ?? null;
  const mouthElev = mouthSample.data?.midpoint ?? null;
  const elevDropM =
    sourceElev != null && mouthElev != null ? Math.max(0, sourceElev - mouthElev) : null;
  const gradientMPerKm =
    elevDropM != null && lengthKm && lengthKm > 0 ? elevDropM / lengthKm : null;

  const flowRegime = useMemo(() => {
    if (gradientMPerKm == null) return null;
    if (gradientMPerKm >= 15) return { label: "High Alpine / Torrential", tone: "text-amber-500" };
    if (gradientMPerKm >= 5) return { label: "Upland / Rapid Flow", tone: "text-cyan-500" };
    if (gradientMPerKm >= 1.5) return { label: "Valley / Moderate Run", tone: "text-blue-500" };
    return { label: "Lowland / Meandering", tone: "text-emerald-500" };
  }, [gradientMPerKm]);

  const courseDirection = useMemo(() => {
    if (!source || !mouth || coords.length < 2) return null;
    const b = bearing(source, mouth);
    return `${compassDirection(b)} (${Math.round(b)}°)`;
  }, [source, mouth, coords.length]);

  return (
    <div className="space-y-2.5">
      {/* Primary River Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
          <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
            Course length
          </span>
          <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
            <span className="text-foreground font-mono text-sm font-semibold tabular-nums tracking-tight truncate">
              {lengthKm != null ? Math.round(lengthKm).toLocaleString() : "—"}
            </span>
            {lengthKm != null && (
              <span className="text-muted-foreground/80 font-sans text-[11px] font-normal shrink-0">
                km
              </span>
            )}
          </div>
          {lengthMi != null && (
            <span className="text-muted-foreground/60 font-mono text-[10px] tabular-nums block mt-0.5">
              ~{Math.round(lengthMi).toLocaleString()} mi
            </span>
          )}
        </div>

        <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
          <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
            Course geometry
          </span>
          <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
            <span className="text-foreground font-mono text-sm font-semibold tabular-nums tracking-tight truncate">
              {coords.length.toLocaleString()}
            </span>
            <span className="text-muted-foreground/80 font-sans text-[11px] font-normal shrink-0">
              nodes
            </span>
          </div>
          {courseDirection && (
            <div className="text-muted-foreground/80 flex items-center gap-1 text-[10px] mt-0.5">
              <Compass className="h-3 w-3 text-cyan-500 shrink-0" />
              <span className="truncate">{courseDirection}</span>
            </div>
          )}
        </div>
      </div>

      {/* Headwaters & Mouth Limnology */}
      <div className="border-border/40 bg-card/40 space-y-2 rounded-lg border p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Waves className="h-3.5 w-3.5 text-cyan-500" />
            <span className="text-muted-foreground/70 text-[9px] font-semibold uppercase tracking-wider">
              Hydrological Profile
            </span>
          </div>
          {(sourceSample.isLoading || mouthSample.isLoading) && (
            <div className="border-muted-foreground/20 border-t-cyan-500 h-2.5 w-2.5 animate-spin rounded-full border-2" />
          )}
        </div>

        {/* Source vs Mouth comparison */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="border-border/30 bg-muted/20 space-y-1 rounded p-2 min-w-0">
            <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block">
              Headwaters (Source)
            </span>
            <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {sourceElev != null ? `${sourceElev.toLocaleString()} m` : "—"}
            </p>
            <span className="text-muted-foreground/80 text-[10px] block truncate">
              {sourceSample.data?.zoneName || (source ? "Highland" : "No source")}
            </span>
            {source && (
              <span className="text-muted-foreground/50 font-mono text-[9px] block truncate tabular-nums">
                {source[1].toFixed(2)}°, {source[0].toFixed(2)}°
              </span>
            )}
          </div>

          <div className="border-border/30 bg-muted/20 space-y-1 rounded p-2 min-w-0">
            <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block">
              Terminus (Mouth)
            </span>
            <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {mouthElev != null ? `${mouthElev.toLocaleString()} m` : "—"}
            </p>
            <span className="text-muted-foreground/80 text-[10px] block truncate">
              {mouthSample.data?.zoneName || (mouth ? "Coastal / Lowland" : "No terminus")}
            </span>
            {mouth && (
              <span className="text-muted-foreground/50 font-mono text-[9px] block truncate tabular-nums">
                {mouth[1].toFixed(2)}°, {mouth[0].toFixed(2)}°
              </span>
            )}
          </div>
        </div>

        {/* Elevation Drop & Gradient */}
        <div className="border-border/30 bg-muted/20 space-y-1.5 rounded p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Total drop</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {elevDropM != null ? `${elevDropM.toLocaleString()} m` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Mean gradient</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {gradientMPerKm != null ? `${gradientMPerKm.toFixed(1)} m/km` : "—"}
            </span>
          </div>

          {flowRegime && (
            <div className="flex items-center justify-between text-[10px] pt-0.5 border-border/20 border-t">
              <span className="text-muted-foreground">Flow regime</span>
              <span className={`font-medium ${flowRegime.tone}`}>{flowRegime.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
