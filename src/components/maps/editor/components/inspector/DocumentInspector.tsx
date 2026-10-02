"use client";

import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useMemo } from "react";
import {
  Map,
  MapPin,
  Hexagon,
  PathArrow as Route,
  Bank as Landmark,
  ModernTv as Mountain,
  SeaWaves as Waves,
  Eye,
} from "iconoir-react";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";
import { api } from "~/trpc/react";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { Card } from "~/components/ui/card";

function formatCountryFallback(nameOrId: string): string {
  const clean = featureIdToDisplayName(nameOrId).trim();
  if (!clean) return "";
  if (clean === clean.toLowerCase()) {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

interface DocumentInspectorProps {
  countryName?: string;
  countryId?: string;
  countryGeoDisplayName?: string | null;
  flagUrl?: string | null;
  allFeatures: EditorFeature[];
  areaKm2?: number | null;
  onModeChange: (mode: EditorMode) => void;
  onFocusCountry?: () => void;
}

export const DocumentInspector = React.memo(function DocumentInspector({
  countryName,
  countryId,
  countryGeoDisplayName,
  flagUrl,
  allFeatures,
  areaKm2,
  onModeChange,
  onFocusCountry,
}: DocumentInspectorProps) {
  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: countryId! },
    { enabled: !!countryId && (!countryName || !flagUrl) }
  );

  const { data: geoData } = api.geoCore.getCountryGeometry.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && !countryName && !countryGeoDisplayName && !countryData?.name }
  );

  const { data: geoProfile } = api.geoCore.getCountryGeoProfile.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );

  const rawName =
    countryName ||
    countryGeoDisplayName ||
    countryData?.name ||
    geoData?.country?.name ||
    geoData?.displayName ||
    (geoData?.featureId ? featureIdToDisplayName(geoData.featureId) : "") ||
    (countryId ? formatCountryFallback(countryId) : "");

  const displayName = rawName || "Country Overview";

  const resolvedFlagUrl =
    flagUrl ||
    countryData?.flagUrl ||
    (geoData?.country?.flag ? normalizeFlagUrl(geoData.country.flag) : null) ||
    null;

  const counts = useMemo(() => {
    let cities = 0;
    let subdivisions = 0;
    let routes = 0;
    let pois = 0;
    let peaks = 0;
    let waters = 0;

    for (const f of allFeatures) {
      if (f.type === "city") cities++;
      else if (f.type === "subdivision") subdivisions++;
      else if (f.type === "route") routes++;
      else if (f.type === "poi" || f.type === "storyPin") pois++;
      else if (f.type === "peak") peaks++;
      else if (f.type === "river" || f.type === "lake") waters++;
    }

    return { cities, subdivisions, routes, pois, peaks, waters };
  }, [allFeatures]);

  const waterCount =
    counts.waters > 0
      ? counts.waters
      : geoProfile?.hydro
        ? geoProfile.hydro.riverCount + geoProfile.hydro.lakeCount
        : 0;

  return (
    <div className="space-y-4 select-none">
      {/* Country Header */}
      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="border-separator rounded-control-sm relative h-7 w-10.5 shrink-0 overflow-hidden border">
              <UnifiedCountryFlag
                countryName={displayName}
                flagUrl={resolvedFlagUrl}
                fitContainer
                objectFit="cover"
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-label text-headline truncate leading-tight">{displayName}</h3>
            </div>
          </div>
          <Badge variant="green" className="shrink-0">
            Active
          </Badge>
        </div>

        {onFocusCountry && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={onFocusCountry}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Center on canvas</span>
          </Button>
        )}
      </Card>

      {/* Geography Overview */}
      <Card className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Geography</Eyebrow>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border-separator rounded-control min-w-0 border p-2">
            <Eyebrow className="block truncate">Land area</Eyebrow>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
              <span className="text-label text-headline truncate tabular-nums">
                {areaKm2 != null ? Math.round(areaKm2).toLocaleString() : "—"}
              </span>
              {areaKm2 != null && (
                <span className="text-label-secondary text-footnote shrink-0 font-sans font-normal">
                  km²
                </span>
              )}
            </div>
          </div>
          <div className="border-separator rounded-control min-w-0 border p-2">
            <Eyebrow className="block truncate">Total features</Eyebrow>
            <p className="text-label text-headline mt-0.5 truncate tabular-nums">
              {allFeatures.length.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Feature Breakdown Chips */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <MapPin className="text-tint h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">Cities</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {counts.cities.toLocaleString()}
            </span>
          </div>

          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <Hexagon className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">Regions</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {counts.subdivisions.toLocaleString()}
            </span>
          </div>

          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <Route className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">Routes</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {counts.routes.toLocaleString()}
            </span>
          </div>

          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <Landmark className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">POIs</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {counts.pois.toLocaleString()}
            </span>
          </div>

          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <Mountain className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">Peaks</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {counts.peaks.toLocaleString()}
            </span>
          </div>

          <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
            <Waves className="text-label-secondary h-3 w-3 shrink-0" />
            <span className="text-label-secondary truncate">Water</span>
            <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
              {waterCount.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Hydrology System */}
      {(waterCount > 0 ||
        (geoProfile?.hydro &&
          (geoProfile.hydro.riverCount > 0 || geoProfile.hydro.lakeCount > 0))) && (
        <Card className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="text-label-secondary h-3.5 w-3.5" />
              <Eyebrow>Hydrology System</Eyebrow>
            </div>
            {geoProfile?.hydro?.drainageDensity != null && (
              <span className="text-label-secondary text-footnote tabular-nums">
                Drainage: {geoProfile.hydro.drainageDensity.toFixed(2)} km/km²
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-separator rounded-control min-w-0 border p-2">
              <Eyebrow className="block truncate">River network</Eyebrow>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
                <span className="text-label text-headline truncate tabular-nums">
                  {geoProfile?.hydro?.totalRiverLengthKm != null &&
                  geoProfile.hydro.totalRiverLengthKm > 0
                    ? geoProfile.hydro.totalRiverLengthKm.toLocaleString()
                    : counts.waters > 0
                      ? "Mapped"
                      : "—"}
                </span>
                {geoProfile?.hydro?.totalRiverLengthKm != null &&
                  geoProfile.hydro.totalRiverLengthKm > 0 && (
                    <span className="text-label-secondary text-footnote shrink-0 font-sans font-normal">
                      km
                    </span>
                  )}
              </div>
              {geoProfile?.superlatives?.longestRiver && (
                <span className="text-label-secondary text-footnote mt-0.5 block truncate">
                  Max: {geoProfile.superlatives.longestRiver.name}
                </span>
              )}
            </div>

            <div className="border-separator rounded-control min-w-0 border p-2">
              <Eyebrow className="block truncate">Lakes & basins</Eyebrow>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
                <span className="text-label text-headline truncate tabular-nums">
                  {geoProfile?.hydro?.totalLakeAreaSqKm != null &&
                  geoProfile.hydro.totalLakeAreaSqKm > 0
                    ? geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()
                    : counts.waters > 0
                      ? "Mapped"
                      : "—"}
                </span>
                {geoProfile?.hydro?.totalLakeAreaSqKm != null &&
                  geoProfile.hydro.totalLakeAreaSqKm > 0 && (
                    <span className="text-label-secondary text-footnote shrink-0 font-sans font-normal">
                      km²
                    </span>
                  )}
              </div>
              {geoProfile?.superlatives?.largestLake && (
                <span className="text-label-secondary text-footnote mt-0.5 block truncate">
                  Max: {geoProfile.superlatives.largestLake.name}
                </span>
              )}
            </div>
          </div>

          {geoProfile?.climate?.estAnnualPrecipMm != null && (
            <div className="border-separator rounded-control text-footnote flex items-center justify-between border px-3 py-2">
              <span className="text-label-secondary">Annual precipitation</span>
              <span className="text-label font-semibold tabular-nums">
                {geoProfile.climate.estAnnualPrecipMm.toLocaleString()} mm/yr
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Quick Add */}
      <Card className="space-y-2 p-3">
        <Eyebrow>Quick add</Eyebrow>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => onModeChange("add-subdivision")}
            className="text-label h-auto flex-col justify-center gap-1 p-2 whitespace-normal"
          >
            <Hexagon className="text-label-secondary h-4 w-4" />
            <span className="text-caption">Region</span>
            <span className="bg-fill-3 text-label-secondary py-0.2 text-footnote rounded-control-sm px-1 tabular-nums">
              R
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => onModeChange("add-city")}
            className="text-label h-auto flex-col justify-center gap-1 p-2 whitespace-normal"
          >
            <MapPin className="text-tint h-4 w-4" />
            <span className="text-caption">City</span>
            <span className="bg-fill-3 text-label-secondary py-0.2 text-footnote rounded-control-sm px-1 tabular-nums">
              C
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => onModeChange("add-route")}
            className="text-label h-auto flex-col justify-center gap-1 p-2 whitespace-normal"
          >
            <Route className="text-label-secondary h-4 w-4" />
            <span className="text-caption">Route</span>
            <span className="bg-fill-3 text-label-secondary py-0.2 text-footnote rounded-control-sm px-1 tabular-nums">
              T
            </span>
          </Button>
        </div>
      </Card>

      {/* Ambient tip */}
      <div className="text-label-secondary text-footnote flex items-center justify-center gap-2 text-center">
        <Map className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>Select any feature on the map to view details</span>
      </div>
    </div>
  );
});
