"use client";

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
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
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
      <div className="border-border/60 bg-muted/20 space-y-2 rounded-xl border p-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-7 w-10.5 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40 shadow-xs ring-1 ring-white/10 dark:ring-white/5">
              <UnifiedCountryFlag
                countryName={displayName}
                flagUrl={resolvedFlagUrl}
                fitContainer
                objectFit="cover"
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-sm font-semibold leading-tight">
                {displayName}
              </h3>
            </div>
          </div>
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            Active
          </span>
        </div>

        {onFocusCountry && (
          <button
            onClick={onFocusCountry}
            className="border-border/60 bg-background/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-all active:scale-[0.98]"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Center on canvas</span>
          </button>
        )}
      </div>

      {/* Geography Overview */}
      <div className="border-border/60 bg-muted/10 space-y-2.5 rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Geography
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
            <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
              Land area
            </span>
            <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
              <span className="text-foreground font-mono text-sm font-semibold tabular-nums tracking-tight truncate">
                {areaKm2 != null ? Math.round(areaKm2).toLocaleString() : "—"}
              </span>
              {areaKm2 != null && (
                <span className="text-muted-foreground/80 font-sans text-[11px] font-normal shrink-0">
                  km²
                </span>
              )}
            </div>
          </div>
          <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
            <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
              Total features
            </span>
            <p className="text-foreground font-mono text-sm font-semibold tabular-nums mt-0.5 truncate">
              {allFeatures.length.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Feature Breakdown Chips */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <MapPin className="text-primary h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Cities</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {counts.cities.toLocaleString()}
            </span>
          </div>

          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <Hexagon className="text-amber-500 h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Regions</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {counts.subdivisions.toLocaleString()}
            </span>
          </div>

          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <Route className="text-blue-500 h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Routes</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {counts.routes.toLocaleString()}
            </span>
          </div>

          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <Landmark className="text-amber-500 h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">POIs</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {counts.pois.toLocaleString()}
            </span>
          </div>

          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <Mountain className="text-emerald-500 h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Peaks</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {counts.peaks.toLocaleString()}
            </span>
          </div>

          <div className="border-border/40 bg-card/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] min-w-0">
            <Waves className="text-cyan-500 h-3 w-3 shrink-0" />
            <span className="text-muted-foreground truncate">Water</span>
            <span className="text-foreground ml-auto font-mono text-[10px] font-semibold tabular-nums shrink-0">
              {waterCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Hydrology System */}
      {(waterCount > 0 || (geoProfile?.hydro && (geoProfile.hydro.riverCount > 0 || geoProfile.hydro.lakeCount > 0))) && (
        <div className="border-border/60 bg-muted/10 space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Waves className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Hydrology System
              </span>
            </div>
            {geoProfile?.hydro?.drainageDensity != null && (
              <span className="text-muted-foreground/60 font-mono text-[9px] tabular-nums">
                Drainage: {geoProfile.hydro.drainageDensity.toFixed(2)} km/km²
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
              <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
                River network
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
                <span className="text-foreground font-mono text-sm font-semibold tabular-nums tracking-tight truncate">
                  {geoProfile?.hydro?.totalRiverLengthKm != null && geoProfile.hydro.totalRiverLengthKm > 0
                    ? geoProfile.hydro.totalRiverLengthKm.toLocaleString()
                    : counts.waters > 0
                    ? "Mapped"
                    : "—"}
                </span>
                {geoProfile?.hydro?.totalRiverLengthKm != null && geoProfile.hydro.totalRiverLengthKm > 0 && (
                  <span className="text-muted-foreground/80 font-sans text-[11px] font-normal shrink-0">
                    km
                  </span>
                )}
              </div>
              {geoProfile?.superlatives?.longestRiver && (
                <span className="text-muted-foreground/70 text-[10px] truncate block mt-0.5">
                  Max: {geoProfile.superlatives.longestRiver.name}
                </span>
              )}
            </div>

            <div className="border-border/40 bg-card/60 rounded-lg border p-2 min-w-0">
              <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider block truncate">
                Lakes & basins
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 min-w-0">
                <span className="text-foreground font-mono text-sm font-semibold tabular-nums tracking-tight truncate">
                  {geoProfile?.hydro?.totalLakeAreaSqKm != null && geoProfile.hydro.totalLakeAreaSqKm > 0
                    ? geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()
                    : counts.waters > 0
                    ? "Mapped"
                    : "—"}
                </span>
                {geoProfile?.hydro?.totalLakeAreaSqKm != null && geoProfile.hydro.totalLakeAreaSqKm > 0 && (
                  <span className="text-muted-foreground/80 font-sans text-[11px] font-normal shrink-0">
                    km²
                  </span>
                )}
              </div>
              {geoProfile?.superlatives?.largestLake && (
                <span className="text-muted-foreground/70 text-[10px] truncate block mt-0.5">
                  Max: {geoProfile.superlatives.largestLake.name}
                </span>
              )}
            </div>
          </div>

          {geoProfile?.climate?.estAnnualPrecipMm != null && (
            <div className="border-border/30 bg-card/40 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px]">
              <span className="text-muted-foreground">Annual precipitation</span>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {geoProfile.climate.estAnnualPrecipMm.toLocaleString()} mm/yr
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quick Add */}
      <div className="border-border/60 bg-muted/10 space-y-2 rounded-xl border p-3">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Quick add
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onModeChange("add-subdivision")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all active:scale-[0.98]"
          >
            <Hexagon className="text-amber-500 h-4 w-4" />
            <span className="text-[11px] font-medium">Region</span>
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.2 text-[9px] font-mono">
              R
            </span>
          </button>

          <button
            onClick={() => onModeChange("add-city")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all active:scale-[0.98]"
          >
            <MapPin className="text-primary h-4 w-4" />
            <span className="text-[11px] font-medium">City</span>
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.2 text-[9px] font-mono">
              C
            </span>
          </button>

          <button
            onClick={() => onModeChange("add-route")}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all active:scale-[0.98]"
          >
            <Route className="text-blue-500 h-4 w-4" />
            <span className="text-[11px] font-medium">Route</span>
            <span className="bg-muted text-muted-foreground rounded px-1 py-0.2 text-[9px] font-mono">
              T
            </span>
          </button>
        </div>
      </div>

      {/* Ambient tip */}
      <div className="text-muted-foreground/60 flex items-center justify-center gap-1.5 text-center text-[11px]">
        <Map className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>Select any feature on the map to view details</span>
      </div>
    </div>
  );
});
