"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useMemo, useState } from "react";
import { Droplet } from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { geometryAreaSqKm, geometryAreaSqMi, ringPerimeterKm } from "~/lib/maps/geo-math";
import { calculateSimpleCentroid } from "~/lib/maps/map-utils";
import { api } from "~/trpc/react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import type { Geometry } from "geojson";
import { Card } from "~/components/ui/card";
import { MetricCard, ReadoutRow, ReadoutTile } from "./InspectorPrimitives";

interface LakeHydrologySectionProps {
  feature: EditorFeature;
  onUpdateFeature?: (
    updates: Record<string, string | number | boolean | null | undefined | object>
  ) => Promise<void> | void;
}

type PolygonGeometry = { type: string; coordinates: number[][][] | number[][][][] };

type Ring = [number, number][];

const MORPHOLOGIES = [
  { minSdi: 2.5, label: "Fjord / High Dendritic", tone: "text-yellow" },
  { minSdi: 1.6, label: "Embayed / Irregular", tone: "text-cyan" },
  { minSdi: -Infinity, label: "Sub-circular / Compact", tone: "text-green" },
];

function extractPolygonGeometry(geom: unknown): PolygonGeometry | null {
  const g = geom as { type?: string; coordinates?: unknown } | null | undefined;
  if (g && (g.type === "Polygon" || g.type === "MultiPolygon") && Array.isArray(g.coordinates)) {
    return g as PolygonGeometry;
  }
  return null;
}

function shorelinePerimeterKm(geom: PolygonGeometry | null): number | null {
  if (geom?.type === "Polygon") {
    const [outer] = geom.coordinates as Ring[];
    return outer ? ringPerimeterKm(outer) : null;
  }
  if (geom?.type === "MultiPolygon") {
    return (geom.coordinates as Ring[][]).reduce(
      (acc, [outer]) => acc + (outer ? ringPerimeterKm(outer) : 0),
      0
    );
  }
  return null;
}

/** Shoreline Development Index: L / (2 * sqrt(pi * A)). 1.0 is a perfect circle; above 2.0 is dendritic or fjord-like. */
function shorelineDevelopmentIndex(perimeterKm: number | null, areaKm2: number | null) {
  if (!perimeterKm || !areaKm2 || areaKm2 <= 0) return null;
  const circularPerimeter = 2 * Math.sqrt(Math.PI * areaKm2);
  return circularPerimeter > 0 ? perimeterKm / circularPerimeter : null;
}

function lakeGeometryStats(polyGeom: PolygonGeometry | null, storedAreaKm2: unknown) {
  const areaKm2 = polyGeom
    ? geometryAreaSqKm(polyGeom)
    : typeof storedAreaKm2 === "number"
      ? storedAreaKm2
      : null;
  const areaSqMi =
    areaKm2 == null ? null : polyGeom ? geometryAreaSqMi(polyGeom) : areaKm2 / 2.58999;
  const perimeterKm = shorelinePerimeterKm(polyGeom);
  const sdi = shorelineDevelopmentIndex(perimeterKm, areaKm2);
  const morphology = sdi == null ? null : MORPHOLOGIES.find((m) => sdi >= m.minSdi);
  return { areaKm2, areaSqMi, perimeterKm, sdi, morphology };
}

/** Editable max-depth text buffer that re-syncs when the stored depth changes and commits on blur. */
function useMaxDepthInput(
  feature: EditorFeature,
  onUpdateFeature: LakeHydrologySectionProps["onUpdateFeature"]
) {
  const rawDepth = feature.properties?.maxDepthM;
  const currentDepth = typeof rawDepth === "number" ? rawDepth : null;
  const depthText = currentDepth == null ? "" : String(currentDepth);
  const [depthInput, setDepthInput] = useState(depthText);
  const [syncedDepth, setSyncedDepth] = useState(currentDepth);
  if (syncedDepth !== currentDepth) {
    setSyncedDepth(currentDepth);
    setDepthInput(depthText);
  }

  const handleDepthBlur = () => {
    const parsed = parseFloat(depthInput);
    const valid = parsed > 0 ? parsed : null;
    if (valid !== currentDepth) void onUpdateFeature?.({ maxDepthM: valid });
  };

  return {
    depthInput,
    setDepthInput,
    handleDepthBlur,
    parsedDepthM: parseFloat(depthInput) || currentDepth,
  };
}

