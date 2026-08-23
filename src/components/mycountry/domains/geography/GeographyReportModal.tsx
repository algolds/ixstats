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
import { Compass, CloudSunny as CloudSun, StatUp as TrendingUp, SeaWaves as Waves, Globe as Globe2, Trophy } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";

// Derived from the tRPC output so the type can't drift from the actual data shape.
type GeoProfileData = RouterOutputs["geoCore"]["getCountryGeoProfile"];
type SuperlativeItem = NonNullable<
  | GeoProfileData["superlatives"]["tallestPeak"]
  | GeoProfileData["superlatives"]["longestRiver"]
  | GeoProfileData["superlatives"]["largestLake"]
>;

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
  const [activeTab, setActiveTab] = useState<
    "overview" | "climate-elevation" | "hydro-borders" | "superlatives"
  >("overview");

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
            className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Full Geographic Report</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-card-foreground overflow-hidden rounded-xl border shadow-2xl sm:max-w-2xl">
        <DialogHeader className="border-border/60 border-b pb-3">
          <DialogTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
            <Compass className="text-primary h-5 w-5" />
            Geographic Profile Analysis &mdash; {countryName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Comprehensive geographical breakdown including terrain elevation, macroclimate models,
            hydrography bounds, and regional borders.
          </DialogDescription>
        </DialogHeader>

        {/* Custom Glass Tab Controls */}
        <div className="border-border/40 bg-muted/40 flex border-b p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-background text-foreground ring-border shadow-sm ring-1"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Container */}
        <div className="mt-4 max-h-[480px] min-h-[320px] space-y-4 overflow-y-auto px-1">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-border/60 bg-muted/10 space-y-1 rounded-xl border p-3">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Spatial Metrics
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Total Area</span>
                      <div className="text-foreground font-semibold">
                        {geoProfile.area.areaKm2.toLocaleString()} km²
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Border Perimeter</span>
                      <div className="text-foreground font-semibold">
                        {geoProfile.area.perimeterKm.toLocaleString()} km
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">North-South Span</span>
                      <div className="text-foreground font-semibold">
                        {geoProfile.area.nsSpanKm.toLocaleString()} km
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">East-West Span</span>
                      <div className="text-foreground font-semibold">
                        {geoProfile.area.ewSpanKm.toLocaleString()} km
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-border/60 bg-muted/10 space-y-1 rounded-xl border p-3">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Biogeographic Overview
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Dominant Climate</span>
                      <div
                        className="text-foreground truncate font-semibold"
                        title={geoProfile.climate.dominant ?? undefined}
                      >
                        {geoProfile.climate.dominant}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Mean Elevation</span>
                      <div className="text-foreground font-semibold">
                        {Math.round(geoProfile.elevation.meanElev).toLocaleString()} m
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Arable Land</span>
                      <div className="text-foreground font-semibold">
                        {geoProfile.derived.arableLandPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Terrain Class</span>
                      <div className="text-foreground truncate font-semibold">
                        {geoProfile.elevation.terrainRoughness}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-border/60 bg-muted/10 space-y-2 rounded-xl border p-3">
                <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
                  <Globe2 className="text-primary h-3.5 w-3.5" />
                  Geographic Classification
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {geoProfile.derived.isLandlocked && (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-500">
                      Landlocked State
                    </span>
                  )}
                  {geoProfile.derived.isIsland && (
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 font-medium text-cyan-500">
                      Island Nation
                    </span>
                  )}
                  {geoProfile.derived.coastlineKm > 0 && (
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-medium text-blue-500">
                      Coastline: {Math.round(geoProfile.derived.coastlineKm).toLocaleString()} km
                    </span>
                  )}
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 font-medium text-purple-500">
                    Borders: {geoProfile.derived.neighborCount} Neighboring Countries
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-500">
                    Hydrology: {geoProfile.hydro.riverCount} Rivers / {geoProfile.hydro.lakeCount}{" "}
                    Lakes
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "climate-elevation" && (
            <div className="space-y-4">
              {/* Climate Zones Table */}
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  <CloudSun className="h-3.5 w-3.5 text-sky-500" />
                  Climate Zone Distribution
                </div>
                <div className="border-border overflow-hidden rounded-lg border">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted border-border text-muted-foreground border-b font-semibold">
                        <th className="px-3 py-2">Climate Category</th>
                        <th className="px-3 py-2 text-right">Coverage %</th>
                        <th className="px-3 py-2 text-right">Area (km²)</th>
                        <th className="px-3 py-2 text-right">Agri Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {geoProfile.climate.zones.map((zone) => (
                        <tr key={zone.type} className="hover:bg-muted/30">
                          <td className="text-foreground px-3 py-1.5 font-medium">{zone.type}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {zone.percentArea.toFixed(1)}%
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {Math.round(zone.areaSqKm).toLocaleString()}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-emerald-500">
                            x{zone.agricultureFactor.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                      {geoProfile.climate.zones.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-muted-foreground px-3 py-4 text-center italic"
                          >
                            No climate zones mapped.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Elevation Zones Table */}
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  Altitude Profile Breakdown
                </div>
                <div className="border-border overflow-hidden rounded-lg border">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted border-border text-muted-foreground border-b font-semibold">
                        <th className="px-3 py-2">Elevation Tier</th>
                        <th className="px-3 py-2 text-right">Coverage %</th>
                        <th className="px-3 py-2 text-right">Area (km²)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {geoProfile.elevation.zones.map((zone) => (
                        <tr key={zone.zone} className="hover:bg-muted/30">
                          <td className="text-foreground px-3 py-1.5 font-medium">{zone.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {zone.percentArea.toFixed(1)}%
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {Math.round(zone.areaSqKm).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {geoProfile.elevation.zones.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-muted-foreground px-3 py-4 text-center italic"
                          >
                            No elevation profile mapped.
                          </td>
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
                <div className="border-border/60 bg-muted/10 space-y-1 rounded-xl border p-3">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    River Networks
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unique Rivers</span>
                      <span className="text-foreground font-semibold">
                        {geoProfile.hydro.riverCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clipped Length</span>
                      <span className="text-foreground font-semibold">
                        {geoProfile.hydro.totalRiverLengthKm.toLocaleString()} km
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-border/60 bg-muted/10 space-y-1 rounded-xl border p-3">
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Lakes & Reservoirs
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unique Lakes</span>
                      <span className="text-foreground font-semibold">
                        {geoProfile.hydro.lakeCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clipped Area</span>
                      <span className="text-foreground font-semibold">
                        {geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()} km²
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Neighbors border table */}
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  <Globe2 className="text-primary h-3.5 w-3.5" />
                  International Border Adjacency
                </div>
                <div className="border-border overflow-hidden rounded-lg border">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted border-border text-muted-foreground border-b font-semibold">
                        <th className="px-3 py-2">Bordering Country</th>
                        <th className="px-3 py-2 text-right">Shared Frontier (km)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/60 divide-y">
                      {geoProfile.neighbors.map((n) => (
                        <tr key={n.id} className="hover:bg-muted/30">
                          <td className="text-foreground px-3 py-1.5 font-medium">{n.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {n.sharedBorderKm.toFixed(1)} km
                          </td>
                        </tr>
                      ))}
                      {geoProfile.neighbors.length === 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="text-muted-foreground px-3 py-4 text-center italic"
                          >
                            This country is land-locked with no direct international land borders or
                            is an island.
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
                      ? `${geoProfile.superlatives.tallestPeak.elevation ?? 0}m`
                      : null
                  }
                  description={
                    geoProfile.superlatives.tallestPeak?.prominence
                      ? `Prominence: ${geoProfile.superlatives.tallestPeak.prominence}m`
                      : undefined
                  }
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
    <div className="border-border/60 bg-muted/10 space-y-1 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {title}
        </span>
      </div>
      {item ? (
        <div className="flex items-end justify-between">
          <div>
            <div className="text-foreground text-sm font-bold">{item.name}</div>
            <div className="text-muted-foreground text-[10px]">
              {subdivision && `Region: ${subdivision}`}
              {subdivision && description && " · "}
              {description}
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground block text-[9px] uppercase">{metricLabel}</span>
            <span className="text-foreground font-mono text-sm font-bold">{metricVal}</span>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground py-1 text-xs italic">{fallbackMsg}</div>
      )}
    </div>
  );
}
