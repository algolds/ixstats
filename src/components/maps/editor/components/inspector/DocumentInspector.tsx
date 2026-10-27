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
import { api, type RouterOutputs } from "~/trpc/react";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { Card } from "~/components/ui/card";
import { MetricCard, ReadoutRow } from "./InspectorPrimitives";

type CountBucket = "cities" | "subdivisions" | "routes" | "pois" | "peaks" | "waters";

const COUNT_BUCKETS: Record<string, CountBucket> = {
  city: "cities",
  subdivision: "subdivisions",
  route: "routes",
  poi: "pois",
  storyPin: "pois",
  peak: "peaks",
  river: "waters",
  lake: "waters",
};

const MUTED = "text-label-secondary";

const BREAKDOWN_CHIPS = [
  { key: "cities", label: "Cities", icon: MapPin, iconClass: "text-tint" },
  { key: "subdivisions", label: "Regions", icon: Hexagon, iconClass: MUTED },
  { key: "routes", label: "Routes", icon: Route, iconClass: MUTED },
  { key: "pois", label: "POIs", icon: Landmark, iconClass: MUTED },
  { key: "peaks", label: "Peaks", icon: Mountain, iconClass: MUTED },
  { key: "waters", label: "Water", icon: Waves, iconClass: MUTED },
] as const;

const QUICK_ADD = [
  {
    mode: "add-subdivision",
    label: "Region",
    key: "R",
    icon: Hexagon,
    iconClass: "text-label-secondary",
  },
  { mode: "add-city", label: "City", key: "C", icon: MapPin, iconClass: "text-tint" },
  { mode: "add-route", label: "Route", key: "T", icon: Route, iconClass: MUTED },
] as const;

