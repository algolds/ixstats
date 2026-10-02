"use client";

/**
 * GeoProfileContent - Geographic analytics tab content for CountryInfoPanel.
 *
 * Displays climate distribution, elevation profile, hydrology, economic modifiers,
 * resources, and crisis risk for a country. Uses pure CSS bars (no chart library).
 *
 * Data source: geo.getCountryGeoProfile + resources.getCountryResources
 */

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
import { Skeleton } from "~/components/ui/skeleton";
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

interface GeoProfileContentProps {
  countryId: string;
  countryName?: string;
}

export function GeoProfileContent({ countryId }: GeoProfileContentProps) {
  const [climateExpanded, setClimateExpanded] = useState(false);
  const [elevationExpanded, setElevationExpanded] = useState(false);

  const { data: profile, isLoading } = api.geoCore.getCountryGeoProfile.useQuery(
    { countryId },
    { staleTime: 10 * 60_000, gcTime: 30 * 60_000 }
  );

  const { data: resources } = api.resources.getCountryResources.useQuery(
    { countryId },
    { staleTime: 10 * 60_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading geography">
        <Skeleton className="rounded-control h-24 w-full" />
        <Skeleton className="h-4 w-2/3 rounded-xs" />
        <Skeleton className="h-4 w-1/2 rounded-xs" />
      </div>
    );
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

  // Top 3 crisis risks
  const topRisks = crisisRisk
    ? Object.entries(crisisRisk)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <div className="space-y-4">
      {/* ── Key Stats ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="px-3 py-2">
          <Eyebrow className="flex items-center gap-2">
            <Wheat className="h-3 w-3" />
            Arable Land
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
            label="Mean Temp"
            value={<>{profile.climate.estMeanTempC}°C</>}
            icon={<Thermometer className="size-3.5" />}
          />
        </Card>

        <Card className="px-3 py-2">
          <Stat
            size="sm"
            label="Mean Elev"
            value={<>{profile.elevation.meanElev}m</>}
            icon={<Mountain className="size-3.5" />}
          />
        </Card>
      </div>

      {/* ── Neighbors ── */}
      {profile.neighbors && profile.neighbors.length > 0 && (
        <div>
          <Eyebrow>
            <MapPin className="mr-1 inline h-3 w-3" />
            Borders ({profile.neighbors.length})
          </Eyebrow>
          <div className="mt-1 flex flex-wrap gap-1">
            {profile.neighbors.map(
              (n: { id: string; name: string; slug: string | null; sharedBorderKm: number }) => (
                <Badge key={n.id} variant="secondary">
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

      {/* ── Climate ── */}
      {climateZones.length > 0 &&
        (() => {
          const dominant = climateZones[0]; // sorted by area desc from endpoint
          return (
            <div>
              <div className="flex items-center justify-between">
                <Eyebrow>Climate</Eyebrow>
                {climateZones.length > 1 && (
                  <span className="text-label-secondary text-footnote">
                    {climateZones.length} zones
                  </span>
                )}
              </div>

              {/* Stacked bar */}
              <button
                type="button"
                className="hover:ring-separator focus-visible:outline-tint mt-2 flex h-3 w-full cursor-pointer overflow-hidden rounded-full transition-shadow hover:ring-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setClimateExpanded((v) => !v)}
                aria-expanded={climateExpanded}
                aria-label="Show all climate zones"
                title="Click to expand all zones"
              >
                {climateZones.map((z, i) => (
                  <div
                    key={i}
                    className="h-full"
                    style={{
                      width: `${z.percentArea}%`,
                      backgroundColor: getClimateColor(z.type),
                      minWidth: z.percentArea > 0 ? "2px" : "0",
                    }}
                  />
                ))}
              </button>

              {/* Dominant zone summary */}
              {dominant && !climateExpanded && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClimateExpanded(true)}
                  aria-expanded={false}
                  className="mt-2 h-auto w-full justify-start px-1 py-1 font-normal"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: getClimateColor(dominant.type) }}
                  />
                  <span className="text-label flex-1 truncate">{dominant.type}</span>
                  <span className="text-label font-medium tabular-nums">
                    {dominant.percentArea}%
                  </span>
                  {climateZones.length > 1 && (
                    <ChevronRight className="text-label-secondary h-3 w-3" />
                  )}
                </Button>
              )}

              {/* Expanded legend */}
              {climateExpanded && (
                <div className="mt-2 space-y-0.5">
                  {climateZones.map((z, i) => (
                    <div key={i} className="text-footnote flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: getClimateColor(z.type) }}
                      />
                      <span className="text-label flex-1 truncate">{z.type}</span>
                      <span className="text-label font-medium tabular-nums">{z.percentArea}%</span>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setClimateExpanded(false)}
                    aria-expanded
                    className="text-label-secondary hover:text-label -ml-2"
                  >
                    <ChevronDown className="h-3 w-3" /> Collapse
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Elevation ── */}
      {elevationZones.length > 0 &&
        (() => {
          // Find largest zone by area
          const dominant = [...elevationZones].sort((a, b) => b.areaSqKm - a.areaSqKm)[0];
          return (
            <div>
              <div className="flex items-center justify-between">
                <Eyebrow>Elevation</Eyebrow>
                {elevationZones.length > 1 && (
                  <span className="text-label-secondary text-footnote">
                    {elevationZones.length} zones
                  </span>
                )}
              </div>

              {/* Stacked bar */}
              <button
                type="button"
                className="hover:ring-separator focus-visible:outline-tint mt-2 flex h-3 w-full cursor-pointer overflow-hidden rounded-full transition-shadow hover:ring-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setElevationExpanded((v) => !v)}
                aria-expanded={elevationExpanded}
                aria-label="Show all elevation zones"
                title="Click to expand all zones"
              >
                {elevationZones.map((z, i) => (
                  <div
                    key={i}
                    className="h-full"
                    style={{
                      width: `${z.percentArea}%`,
                      backgroundColor: getElevationColor(z.name),
                      minWidth: z.percentArea > 0 ? "2px" : "0",
                    }}
                  />
                ))}
              </button>

              {/* Dominant zone summary */}
              {dominant && !elevationExpanded && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setElevationExpanded(true)}
                  aria-expanded={false}
                  className="mt-2 h-auto w-full justify-start px-1 py-1 font-normal"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: getElevationColor(dominant.name) }}
                  />
                  <span className="text-label flex-1 truncate">{dominant.name}</span>
                  <span className="text-label font-medium tabular-nums">
                    {dominant.percentArea}%
                  </span>
                  <span className="text-label-secondary tabular-nums">
                    {dominant.minElev}–{dominant.maxElev}m
                  </span>
                  {elevationZones.length > 1 && (
                    <ChevronRight className="text-label-secondary h-3 w-3" />
                  )}
                </Button>
              )}

              {/* Expanded legend */}
              {elevationExpanded && (
                <div className="mt-2 space-y-0.5">
                  {elevationZones.map((z, i) => (
                    <div key={i} className="text-footnote flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: getElevationColor(z.name) }}
                      />
                      <span className="text-label flex-1 truncate">{z.name}</span>
                      <span className="text-label font-medium tabular-nums">{z.percentArea}%</span>
                      <span className="text-label-secondary tabular-nums">
                        {z.minElev}–{z.maxElev}m
                      </span>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setElevationExpanded(false)}
                    aria-expanded
                    className="text-label-secondary hover:text-label -ml-2"
                  >
                    <ChevronDown className="h-3 w-3" /> Collapse
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Water ── */}
      <div className="text-footnote flex flex-wrap gap-x-4 gap-y-0.5">
        <span className="text-label-secondary">
          {profile.hydro.riverCount} rivers · {profile.hydro.lakeCount} lakes ·{" "}
          {profile.climate.estAnnualPrecipMm} mm/yr precip
        </span>
      </div>

      {/* ── Economic Modifiers ── */}
      <div>
        <Eyebrow>Geographic Modifiers</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-2">
          <ModifierBadge label="GDP" value={profile.economic.gdpModifier} />
          <ModifierBadge label="Trade" value={profile.economic.tradeModifier} />
          <ModifierBadge label="Infra" value={profile.economic.infraCostModifier} />
        </div>
      </div>

      {/* ── Resources ── */}
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

      {/* ── Crisis Risk ── */}
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

      {/* ── Dimensions (compact) ── */}
      <div className="text-label-secondary border-separator text-footnote flex flex-wrap gap-x-4 gap-y-0.5 border-t pt-2">
        <span>{profile.area.areaKm2.toLocaleString()} km²</span>
        <span>
          {profile.area.nsSpanKm} x {profile.area.ewSpanKm} km
        </span>
      </div>
    </div>
  );
}
