"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Droplet, SeaWaves as Waves } from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { geometryAreaSqKm, geometryAreaSqMi, ringPerimeterKm } from "~/lib/maps/geo-math";
import { calculateSimpleCentroid } from "~/lib/maps/map-utils";
import { api } from "~/trpc/react";
import type { Geometry } from "geojson";

interface LakeHydrologySectionProps {
  feature: EditorFeature;
  onUpdateFeature?: (
    updates: Record<string, string | number | boolean | null | undefined | object>
  ) => Promise<void> | void;
}

function extractPolygonGeometry(geom: unknown): {
  type: string;
  coordinates: number[][][] | number[][][][];
} | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if ((g.type === "Polygon" || g.type === "MultiPolygon") && Array.isArray(g.coordinates)) {
    return g as { type: string; coordinates: number[][][] | number[][][][] };
  }
  return null;
}

export const LakeHydrologySection = React.memo(function LakeHydrologySection({
  feature,
  onUpdateFeature,
}: LakeHydrologySectionProps) {
  const polyGeom = useMemo(() => extractPolygonGeometry(feature.geometry), [feature.geometry]);

  // Surface Area
  const areaKm2 = useMemo(() => {
    if (polyGeom) return geometryAreaSqKm(polyGeom);
    if (typeof feature.properties?.areaSqKm === "number") return feature.properties.areaSqKm;
    return null;
  }, [polyGeom, feature.properties?.areaSqKm]);

  const areaSqMi =
    areaKm2 != null ? (polyGeom ? geometryAreaSqMi(polyGeom) : areaKm2 / 2.58999) : null;

  // Shoreline Perimeter
  const perimeterKm = useMemo(() => {
    if (!polyGeom) return null;
    if (polyGeom.type === "Polygon") {
      const rings = polyGeom.coordinates as [number, number][][];
      return rings[0] ? ringPerimeterKm(rings[0]) : null;
    }
    if (polyGeom.type === "MultiPolygon") {
      const polys = polyGeom.coordinates as [number, number][][][];
      return polys.reduce((acc, poly) => acc + (poly[0] ? ringPerimeterKm(poly[0]) : 0), 0);
    }
    return null;
  }, [polyGeom]);

  // Shoreline Development Index (SDI, Dl = L / (2 * sqrt(pi * A)))
  // Dl = 1.0 is a perfect circle. > 2.0 indicates complex dendritic or fjord morphology.
  const sdi = useMemo(() => {
    if (!perimeterKm || !areaKm2 || areaKm2 <= 0) return null;
    const circularPerimeter = 2 * Math.sqrt(Math.PI * areaKm2);
    return circularPerimeter > 0 ? perimeterKm / circularPerimeter : null;
  }, [perimeterKm, areaKm2]);

  const morphologyLabel = useMemo(() => {
    if (sdi == null) return null;
    if (sdi >= 2.5) return { label: "Fjord / High Dendritic", tone: "text-amber-500" };
    if (sdi >= 1.6) return { label: "Embayed / Irregular", tone: "text-cyan-500" };
    return { label: "Sub-circular / Compact", tone: "text-emerald-500" };
  }, [sdi]);

  // Centroid & Surface Elevation
  const centroid = useMemo(() => {
    if (polyGeom) return calculateSimpleCentroid(polyGeom as unknown as Geometry);
    return feature.coordinates ?? null;
  }, [polyGeom, feature.coordinates]);

  const surfaceSample = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: centroid?.[0] ?? 0, lat: centroid?.[1] ?? 0 },
    { enabled: !!centroid && (centroid[0] !== 0 || centroid[1] !== 0) }
  );

  const surfaceElev = surfaceSample.data?.midpoint ?? null;

  // Max Depth and Volume
  const rawDepth = feature.properties?.maxDepthM;
  const initialDepth = typeof rawDepth === "number" ? String(rawDepth) : "";
  const [depthInput, setDepthInput] = useState(initialDepth);

  useEffect(() => {
    const current =
      typeof feature.properties?.maxDepthM === "number" ? String(feature.properties.maxDepthM) : "";
    setDepthInput(current);
  }, [feature.properties?.maxDepthM]);

  const handleDepthBlur = useCallback(() => {
    const parsed = parseFloat(depthInput);
    const valid = !isNaN(parsed) && parsed > 0 ? parsed : null;
    const current =
      typeof feature.properties?.maxDepthM === "number" ? feature.properties.maxDepthM : null;
    if (valid !== current && onUpdateFeature) {
      void onUpdateFeature({ maxDepthM: valid });
    }
  }, [depthInput, feature.properties?.maxDepthM, onUpdateFeature]);

  const parsedDepthM =
    parseFloat(depthInput) ||
    (typeof feature.properties?.maxDepthM === "number" ? feature.properties.maxDepthM : null);

  // Volume estimate: Mean depth ≈ 0.4 * Max depth (canonical for natural lakes)
  const volumeKm3 = useMemo(() => {
    if (!areaKm2 || !parsedDepthM || parsedDepthM <= 0) return null;
    const meanDepthKm = (parsedDepthM * 0.4) / 1000;
    return areaKm2 * meanDepthKm;
  }, [areaKm2, parsedDepthM]);

  return (
    <div className="space-y-2.5">
      {/* Primary Lake Surface Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <FacetCard surface="solid" className="min-w-0 rounded-lg p-2">
          <Eyebrow className="block truncate">Surface area</Eyebrow>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
            <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
              {areaKm2 != null ? Math.round(areaKm2).toLocaleString() : "—"}
            </span>
            {areaKm2 != null && (
              <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
                km²
              </span>
            )}
          </div>
          {areaSqMi != null && (
            <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
              ~{Math.round(areaSqMi).toLocaleString()} sq mi
            </span>
          )}
        </FacetCard>

        <FacetCard surface="solid" className="min-w-0 rounded-lg p-2">
          <Eyebrow className="block truncate">Shoreline perimeter</Eyebrow>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
            <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
              {perimeterKm != null ? Math.round(perimeterKm).toLocaleString() : "—"}
            </span>
            {perimeterKm != null && (
              <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
                km
              </span>
            )}
          </div>
          {sdi != null && (
            <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
              SDI: {sdi.toFixed(2)}
            </span>
          )}
        </FacetCard>
      </div>

      {/* Limnology & Bathymetry */}
      <FacetCard surface="solid" className="space-y-2 rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Droplet className="h-3.5 w-3.5 text-blue-500" />
            <Eyebrow>Limnology & Bathymetry</Eyebrow>
          </div>
          {surfaceSample.isLoading && (
            <div className="border-muted-foreground/20 h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-blue-500" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border-border/30 bg-muted/20 min-w-0 space-y-1 rounded p-2">
            <Eyebrow className="block">Surface elevation</Eyebrow>
            <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {surfaceElev != null ? `${surfaceElev.toLocaleString()} m` : "—"}
            </p>
            <span className="text-muted-foreground block truncate text-xs">
              {surfaceSample.data?.zoneName || "Inland water"}
            </span>
          </div>

          <div className="border-border/30 bg-muted/20 min-w-0 space-y-1 rounded p-2">
            <Eyebrow className="block">Max depth</Eyebrow>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={depthInput}
                onChange={(e) => setDepthInput(e.target.value)}
                onBlur={handleDepthBlur}
                placeholder="Auto"
                className="border-border/60 bg-background text-foreground focus:border-primary w-16 rounded px-1.5 py-0.5 font-mono text-xs tabular-nums focus:outline-none"
              />
              <span className="text-muted-foreground text-xs">m</span>
            </div>
            <span className="text-muted-foreground block text-xs">
              Mean: ~{parsedDepthM ? Math.round(parsedDepthM * 0.4) : "—"} m
            </span>
          </div>
        </div>

        {/* Volume & Morphology */}
        <div className="border-border/30 bg-muted/20 space-y-1.5 rounded p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Est. water volume</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {volumeKm3 != null
                ? volumeKm3 >= 1.0
                  ? `${volumeKm3.toFixed(2)} km³`
                  : `${(volumeKm3 * 1000).toFixed(1)} M m³`
                : "—"}
            </span>
          </div>

          {morphologyLabel && (
            <div className="border-border/20 flex items-center justify-between border-t pt-0.5 text-xs">
              <span className="text-muted-foreground">Shore morphology</span>
              <span className={`font-medium ${morphologyLabel.tone}`}>{morphologyLabel.label}</span>
            </div>
          )}
        </div>
      </FacetCard>
    </div>
  );
});
