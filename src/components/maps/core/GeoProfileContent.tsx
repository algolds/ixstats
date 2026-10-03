"use client";

/** Geography tab of CountryInfoPanel: climate, elevation, hydrology, modifiers, resources and risk (CSS bars only). */

import { useState } from "react";
import {
  Dashboard as Thermometer,
  ModernTv as Mountain,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Minus,
  Farm as Wheat,
  SeaWaves as Anchor,
  Tree as TreePine,
  Crown as Gem,
  Gas as Fuel,
  Fish,
  Droplet,
  MapPin,
  WarningTriangle as AlertTriangle,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { ELEVATION_ZONES } from "~/lib/maps/geo-analytics";
import {
  CLIMATE_COLORS as CLIMATE_COLOR_BY_CODE,
  CLIMATE_NAMES,
  CLIMATE_TYPES,
} from "~/lib/worldgen/climate-system";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { GeoProfileSkeleton } from "./components/GeoProfileSkeleton";
import { Button } from "~/components/ui/button";
import { Stat } from "~/components/ui/stat";
import { Card } from "~/components/ui/card";

/** Climate zone colours keyed by "<Name> (<code>)", derived from the canonical Trewartha scheme. */
const CLIMATE_COLORS: Record<string, string> = Object.fromEntries(
  CLIMATE_TYPES.map((code) => [`${CLIMATE_NAMES[code]} (${code})`, CLIMATE_COLOR_BY_CODE[code]])
);

/** Swatch fallback for an unknown zone: a theme token, not a literal. */
const UNKNOWN_SWATCH = "var(--color-label-secondary)";

function getClimateColor(type: string): string {
  if (CLIMATE_COLORS[type]) return CLIMATE_COLORS[type]!;
  for (const [key, color] of Object.entries(CLIMATE_COLORS)) {
    if (type.includes(key) || key.includes(type)) return color;
  }
  return UNKNOWN_SWATCH;
}

function getElevationColor(zoneName: string): string {
  const match = ELEVATION_ZONES.find((z) => z.zoneName === zoneName);
  return match?.color ?? UNKNOWN_SWATCH;
}

const RESOURCE_ICONS: Record<string, typeof Fish> = {
  fishery: Fish,
  forest: TreePine,
  mineral: Gem,
  oil: Fuel,
  gas: Fuel,
  freshwater: Droplet,
  agricultural: Wheat,
};

const RISK_LABELS: Record<string, string> = {
  hurricane: "Hurricane",
  earthquake: "Earthquake",
  drought: "Drought",
  flood: "Flood",
  wildfire: "Wildfire",
  pandemic: "Pandemic",
  famine: "Famine",
};

function ModifierBadge({ label, value }: { label: string; value: number }) {
  const isUp = value > 1.005;
  const isDown = value < 0.995;
  const color = isUp ? "text-green" : isDown ? "text-destructive" : "text-label-secondary";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <Badge variant="outline" className="gap-2 py-1">
      <span className="text-label-secondary">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>x{value.toFixed(2)}</span>
      <Icon className={color} aria-hidden />
    </Badge>
  );
}

function RiskBadge({ type, score }: { type: string; score: number }) {
  const label = RISK_LABELS[type] ?? type;
  const level = score >= 0.6 ? "High" : score >= 0.3 ? "Med" : "Low";
  const color =
    score >= 0.6
      ? "border-destructive/30 text-destructive"
      : score >= 0.3
        ? "border-yellow/30 text-yellow"
        : "border-green/30 text-green";

  return (
    <Badge variant="outline" className={color}>
      {label}: {level}
    </Badge>
  );
}

interface ZoneRow {
  label: string;
  percentArea: number;
  color: string;
  /** Extra right-aligned detail (e.g. an elevation range). */
  detail?: string;
}

const ZoneSwatch = ({ color }: { color: string }) => (
  <span
    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
    style={{ backgroundColor: color }}
  />
);

function ZoneLegendRow({ row }: { row: ZoneRow }) {
  return (
    <>
      <ZoneSwatch color={row.color} />
      <span className="text-label flex-1 truncate">{row.label}</span>
      <span className="text-label font-medium tabular-nums">{row.percentArea}%</span>
      {row.detail && <span className="text-label-secondary tabular-nums">{row.detail}</span>}
    </>
  );
}