function useSurfaceSample(
  polyGeom: PolygonGeometry | null,
  fallback: [number, number] | undefined
) {
  const centroid = polyGeom ? calculateSimpleCentroid(polyGeom as unknown as Geometry) : fallback;
  const realm = useMapRealm();
  return api.countryGeo.sampleTerrainAt.useQuery(
    { lng: centroid?.[0] ?? 0, lat: centroid?.[1] ?? 0, realm },
    { enabled: !!centroid && (centroid[0] !== 0 || centroid[1] !== 0) }
  );
}

/** Mean depth is roughly 0.4 * max depth for natural lakes. */
function estimateVolumeKm3(areaKm2: number | null, maxDepthM: number | null) {
  return areaKm2 && maxDepthM && maxDepthM > 0 ? areaKm2 * ((maxDepthM * 0.4) / 1000) : null;
}

function formatVolume(volumeKm3: number | null) {
  if (volumeKm3 == null) return "—";
  return volumeKm3 >= 1 ? `${volumeKm3.toFixed(2)} km³` : `${(volumeKm3 * 1000).toFixed(1)} M m³`;
}

export const LakeHydrologySection = React.memo(function LakeHydrologySection({
  feature,
  onUpdateFeature,
}: LakeHydrologySectionProps) {
  const polyGeom = useMemo(() => extractPolygonGeometry(feature.geometry), [feature.geometry]);

  const storedAreaKm2 = feature.properties?.areaSqKm;
  const { areaKm2, areaSqMi, perimeterKm, sdi, morphology } = useMemo(
    () => lakeGeometryStats(polyGeom, storedAreaKm2),
    [polyGeom, storedAreaKm2]
  );

  const surfaceSample = useSurfaceSample(polyGeom, feature.coordinates);
  const surfaceElev = surfaceSample.data?.midpoint ?? null;

  const { depthInput, setDepthInput, handleDepthBlur, parsedDepthM } = useMaxDepthInput(
    feature,
    onUpdateFeature
  );
  const volumeKm3 = estimateVolumeKm3(areaKm2, parsedDepthM);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Surface area"
          value={areaKm2 != null ? Math.round(areaKm2).toLocaleString() : "—"}
          unit={areaKm2 != null && "km²"}
        >
          {areaSqMi != null && (
            <span className="text-label-secondary text-footnote mt-0.5 block tabular-nums">
              ~{Math.round(areaSqMi).toLocaleString()} sq mi
            </span>
          )}
        </MetricCard>

        <MetricCard
          label="Shoreline perimeter"
          value={perimeterKm != null ? Math.round(perimeterKm).toLocaleString() : "—"}
          unit={perimeterKm != null && "km"}
        >
          {sdi != null && (
            <span className="text-label-secondary text-footnote mt-0.5 block tabular-nums">
              SDI: {sdi.toFixed(2)}
            </span>
          )}
        </MetricCard>
      </div>

      <Card className="space-y-2 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="text-blue h-3.5 w-3.5" />
            <Eyebrow>Limnology & bathymetry</Eyebrow>
          </div>
          {surfaceSample.isLoading && (
            <div className="border-separator border-t-blue h-2.5 w-2.5 animate-spin rounded-full border-2" />
          )}
        </div>

        <div className="text-footnote grid grid-cols-2 gap-2">
          <ReadoutTile
            label="Surface elevation"
            value={surfaceElev != null ? `${surfaceElev.toLocaleString()} m` : "—"}
          >
            <span className="text-label-secondary text-footnote block truncate">
              {surfaceSample.data?.zoneName || "Inland water"}
            </span>
          </ReadoutTile>

          <div className="border-separator bg-fill-4 rounded-control-sm min-w-0 space-y-1 p-2">
            <span className="text-stat-label text-label-secondary block">Max depth</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={depthInput}
                onChange={(e) => setDepthInput(e.target.value)}
                onBlur={handleDepthBlur}
                placeholder="Auto"
                className="border-separator bg-surface text-label focus:border-tint text-footnote rounded-control-sm w-16 px-2 py-0.5 tabular-nums focus:outline-none"
              />
              <span className="text-label-secondary text-footnote">m</span>
            </div>
            <span className="text-label-secondary text-footnote block">
              Mean: ~{parsedDepthM ? Math.round(parsedDepthM * 0.4) : "—"} m
            </span>
          </div>
        </div>

        <div className="border-separator bg-fill-4 rounded-control-sm space-y-2 p-2">
          <ReadoutRow label="Est. water volume" value={formatVolume(volumeKm3)} />
          {morphology && (
            <ReadoutRow
              className="border-separator border-t pt-0.5"
              label="Shore morphology"
              value={morphology.label}
              valueClassName={`font-medium ${morphology.tone}`}
            />
          )}
        </div>
      </Card>
    </div>
  );
});
