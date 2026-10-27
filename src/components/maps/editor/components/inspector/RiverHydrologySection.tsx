"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useMemo } from "react";
import { SeaWaves as Waves, Compass } from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { polylineLengthKm, polylineLengthMi, bearing, compassDirection } from "~/lib/maps/geo-math";
import { api } from "~/trpc/react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import type { Geometry } from "geojson";
import { routeVertices } from "~/components/maps/editor/utils/map-helpers";
import { Card } from "~/components/ui/card";
import { MetricCard, ReadoutRow, ReadoutTile } from "./InspectorPrimitives";

interface RiverHydrologySectionProps {
  feature: EditorFeature;
}

type Coord = [number, number];

const FLOW_REGIMES = [
  { minGradient: 15, label: "High Alpine / Torrential", tone: "text-yellow" },
  { minGradient: 5, label: "Upland / Rapid Flow", tone: "text-cyan" },
  { minGradient: 1.5, label: "Valley / Moderate Run", tone: "text-blue" },
  { minGradient: -Infinity, label: "Lowland / Meandering", tone: "text-green" },
];

function lengthStats(coords: Coord[], storedLengthKm: unknown) {
  const hasPath = coords.length >= 2;
  const lengthKm = hasPath
    ? polylineLengthKm(coords)
    : typeof storedLengthKm === "number"
      ? storedLengthKm
      : null;
  const lengthMi =
    lengthKm == null ? null : (hasPath ? polylineLengthMi(coords) : 0) || lengthKm / 1.60934;
  return { lengthKm, lengthMi };
}

function elevationStats(
  sourceElev: number | null,
  mouthElev: number | null,
  lengthKm: number | null
) {
  const elevDropM =
    sourceElev != null && mouthElev != null ? Math.max(0, sourceElev - mouthElev) : null;
  const gradientMPerKm =
    elevDropM != null && lengthKm && lengthKm > 0 ? elevDropM / lengthKm : null;
  const flowRegime =
    gradientMPerKm == null ? null : FLOW_REGIMES.find((r) => gradientMPerKm >= r.minGradient);
  return { elevDropM, gradientMPerKm, flowRegime };
}

function courseLabel(source: Coord | null, mouth: Coord | null) {
  if (!source || !mouth) return null;
  const b = bearing(source, mouth);
  return `${compassDirection(b)} (${Math.round(b)}°)`;
}

const formatMeters = (m: number | null) => (m != null ? `${m.toLocaleString()} m` : "—");

function useSampledElevation(point: Coord | null) {
  const realm = useMapRealm();
  return api.countryGeo.sampleTerrainAt.useQuery(
    { lng: point?.[0] ?? 0, lat: point?.[1] ?? 0, realm },
    { enabled: !!point && (point[0] !== 0 || point[1] !== 0) }
  );
}

function EndpointTile({
  label,
  elevation,
  zoneName,
  fallbackZone,
  missing,
  point,
}: {
  label: string;
  elevation: number | null;
  zoneName: string | undefined;
  fallbackZone: string;
  missing: string;
  point: Coord | null;
}) {
  return (
    <ReadoutTile label={label} value={formatMeters(elevation)}>
      <span className="text-label-secondary text-footnote block truncate">
        {zoneName || (point ? fallbackZone : missing)}
      </span>
      {point && (
        <span className="text-label-tertiary text-footnote block truncate font-mono tabular-nums">
          {point[1].toFixed(2)}°, {point[0].toFixed(2)}°
        </span>
      )}
    </ReadoutTile>
  );
}

export const RiverHydrologySection = React.memo(function RiverHydrologySection({
  feature,
}: RiverHydrologySectionProps) {
  const coords = useMemo(() => {
    const fromGeom = routeVertices(feature.geometry as Geometry | undefined);
    if (fromGeom.length > 0) return fromGeom;
    return feature.coordinates && feature.coordinates[0] !== 0 ? [feature.coordinates] : [];
  }, [feature.geometry, feature.coordinates]);

  const source = coords[0] ?? null;
  const mouth = coords.length >= 2 ? coords.at(-1)! : null;
  const { lengthKm, lengthMi } = lengthStats(coords, feature.properties?.lengthKm);
  const courseDirection = courseLabel(source, mouth);

  const sourceSample = useSampledElevation(source);
  const mouthSample = useSampledElevation(mouth);
  const sourceElev = sourceSample.data?.midpoint ?? null;
  const mouthElev = mouthSample.data?.midpoint ?? null;
  const { elevDropM, gradientMPerKm, flowRegime } = elevationStats(sourceElev, mouthElev, lengthKm);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Course length"
          value={lengthKm != null ? Math.round(lengthKm).toLocaleString() : "—"}
          unit={lengthKm != null && "km"}
        >
          {lengthMi != null && (
            <span className="text-label-secondary text-footnote mt-0.5 block tabular-nums">
              ~{Math.round(lengthMi).toLocaleString()} mi
            </span>
          )}
        </MetricCard>

        <MetricCard label="Course geometry" value={coords.length.toLocaleString()} unit="nodes">
          {courseDirection && (
            <div className="text-label-secondary text-footnote mt-0.5 flex items-center gap-1">
              <Compass className="text-cyan h-3 w-3 shrink-0" />
              <span className="truncate">{courseDirection}</span>
            </div>
          )}
        </MetricCard>
      </div>

      <Card className="space-y-2 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="text-cyan h-3.5 w-3.5" />
            <Eyebrow>Hydrological profile</Eyebrow>
          </div>
          {(sourceSample.isLoading || mouthSample.isLoading) && (
            <div className="border-separator border-t-cyan h-2.5 w-2.5 animate-spin rounded-full border-2" />
          )}
        </div>

        <div className="text-footnote grid grid-cols-2 gap-2">
          <EndpointTile
            label="Headwaters (Source)"
            elevation={sourceElev}
            zoneName={sourceSample.data?.zoneName}
            fallbackZone="Highland"
            missing="No source"
            point={source}
          />
          <EndpointTile
            label="Terminus (Mouth)"
            elevation={mouthElev}
            zoneName={mouthSample.data?.zoneName}
            fallbackZone="Coastal / Lowland"
            missing="No terminus"
            point={mouth}
          />
        </div>

        <div className="border-separator bg-fill-4 rounded-control-sm space-y-2 p-2">
          <ReadoutRow label="Total drop" value={formatMeters(elevDropM)} />
          <ReadoutRow
            label="Mean gradient"
            value={gradientMPerKm != null ? `${gradientMPerKm.toFixed(1)} m/km` : "—"}
          />
          {flowRegime && (
            <ReadoutRow
              className="border-separator border-t pt-0.5"
              label="Flow regime"
              value={flowRegime.label}
              valueClassName={`font-medium ${flowRegime.tone}`}
            />
          )}
        </div>
      </Card>
    </div>
  );
});