/** Stacked area bar with a dominant-zone summary that expands into the full legend. */
function ZoneSection({
  title,
  noun,
  rows,
  dominantIndex,
}: {
  title: string;
  noun: string;
  rows: ZoneRow[];
  dominantIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const dominant = rows[dominantIndex];

  return (
    <div>
      <div className="flex items-center justify-between">
        <Eyebrow>{title}</Eyebrow>
        {rows.length > 1 && (
          <span className="text-label-secondary text-footnote">{rows.length} zones</span>
        )}
      </div>

      <button
        type="button"
        className="hover:ring-separator focus-visible:outline-tint mt-2 flex h-3 w-full cursor-pointer overflow-hidden rounded-full transition-shadow hover:ring-1 focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Show all ${noun} zones`}
        title="Click to expand all zones"
      >
        {rows.map((z, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              width: `${z.percentArea}%`,
              backgroundColor: z.color,
              minWidth: z.percentArea > 0 ? "2px" : "0",
            }}
          />
        ))}
      </button>

      {dominant && !expanded && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="mt-2 h-auto w-full justify-start px-1 py-1 font-normal"
        >
          <ZoneLegendRow row={dominant} />
          {rows.length > 1 && <ChevronRight className="text-label-secondary h-3 w-3" />}
        </Button>
      )}

      {expanded && (
        <div className="mt-2 space-y-0.5">
          {rows.map((z, i) => (
            <div key={i} className="text-footnote flex items-center gap-2">
              <ZoneLegendRow row={z} />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            aria-expanded
            className="text-label-secondary hover:text-label -ml-2"
          >
            <ChevronDown className="h-3 w-3" /> Collapse
          </Button>
        </div>
      )}
    </div>
  );
}

interface GeoProfileContentProps {
  countryId: string;
  countryName?: string;
}

export function GeoProfileContent({ countryId }: GeoProfileContentProps) {
  const { data: profile, isLoading } = api.geoCore.getCountryGeoProfile.useQuery(
    { countryId },
    { staleTime: 10 * 60_000, gcTime: 30 * 60_000 }
  );

  const { data: resources } = api.resources.getCountryResources.useQuery(
    { countryId },
    { staleTime: 10 * 60_000 }
  );

  if (isLoading) {
    return <GeoProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-label-secondary text-footnote py-8 text-center">
        No geographic data available. The country may not have linked map geometry.
      </div>
    );
  }

  const climateZones = profile.climate.zones ?? [];
  const elevationZones = profile.elevation.zones ?? [];
  const crisisRisk = profile.crisisRisk as unknown as Record<string, number> | undefined;

  const topRisks = crisisRisk
    ? Object.entries(crisisRisk)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Card className="px-3 py-2">
          <Eyebrow className="flex items-center gap-2">
            <Wheat className="h-3 w-3" />
            Arable land
          </Eyebrow>
          <div
            className={`text-headline mt-0.5 ${
              profile.derived.arableLandPercent > 50
                ? "text-green"
                : profile.derived.arableLandPercent > 20
                  ? "text-yellow"
                  : "text-destructive"
            }`}
          >
            {profile.derived.arableLandPercent}%
          </div>
        </Card>

        <Card className="px-3 py-2">
          <Eyebrow className="flex items-center gap-2">
            <Anchor className="h-3 w-3" />
            {profile.derived.isIsland
              ? "Island"
              : profile.derived.coastlineKm > 0
                ? "Coastal"
                : "Borders"}
          </Eyebrow>
          <div className="text-label text-headline mt-0.5">
            {profile.derived.coastlineKm > 0 ? (
              <span>{profile.derived.coastlineKm.toLocaleString()} km coast</span>
            ) : (
              <span className="text-yellow">{profile.neighbors?.length ?? 0} neighbors</span>
            )}
          </div>
        </Card>

        <Card className="px-3 py-2">
          <Stat
            size="sm"
            label="Mean temp"
            value={<>{profile.climate.estMeanTempC}°C</>}
            icon={<Thermometer className="size-3.5" />}
          />
        </Card>

        <Card className="px-3 py-2">
          <Stat
            size="sm"
            label="Mean elev"
            value={<>{profile.elevation.meanElev}m</>}
            icon={<Mountain className="size-3.5" />}
          />
        </Card>
      </div>

      {profile.neighbors && profile.neighbors.length > 0 && (
        <div>
          <Eyebrow>
            <MapPin className="mr-1 inline h-3 w-3" />
            Borders ({profile.neighbors.length})
          </Eyebrow>
          <div className="mt-1 flex flex-wrap gap-1">
            {profile.neighbors.map(
              (n: { id: string; name: string; slug: string | null; sharedBorderKm: number }) => (
                <Badge key={n.id} variant="default">
                  {n.name}
                  {n.sharedBorderKm > 0 && (
                    <span className="text-label-secondary">
                      {n.sharedBorderKm.toLocaleString()} km
                    </span>
                  )}
                </Badge>
              )
            )}
          </div>
        </div>
      )}

      {climateZones.length > 0 && (
        <ZoneSection
          title="Climate"
          noun="climate"
          rows={climateZones.map((z) => ({
            label: z.type,
            percentArea: z.percentArea,
            color: getClimateColor(z.type),
          }))}
          // sorted by area desc from the endpoint
          dominantIndex={0}
        />
      )}

      {elevationZones.length > 0 && (
        <ZoneSection
          title="Elevation"
          noun="elevation"
          rows={elevationZones.map((z) => ({
            label: z.name,
            percentArea: z.percentArea,
            color: getElevationColor(z.name),
            detail: `${z.minElev}–${z.maxElev}m`,
          }))}
          dominantIndex={elevationZones.reduce(
            (best, z, i) => (z.areaSqKm > elevationZones[best]!.areaSqKm ? i : best),
            0
          )}
        />
      )}

      <div className="text-footnote flex flex-wrap gap-x-4 gap-y-0.5">
        <span className="text-label-secondary">
          {profile.hydro.riverCount} rivers · {profile.hydro.lakeCount} lakes ·{" "}
          {profile.climate.estAnnualPrecipMm} mm/yr precip
        </span>
      </div>

      <div>
        <Eyebrow>Geographic modifiers</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-2">
          <ModifierBadge label="GDP" value={profile.economic.gdpModifier} />
          <ModifierBadge label="Trade" value={profile.economic.tradeModifier} />
          <ModifierBadge label="Infra" value={profile.economic.infraCostModifier} />
        </div>
      </div>

      {resources && resources.length > 0 && (
        <div>
          <Eyebrow>Resources ({resources.length})</Eyebrow>
          <div className="mt-2 space-y-1">
            {resources.map((r) => {
              const Icon = RESOURCE_ICONS[r.resourceType] ?? Gem;
              return (
                <div key={r.id} className="text-footnote flex items-center gap-2">
                  <Icon className="text-label-secondary h-3 w-3 shrink-0" />
                  <span className="text-label flex-1 truncate">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-label-secondary">Qty</span>
                    <div className="bg-fill-3 h-1.5 w-10 rounded-full">
                      <div
                        className="bg-blue h-1.5 rounded-full"
                        style={{ width: `${r.quantity * 100}%` }}
                      />
                    </div>
                    <span className="text-label-secondary">Ql</span>
                    <div className="bg-fill-3 h-1.5 w-10 rounded-full">
                      <div
                        className="bg-green h-1.5 rounded-full"
                        style={{ width: `${r.quality * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topRisks.length > 0 && (
        <div>
          <Eyebrow className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Risk profile
          </Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1">
            {topRisks.map(([type, score]) => (
              <RiskBadge key={type} type={type} score={score} />
            ))}
          </div>
        </div>
      )}

      <div className="text-label-secondary border-separator text-footnote flex flex-wrap gap-x-4 gap-y-0.5 border-t pt-2">
        <span>{profile.area.areaKm2.toLocaleString()} km²</span>
        <span>
          {profile.area.nsSpanKm} x {profile.area.ewSpanKm} km
        </span>
      </div>
    </div>
  );
}
