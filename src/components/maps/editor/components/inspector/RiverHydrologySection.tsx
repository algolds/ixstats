"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
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

  const lengthMi =
    lengthKm != null
      ? polylineLengthMi(
          coords.length >= 2
            ? coords
            : [
                [0, 0],
                [0, 0],
              ]
        ) || lengthKm / 1.60934
      : null;

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
        <FacetCard surface="solid" className="min-w-0 rounded-lg p-2">
          <Eyebrow className="block truncate">Course length</Eyebrow>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
            <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
              {lengthKm != null ? Math.round(lengthKm).toLocaleString() : "—"}
            </span>
            {lengthKm != null && (
              <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
                km
              </span>
            )}
          </div>
          {lengthMi != null && (
            <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
              ~{Math.round(lengthMi).toLocaleString()} mi
            </span>
          )}
        </FacetCard>

        <FacetCard surface="solid" className="min-w-0 rounded-lg p-2">
          <Eyebrow className="block truncate">Course geometry</Eyebrow>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
            <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
              {coords.length.toLocaleString()}
            </span>
            <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
              nodes
            </span>
          </div>
          {courseDirection && (
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <Compass className="h-3 w-3 shrink-0 text-cyan-500" />
              <span className="truncate">{courseDirection}</span>
            </div>
          )}
        </FacetCard>
      </div>

      {/* Headwaters & Mouth Limnology */}
      <FacetCard surface="solid" className="space-y-2 rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Waves className="h-3.5 w-3.5 text-cyan-500" />
            <Eyebrow>Hydrological Profile</Eyebrow>
          </div>
          {(sourceSample.isLoading || mouthSample.isLoading) && (
            <div className="border-muted-foreground/20 h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-cyan-500" />
          )}
        </div>

        {/* Source vs Mouth comparison */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border-border/30 bg-muted/20 min-w-0 space-y-1 rounded p-2">
            <Eyebrow className="block">Headwaters (Source)</Eyebrow>
            <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {sourceElev != null ? `${sourceElev.toLocaleString()} m` : "—"}
            </p>
            <span className="text-muted-foreground block truncate text-xs">
              {sourceSample.data?.zoneName || (source ? "Highland" : "No source")}
            </span>
            {source && (
              <span className="text-muted-foreground/50 block truncate font-mono text-xs tabular-nums">
                {source[1].toFixed(2)}°, {source[0].toFixed(2)}°
              </span>
            )}
          </div>

          <div className="border-border/30 bg-muted/20 min-w-0 space-y-1 rounded p-2">
            <Eyebrow className="block">Terminus (Mouth)</Eyebrow>
            <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {mouthElev != null ? `${mouthElev.toLocaleString()} m` : "—"}
            </p>
            <span className="text-muted-foreground block truncate text-xs">
              {mouthSample.data?.zoneName || (mouth ? "Coastal / Lowland" : "No terminus")}
            </span>
            {mouth && (
              <span className="text-muted-foreground/50 block truncate font-mono text-xs tabular-nums">
                {mouth[1].toFixed(2)}°, {mouth[0].toFixed(2)}°
              </span>
            )}
          </div>
        </div>

        {/* Elevation Drop & Gradient */}
        <div className="border-border/30 bg-muted/20 space-y-1.5 rounded p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total drop</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {elevDropM != null ? `${elevDropM.toLocaleString()} m` : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Mean gradient</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {gradientMPerKm != null ? `${gradientMPerKm.toFixed(1)} m/km` : "—"}
            </span>
          </div>

          {flowRegime && (
            <div className="border-border/20 flex items-center justify-between border-t pt-0.5 text-xs">
              <span className="text-muted-foreground">Flow regime</span>
              <span className={`font-medium ${flowRegime.tone}`}>{flowRegime.label}</span>
            </div>
          )}
        </div>
      </FacetCard>
    </div>
  );
});
