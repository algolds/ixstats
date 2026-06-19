"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Compass,
  CloudSun,
  TrendingUp,
  Waves,
  Globe2,
  Trophy,
  ExternalLink,
} from "lucide-react";

interface ClimateZoneEntry {
  type: string;
  percentArea: number;
  areaSqKm: number;
  agricultureFactor: number;
}

interface ElevationZoneEntry {
  type: string;
  percentArea: number;
  areaSqKm: number;
}

interface NeighborEntry {
  id: string;
  name: string;
  slug: string;
  sharedBorderKm: number;
}

interface SuperlativeItem {
  id: string;
  name: string;
  elevation?: number;
  height?: number;
  prominence?: number | null;
  lengthKm?: number | null;
  areaSqKm?: number | null;
  maxDepthM?: number | null;
  wikiPageTitle?: string | null;
  subdivision?: { name: string } | null;
  subdivisionId?: string | null;
}

interface GeoProfileData {
  countryId: string;
  countryName: string;
  area: {
    areaKm2: number;
    perimeterKm: number;
    nsSpanKm: number;
    ewSpanKm: number;
    centroid: [number, number];
  };
  climate: {
    zones: ClimateZoneEntry[];
    dominant: string;
    diversityIndex: number;
    estMeanTempC: number;
    estAnnualPrecipMm: number;
    estSummerHighC: number;
    estWinterLowC: number;
  };
  elevation: {
    zones: ElevationZoneEntry[];
    dominant: string;
    meanElev: number;
    terrainRoughness: string;
  };
  hydro: {
    riverCount: number;
    totalRiverLengthKm: number;
    lakeCount: number;
    totalLakeAreaSqKm: number;
    drainageDensity: number;
  };
  derived: {
    arableLandPercent: number;
    isLandlocked: boolean;
    isIsland: boolean;
    coastlineKm: number;
    neighborCount: number;
  };
  neighbors: NeighborEntry[];
  superlatives: {
    tallestPeak?: SuperlativeItem | null;
    longestRiver?: SuperlativeItem | null;
    largestLake?: SuperlativeItem | null;
  };
}

interface GeographyReportModalProps {
  countryName: string;
  geoProfile: GeoProfileData;
  trigger?: React.ReactNode;
}

