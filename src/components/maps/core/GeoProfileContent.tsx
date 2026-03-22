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
  Thermometer, Mountain, TrendingUp, TrendingDown, Minus,
  Wheat, Anchor, TreePine, Gem, Fuel, Fish, Droplet, MapPin,
  AlertTriangle, Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { ELEVATION_ZONES } from "~/lib/geo-analytics";

/** Color lookup for climate zones — match by name substring */
const CLIMATE_COLORS: Record<string, string> = {
  "Tropical Wet (Ar)": "#990000",
  "Tropical Wet-And-Dry (Aw)": "#FF3300",
  "Desert or Arid (Bw)": "#FFFF33",
  "Steppe or Semiarid (Bs)": "#FF9933",
  "Subtropical Dry Summer (Cs)": "#669900",
  "Subtropical Humid (Cf)": "#336600",
  "Temperate Oceanic (Do)": "#00FF99",
  "Temperate Continental (Dc)": "#0099FF",
  "Boreal (E)": "#0066CC",
  "Tundra (Ft)": "#B9B9B9",
  "Ice Cap (Fi)": "#99FFFF",
  "Highland (H)": "#FFCCFF",
};

function getClimateColor(type: string): string {
  if (CLIMATE_COLORS[type]) return CLIMATE_COLORS[type]!;
  for (const [key, color] of Object.entries(CLIMATE_COLORS)) {
    if (type.includes(key) || key.includes(type)) return color;
  }
  return "#888888";
}

