"use client";

import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
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
      <FacetCard surface="solid" className="space-y-2 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="border-border relative h-7 w-10.5 shrink-0 overflow-hidden rounded-md border">
              <UnifiedCountryFlag
                countryName={displayName}
                flagUrl={resolvedFlagUrl}
                fitContainer
                objectFit="cover"
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-sm leading-tight font-semibold">
                {displayName}
              </h3>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 border-emerald-500/30 text-emerald-500">
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
      </FacetCard>

      {/* Geography Overview */}
      <FacetCard surface="solid" className="space-y-2.5 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Geography</Eyebrow>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border-border min-w-0 rounded-lg border p-2">
            <Eyebrow className="block truncate">Land area</Eyebrow>
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
          </div>
          <div className="border-border min-w-0 rounded-lg border p-2">
            <Eyebrow className="block truncate">Total features</Eyebrow>
            <p className="text-foreground mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
              {allFeatures.length.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Feature Breakdown Chips */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <MapPin className="text-primary h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Cities</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {counts.cities.toLocaleString()}
            </span>
          </div>

          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Hexagon className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Regions</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {counts.subdivisions.toLocaleString()}
            </span>
          </div>

          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Route className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Routes</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {counts.routes.toLocaleString()}
            </span>
          </div>

          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Landmark className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">POIs</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {counts.pois.toLocaleString()}
            </span>
          </div>

          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Mountain className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Peaks</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {counts.peaks.toLocaleString()}
            </span>
          </div>

          <div className="border-border flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <Waves className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Water</span>
            <span className="text-foreground ml-auto shrink-0 font-mono text-xs font-semibold tabular-nums">
              {waterCount.toLocaleString()}
            </span>
          </div>
        </div>
      </FacetCard>

      {/* Hydrology System */}
      {(waterCount > 0 ||
        (geoProfile?.hydro &&
          (geoProfile.hydro.riverCount > 0 || geoProfile.hydro.lakeCount > 0))) && (
        <FacetCard surface="solid" className="space-y-2 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Waves className="text-muted-foreground h-3.5 w-3.5" />
              <Eyebrow>Hydrology System</Eyebrow>
            </div>
            {geoProfile?.hydro?.drainageDensity != null && (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                Drainage: {geoProfile.hydro.drainageDensity.toFixed(2)} km/km²
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-border min-w-0 rounded-lg border p-2">
              <Eyebrow className="block truncate">River network</Eyebrow>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
                <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
                  {geoProfile?.hydro?.totalRiverLengthKm != null &&
                  geoProfile.hydro.totalRiverLengthKm > 0
                    ? geoProfile.hydro.totalRiverLengthKm.toLocaleString()
                    : counts.waters > 0
                      ? "Mapped"
                      : "—"}
                </span>
                {geoProfile?.hydro?.totalRiverLengthKm != null &&
                  geoProfile.hydro.totalRiverLengthKm > 0 && (
                    <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
                      km
                    </span>
                  )}
              </div>
              {geoProfile?.superlatives?.longestRiver && (
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  Max: {geoProfile.superlatives.longestRiver.name}
                </span>
              )}
            </div>

            <div className="border-border min-w-0 rounded-lg border p-2">
              <Eyebrow className="block truncate">Lakes & basins</Eyebrow>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
                <span className="text-foreground truncate font-mono text-sm font-semibold tracking-tight tabular-nums">
                  {geoProfile?.hydro?.totalLakeAreaSqKm != null &&
                  geoProfile.hydro.totalLakeAreaSqKm > 0
                    ? geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()
                    : counts.waters > 0
                      ? "Mapped"
                      : "—"}
                </span>
                {geoProfile?.hydro?.totalLakeAreaSqKm != null &&
                  geoProfile.hydro.totalLakeAreaSqKm > 0 && (
                    <span className="text-muted-foreground shrink-0 font-sans text-xs font-normal">
                      km²
                    </span>
                  )}
              </div>
              {geoProfile?.superlatives?.largestLake && (
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  Max: {geoProfile.superlatives.largestLake.name}
                </span>
              )}
            </div>
          </div>

          {geoProfile?.climate?.estAnnualPrecipMm != null && (
            <div className="border-border flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Annual precipitation</span>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {geoProfile.climate.estAnnualPrecipMm.toLocaleString()} mm/yr
              </span>
            </div>
          )}
        </FacetCard>
      )}

      {/* Quick Add */}
      <FacetCard surface="solid" className="space-y-2 rounded-xl p-3">
        <Eyebrow>Quick add</Eyebrow>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onModeChange("add-subdivision")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
          >
            <Hexagon className="text-muted-foreground h-4 w-4" />
            <span className="text-xs font-medium">Region</span>
            <span className="bg-muted text-muted-foreground py-0.2 rounded px-1 font-mono text-xs">
              R
            </span>
          </button>

          <button
            onClick={() => onModeChange("add-city")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
          >
            <MapPin className="text-primary h-4 w-4" />
            <span className="text-xs font-medium">City</span>
            <span className="bg-muted text-muted-foreground py-0.2 rounded px-1 font-mono text-xs">
              C
            </span>
          </button>

          <button
            onClick={() => onModeChange("add-route")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
          >
            <Route className="text-muted-foreground h-4 w-4" />
            <span className="text-xs font-medium">Route</span>
            <span className="bg-muted text-muted-foreground py-0.2 rounded px-1 font-mono text-xs">
              T
            </span>
          </button>
        </div>
      </FacetCard>

      {/* Ambient tip */}
      <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
        <Map className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>Select any feature on the map to view details</span>
      </div>
    </div>
  );
});