export function GeographyReportModal({
  countryName,
  geoProfile,
  trigger,
}: GeographyReportModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "climate-elevation" | "hydro-borders" | "superlatives">("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: Compass },
    { id: "climate-elevation", label: "Climate & Elevation", icon: CloudSun },
    { id: "hydro-borders", label: "Hydro & Borders", icon: Waves },
    { id: "superlatives", label: "Superlatives", icon: Trophy },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Full Geographic Report</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-card border border-border text-card-foreground shadow-2xl overflow-hidden rounded-xl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Compass className="h-5 w-5 text-primary" />
            Geographic Profile Analysis &mdash; {countryName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Comprehensive geographical breakdown including terrain elevation, macroclimate models, hydrography bounds, and regional borders.
          </DialogDescription>
        </DialogHeader>

        {/* Custom Glass Tab Controls */}
        <div className="flex border-b border-border/40 bg-muted/40 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Container */}
        <div className="mt-4 min-h-[320px] max-h-[480px] overflow-y-auto px-1 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spatial Metrics</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Total Area</span>
                      <div className="font-semibold text-foreground">{geoProfile.area.areaKm2.toLocaleString()} km²</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Border Perimeter</span>
                      <div className="font-semibold text-foreground">{geoProfile.area.perimeterKm.toLocaleString()} km</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">North-South Span</span>
                      <div className="font-semibold text-foreground">{geoProfile.area.nsSpanKm.toLocaleString()} km</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">East-West Span</span>
                      <div className="font-semibold text-foreground">{geoProfile.area.ewSpanKm.toLocaleString()} km</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Biogeographic Overview</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Dominant Climate</span>
                      <div className="font-semibold text-foreground truncate" title={geoProfile.climate.dominant}>{geoProfile.climate.dominant}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Mean Elevation</span>
                      <div className="font-semibold text-foreground">{Math.round(geoProfile.elevation.meanElev).toLocaleString()} m</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Arable Land</span>
                      <div className="font-semibold text-foreground">{geoProfile.derived.arableLandPercent.toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Terrain Class</span>
                      <div className="font-semibold text-foreground truncate">{geoProfile.elevation.terrainRoughness}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Globe2 className="h-3.5 w-3.5 text-primary" />
                  Geographic Classification
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {geoProfile.derived.isLandlocked && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-500 border border-amber-500/20">
                      Landlocked State
                    </span>
                  )}
                  {geoProfile.derived.isIsland && (
                    <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 font-medium text-cyan-500 border border-cyan-500/20">
                      Island Nation
                    </span>
                  )}
                  {geoProfile.derived.coastlineKm > 0 && (
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 font-medium text-blue-500 border border-blue-500/20">
                      Coastline: {Math.round(geoProfile.derived.coastlineKm).toLocaleString()} km
                    </span>
                  )}
                  <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 font-medium text-purple-500 border border-purple-500/20">
                    Borders: {geoProfile.derived.neighborCount} Neighboring Countries
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-500 border border-emerald-500/20">
                    Hydrology: {geoProfile.hydro.riverCount} Rivers / {geoProfile.hydro.lakeCount} Lakes
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "climate-elevation" && (
            <div className="space-y-4">
              {/* Climate Zones Table */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CloudSun className="h-3.5 w-3.5 text-sky-500" />
                  Climate Zone Distribution
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border text-muted-foreground font-semibold">
                        <th className="px-3 py-2">Climate Category</th>
                        <th className="px-3 py-2 text-right">Coverage %</th>
                        <th className="px-3 py-2 text-right">Area (km²)</th>
                        <th className="px-3 py-2 text-right">Agri Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {geoProfile.climate.zones.map((zone) => (
                        <tr key={zone.type} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium text-foreground">{zone.type}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{zone.percentArea.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right font-mono">{Math.round(zone.areaSqKm).toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-500">x{zone.agricultureFactor.toFixed(1)}</td>
                        </tr>
                      ))}
                      {geoProfile.climate.zones.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">No climate zones mapped.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Elevation Zones Table */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  Altitude Profile Breakdown
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border text-muted-foreground font-semibold">
                        <th className="px-3 py-2">Elevation Tier</th>
                        <th className="px-3 py-2 text-right">Coverage %</th>
                        <th className="px-3 py-2 text-right">Area (km²)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {geoProfile.elevation.zones.map((zone) => (
                        <tr key={zone.type} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium text-foreground">{zone.type}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{zone.percentArea.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right font-mono">{Math.round(zone.areaSqKm).toLocaleString()}</td>
                        </tr>
                      ))}
                      {geoProfile.elevation.zones.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground italic">No elevation profile mapped.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "hydro-borders" && (
            <div className="space-y-4">
              {/* Hydrography Summary Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">River Networks</div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unique Rivers</span>
                      <span className="font-semibold text-foreground">{geoProfile.hydro.riverCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clipped Length</span>
                      <span className="font-semibold text-foreground">{geoProfile.hydro.totalRiverLengthKm.toLocaleString()} km</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lakes & Reservoirs</div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unique Lakes</span>
                      <span className="font-semibold text-foreground">{geoProfile.hydro.lakeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clipped Area</span>
                      <span className="font-semibold text-foreground">{geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()} km²</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Neighbors border table */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5 text-primary" />
                  International Border Adjacency
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border text-muted-foreground font-semibold">
                        <th className="px-3 py-2">Bordering Country</th>
                        <th className="px-3 py-2 text-right">Shared Frontier (km)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {geoProfile.neighbors.map((n) => (
                        <tr key={n.id} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium text-foreground">{n.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{n.sharedBorderKm.toFixed(1)} km</td>
                        </tr>
                      ))}
                      {geoProfile.neighbors.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground italic">
                            This country is land-locked with no direct international land borders or is an island.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "superlatives" && (
            <div className="space-y-4">
              {/* Superlative cards */}
              <div className="space-y-3">
                <SuperlativeCard
                  title="Tallest Peak"
                  item={geoProfile.superlatives.tallestPeak}
                  metricLabel="Elevation"
                  metricVal={
                    geoProfile.superlatives.tallestPeak
                      ? `${geoProfile.superlatives.tallestPeak.elevation ?? geoProfile.superlatives.tallestPeak.height ?? 0}m`
                      : null
                  }
                  description={
                    geoProfile.superlatives.tallestPeak?.prominence
                      ? `Prominence: ${geoProfile.superlatives.tallestPeak.prominence}m`
                      : undefined
                  }
                  subdivision={geoProfile.superlatives.tallestPeak?.subdivision?.name}
                  fallbackMsg="No named peaks exist. Add a Peak in the map editor geography section."
                />

                <SuperlativeCard
                  title="Longest River"
                  item={geoProfile.superlatives.longestRiver}
                  metricLabel="Length"
                  metricVal={
                    geoProfile.superlatives.longestRiver?.lengthKm
                      ? `${geoProfile.superlatives.longestRiver.lengthKm.toFixed(2)} km`
                      : null
                  }
                  fallbackMsg="No named rivers exist. Add a River in the map editor."
                />

                <SuperlativeCard
                  title="Largest Lake"
                  item={geoProfile.superlatives.largestLake}
                  metricLabel="Surface Area"
                  metricVal={
                    geoProfile.superlatives.largestLake?.areaSqKm
                      ? `${geoProfile.superlatives.largestLake.areaSqKm.toFixed(2)} km²`
                      : null
                  }
                  description={
                    geoProfile.superlatives.largestLake?.maxDepthM
                      ? `Max Depth: ${geoProfile.superlatives.largestLake.maxDepthM}m`
                      : undefined
                  }
                  fallbackMsg="No named lakes exist. Add a Lake in the map editor."
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SuperlativeCardProps {
  title: string;
  item?: SuperlativeItem | null;
  metricLabel: string;
  metricVal: string | null;
  description?: string;
  subdivision?: string;
  fallbackMsg: string;
}

function SuperlativeCard({
  title,
  item,
  metricLabel,
  metricVal,
  description,
  subdivision,
  fallbackMsg,
}: SuperlativeCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        {item?.wikiPageTitle && (
          <a
            href={`https://ixwiki.com/wiki/${encodeURIComponent(item.wikiPageTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            <span>Wiki page</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      {item ? (
        <div className="flex justify-between items-end">
          <div>
            <div className="text-sm font-bold text-foreground">{item.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {subdivision && `Region: ${subdivision}`}
              {subdivision && description && " · "}
              {description}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase text-muted-foreground block">{metricLabel}</span>
            <span className="text-sm font-bold text-foreground font-mono">{metricVal}</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic py-1">{fallbackMsg}</div>
      )}
    </div>
  );
}