function getElevationColor(zoneName: string): string {
  const match = ELEVATION_ZONES.find((z) => z.zoneName === zoneName);
  return match?.color ?? "#888888";
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
  const color = isUp ? "text-emerald-600" : isDown ? "text-red-500" : "text-muted-foreground";
  const bg = isUp ? "bg-emerald-50" : isDown ? "bg-red-50" : "bg-muted";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1.5 rounded-md ${bg} px-2 py-1.5`}>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>
        x{value.toFixed(2)}
      </span>
      <Icon className={`h-3 w-3 ${color}`} />
    </div>
  );
}

function RiskBadge({ type, score }: { type: string; score: number }) {
  const label = RISK_LABELS[type] ?? type;
  const level = score >= 0.6 ? "High" : score >= 0.3 ? "Med" : "Low";
  const color =
    score >= 0.6
      ? "bg-red-50 text-red-600"
      : score >= 0.3
      ? "bg-amber-50 text-amber-600"
      : "bg-emerald-50 text-emerald-600";

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}: {level}
    </span>
  );
}

interface GeoProfileContentProps {
  countryId: string;
  countryName?: string;
}

export function GeoProfileContent({ countryId }: GeoProfileContentProps) {
  const [climateExpanded, setClimateExpanded] = useState(false);
  const [elevationExpanded, setElevationExpanded] = useState(false);

  const { data: profile, isLoading } = api.geo.getCountryGeoProfile.useQuery(
    { countryId },
    { staleTime: 10 * 60_000, gcTime: 30 * 60_000 }
  );

  const { data: resources } = api.resources.getCountryResources.useQuery(
    { countryId },
    { staleTime: 10 * 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        No geographic data available. The country may not have linked map geometry.
      </div>
    );
  }

  const climateZones = profile.climate.zones ?? [];
  const elevationZones = profile.elevation.zones ?? [];
  const crisisRisk = profile.crisisRisk as Record<string, number> | undefined;

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
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Wheat className="h-3 w-3" />
            Arable Land
          </div>
          <div className={`mt-0.5 text-sm font-semibold ${
            profile.derived.arableLandPercent > 50 ? "text-emerald-600"
            : profile.derived.arableLandPercent > 20 ? "text-amber-600"
            : "text-red-500"
          }`}>
            {profile.derived.arableLandPercent}%
          </div>
        </div>

        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Anchor className="h-3 w-3" />
            {profile.derived.isIsland ? "Island" : profile.derived.coastlineKm > 0 ? "Coastal" : "Borders"}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">
            {profile.derived.coastlineKm > 0 ? (
              <span>{profile.derived.coastlineKm.toLocaleString()} km coast</span>
            ) : (
              <span className="text-amber-600">{profile.neighbors?.length ?? 0} neighbors</span>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Thermometer className="h-3 w-3" />
            Mean Temp
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">
            {profile.climate.estMeanTempC}°C
          </div>
        </div>

        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Mountain className="h-3 w-3" />
            Mean Elev
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">
            {profile.elevation.meanElev}m
          </div>
        </div>
      </div>

      {/* ── Neighbors ── */}
      {profile.neighbors && profile.neighbors.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3" />
            Borders ({profile.neighbors.length})
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {profile.neighbors.map((n: { id: string; name: string; slug: string | null; sharedBorderKm: number }) => (
              <span
                key={n.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                {n.name}
                {n.sharedBorderKm > 0 && (
                  <span className="text-muted-foreground">{n.sharedBorderKm.toLocaleString()} km</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Climate ── */}
      {climateZones.length > 0 && (() => {
        const dominant = climateZones[0]; // sorted by area desc from endpoint
        return (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Climate
              </span>
              {climateZones.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  {climateZones.length} zones
                </span>
              )}
            </div>

            {/* Stacked bar */}
            <button
              className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full cursor-pointer hover:ring-1 hover:ring-border transition-shadow"
              onClick={() => setClimateExpanded((v) => !v)}
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
              <button
                onClick={() => setClimateExpanded(true)}
                className="mt-1.5 flex w-full items-center gap-2 text-[10px] text-left transition-colors hover:text-foreground"
              >
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: getClimateColor(dominant.type) }}
                />
                <span className="flex-1 truncate text-foreground/80">{dominant.type}</span>
                <span className="font-medium text-foreground tabular-nums">{dominant.percentArea}%</span>
                {climateZones.length > 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>
            )}

            {/* Expanded legend */}
            {climateExpanded && (
              <div className="mt-1.5 space-y-0.5">
                {climateZones.map((z, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: getClimateColor(z.type) }}
                    />
                    <span className="flex-1 truncate text-foreground/80">{z.type}</span>
                    <span className="font-medium text-foreground tabular-nums">{z.percentArea}%</span>
                  </div>
                ))}
                <button
                  onClick={() => setClimateExpanded(false)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className="h-3 w-3" /> Collapse
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Elevation ── */}
      {elevationZones.length > 0 && (() => {
        // Find largest zone by area
        const dominant = [...elevationZones].sort((a, b) => b.areaSqKm - a.areaSqKm)[0];
        return (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Elevation
              </span>
              {elevationZones.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  {elevationZones.length} zones
                </span>
              )}
            </div>

            {/* Stacked bar */}
            <button
              className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full cursor-pointer hover:ring-1 hover:ring-border transition-shadow"
              onClick={() => setElevationExpanded((v) => !v)}
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
              <button
                onClick={() => setElevationExpanded(true)}
                className="mt-1.5 flex w-full items-center gap-2 text-[10px] text-left transition-colors hover:text-foreground"
              >
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: getElevationColor(dominant.name) }}
                />
                <span className="flex-1 truncate text-foreground/80">{dominant.name}</span>
                <span className="font-medium text-foreground tabular-nums">{dominant.percentArea}%</span>
                <span className="text-muted-foreground tabular-nums">{dominant.minElev}–{dominant.maxElev}m</span>
                {elevationZones.length > 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>
            )}

            {/* Expanded legend */}
            {elevationExpanded && (
              <div className="mt-1.5 space-y-0.5">
                {elevationZones.map((z, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: getElevationColor(z.name) }}
                    />
                    <span className="flex-1 truncate text-foreground/80">{z.name}</span>
                    <span className="font-medium text-foreground tabular-nums">{z.percentArea}%</span>
                    <span className="text-muted-foreground tabular-nums">{z.minElev}–{z.maxElev}m</span>
                  </div>
                ))}
                <button
                  onClick={() => setElevationExpanded(false)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className="h-3 w-3" /> Collapse
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Water ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px]">
        <span className="text-muted-foreground">
          {profile.hydro.riverCount} rivers · {profile.hydro.lakeCount} lakes · {profile.climate.estAnnualPrecipMm} mm/yr precip
        </span>
      </div>

      {/* ── Economic Modifiers ── */}
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Geographic Modifiers
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <ModifierBadge label="GDP" value={profile.economic.gdpModifier} />
          <ModifierBadge label="Trade" value={profile.economic.tradeModifier} />
          <ModifierBadge label="Infra" value={profile.economic.infraCostModifier} />
        </div>
      </div>

      {/* ── Resources ── */}
      {resources && resources.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resources ({resources.length})
          </span>
          <div className="mt-1.5 space-y-1">
            {resources.map((r) => {
              const Icon = RESOURCE_ICONS[r.resourceType] ?? Gem;
              return (
                <div key={r.id} className="flex items-center gap-2 text-[10px]">
                  <Icon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground/80">{r.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Qty</span>
                    <div className="h-1.5 w-10 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${r.quantity * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground">Ql</span>
                    <div className="h-1.5 w-10 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
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
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Risk Profile
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topRisks.map(([type, score]) => (
              <RiskBadge key={type} type={type} score={score} />
            ))}
          </div>
        </div>
      )}

      {/* ── Dimensions (compact) ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground border-t border-border/30 pt-2">
        <span>{profile.area.areaKm2.toLocaleString()} km²</span>
        <span>{profile.area.nsSpanKm} x {profile.area.ewSpanKm} km</span>
      </div>
    </div>
  );
}