function formatCountryFallback(nameOrId: string): string {
  const clean = featureIdToDisplayName(nameOrId).trim();
  if (clean && clean === clean.toLowerCase()) return clean.charAt(0).toUpperCase() + clean.slice(1);
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

type GeoProfile = RouterOutputs["geoCore"]["getCountryGeoProfile"];

function BreakdownChip({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  iconClass: string;
}) {
  return (
    <div className="border-separator rounded-control-sm text-footnote flex min-w-0 items-center gap-2 border px-2 py-1">
      <Icon className={`${iconClass} h-3 w-3 shrink-0`} />
      <span className="text-label-secondary truncate">{label}</span>
      <span className="text-label text-caption ml-auto shrink-0 font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function GeographyCard({
  areaKm2,
  totalFeatures,
  counts,
  waterCount,
}: {
  areaKm2: number | null | undefined;
  totalFeatures: number;
  counts: Record<CountBucket, number>;
  waterCount: number;
}) {
  return (
    <Card className="space-y-2 p-3">
      <Eyebrow>Geography</Eyebrow>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          plain
          label="Land area"
          value={areaKm2 != null ? Math.round(areaKm2).toLocaleString() : "—"}
          unit={areaKm2 != null && "km²"}
        />
        <MetricCard plain label="Total features" value={totalFeatures.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        {BREAKDOWN_CHIPS.map(({ key, label, icon, iconClass }) => (
          <BreakdownChip
            key={key}
            icon={icon}
            label={label}
            iconClass={iconClass}
            value={key === "waters" ? waterCount : counts[key]}
          />
        ))}
      </div>
    </Card>
  );
}

/** Headline value for a hydrology total: the figure when known, otherwise "Mapped" or a dash. */
function hydroMetric(total: number | null | undefined, hasMappedFeatures: boolean, unit: string) {
  if (total != null && total > 0) return { value: total.toLocaleString(), unit };
  return { value: hasMappedFeatures ? "Mapped" : "—", unit: undefined };
}

function HydrologyCard({
  profile,
  hasMappedFeatures,
}: {
  profile: GeoProfile | undefined;
  hasMappedFeatures: boolean;
}) {
  const { hydro, superlatives, climate } = profile ?? {};
  const rivers = hydroMetric(hydro?.totalRiverLengthKm, hasMappedFeatures, "km");
  const lakes = hydroMetric(hydro?.totalLakeAreaSqKm, hasMappedFeatures, "km²");
  const maxRiver = superlatives?.longestRiver?.name;
  const maxLake = superlatives?.largestLake?.name;

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="text-label-secondary h-3.5 w-3.5" />
          <Eyebrow>Hydrology system</Eyebrow>
        </div>
        {hydro?.drainageDensity != null && (
          <span className="text-label-secondary text-footnote tabular-nums">
            Drainage: {hydro.drainageDensity.toFixed(2)} km/km²
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard plain label="River network" value={rivers.value} unit={rivers.unit}>
          {maxRiver && (
            <span className="text-label-secondary text-footnote mt-0.5 block truncate">
              Max: {maxRiver}
            </span>
          )}
        </MetricCard>
        <MetricCard plain label="Lakes & basins" value={lakes.value} unit={lakes.unit}>
          {maxLake && (
            <span className="text-label-secondary text-footnote mt-0.5 block truncate">
              Max: {maxLake}
            </span>
          )}
        </MetricCard>
      </div>

      {climate?.estAnnualPrecipMm != null && (
        <ReadoutRow
          className="border-separator rounded-control border px-3 py-2"
          label="Annual precipitation"
          value={`${climate.estAnnualPrecipMm.toLocaleString()} mm/yr`}
          valueClassName="text-label font-semibold tabular-nums"
        />
      )}
    </Card>
  );
}

function QuickAddCard({ onModeChange }: { onModeChange: (mode: EditorMode) => void }) {
  return (
    <Card className="space-y-2 p-3">
      <Eyebrow>Quick add</Eyebrow>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ADD.map(({ mode, label, key, icon: Icon, iconClass }) => (
          <Button
            key={mode}
            type="button"
            variant="outline"
            size="default"
            onClick={() => onModeChange(mode)}
            className="text-label h-auto flex-col justify-center gap-1 p-2 whitespace-normal"
          >
            <Icon className={`${iconClass} h-4 w-4`} />
            <span className="text-caption">{label}</span>
            <span className="bg-fill-3 text-label-secondary py-0.2 text-footnote rounded-control-sm px-1 tabular-nums">
              {key}
            </span>
          </Button>
        ))}
      </div>
    </Card>
  );
}

function CountryHeader({
  displayName,
  flagUrl,
  onFocusCountry,
}: {
  displayName: string;
  flagUrl: string | null;
  onFocusCountry?: () => void;
}) {
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="border-separator rounded-control-sm relative h-7 w-10.5 shrink-0 overflow-hidden border">
            <UnifiedCountryFlag
              countryName={displayName}
              flagUrl={flagUrl}
              fitContainer
              objectFit="cover"
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-label text-headline truncate leading-tight">{displayName}</h3>
          </div>
        </div>
        <Badge variant="success" className="shrink-0">
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
  );
}

function useCountryIdentity({
  countryName,
  countryId,
  countryGeoDisplayName,
  flagUrl,
}: Pick<
  DocumentInspectorProps,
  "countryName" | "countryId" | "countryGeoDisplayName" | "flagUrl"
>) {
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

  const displayName =
    [
      countryName,
      countryGeoDisplayName,
      countryData?.name,
      geoData?.country?.name,
      geoData?.displayName,
      geoData?.featureId && featureIdToDisplayName(geoData.featureId),
      countryId && formatCountryFallback(countryId),
    ].find(Boolean) || "Country Overview";

  const geoFlag = geoData?.country?.flag;
  const resolvedFlagUrl =
    flagUrl || countryData?.flagUrl || (geoFlag ? normalizeFlagUrl(geoFlag) : null) || null;

  return { displayName, resolvedFlagUrl, geoProfile };
}

export const DocumentInspector = React.memo(function DocumentInspector({
  allFeatures,
  areaKm2,
  onModeChange,
  onFocusCountry,
  ...identityProps
}: DocumentInspectorProps) {
  const { displayName, resolvedFlagUrl, geoProfile } = useCountryIdentity(identityProps);

  const counts = useMemo(() => {
    const totals: Record<CountBucket, number> = {
      cities: 0,
      subdivisions: 0,
      routes: 0,
      pois: 0,
      peaks: 0,
      waters: 0,
    };
    for (const f of allFeatures) {
      const bucket = COUNT_BUCKETS[f.type];
      if (bucket) totals[bucket]++;
    }
    return totals;
  }, [allFeatures]);

  const hydro = geoProfile?.hydro;
  const waterCount = counts.waters || (hydro ? hydro.riverCount + hydro.lakeCount : 0);

  return (
    <div className="space-y-4 select-none">
      <CountryHeader
        displayName={displayName}
        flagUrl={resolvedFlagUrl}
        onFocusCountry={onFocusCountry}
      />
      <GeographyCard
        areaKm2={areaKm2}
        totalFeatures={allFeatures.length}
        counts={counts}
        waterCount={waterCount}
      />
      {waterCount > 0 && (
        <HydrologyCard profile={geoProfile} hasMappedFeatures={counts.waters > 0} />
      )}
      <QuickAddCard onModeChange={onModeChange} />

      <div className="text-label-secondary text-footnote flex items-center justify-center gap-2 text-center">
        <Map className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>Select any feature on the map to view details</span>
      </div>
    </div>
  );
});
