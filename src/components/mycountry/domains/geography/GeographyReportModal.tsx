"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  Compass,
  CloudSunny as CloudSun,
  StatUp as TrendingUp,
  SeaWaves as Waves,
  Globe as Globe2,
  Trophy,
} from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";

// Derived from the tRPC output so the type can't drift from the actual data shape.
type GeoProfileData = RouterOutputs["geoCore"]["getCountryGeoProfile"];
type SuperlativeItem = NonNullable<
  | GeoProfileData["superlatives"]["tallestPeak"]
  | GeoProfileData["superlatives"]["longestRiver"]
  | GeoProfileData["superlatives"]["largestLake"]
>;

type ReportTab = "overview" | "climate-elevation" | "hydro-borders" | "superlatives";

const REPORT_TABS = [
  { value: "overview", label: "Overview", icon: <Compass /> },
  { value: "climate-elevation", label: "Climate & elevation", icon: <CloudSun /> },
  { value: "hydro-borders", label: "Hydro & borders", icon: <Waves /> },
  { value: "superlatives", label: "Superlatives", icon: <Trophy /> },
];

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
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8">
            <Compass aria-hidden="true" />
            Full geographic report
          </Button>
        )}
      </SheetTrigger>
      <SheetContent size="wide" className="flex flex-col overflow-hidden">
        <SheetHeader className="border-separator border-b pb-3">
          <SheetTitle className="text-label text-title-3 flex items-center gap-2">
            <Compass aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Geographic profile: {countryName}
          </SheetTitle>
          <SheetDescription className="text-label-secondary text-footnote">
            Terrain, climate, hydrography and borders.
          </SheetDescription>
        </SheetHeader>

        <SegmentedControl
          options={REPORT_TABS}
          value={activeTab}
          onValueChange={(id) => setActiveTab(id as ReportTab)}
          size="sm"
          className="w-full"
          asTabs
        />

        {/* Tab Body Container */}
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card variant="inset" padding="sm" className="space-y-1">
                  <Eyebrow className="block">Spatial metrics</Eyebrow>
                  <div className="text-footnote grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-label-secondary text-footnote">Total area</span>
                      <div className="text-label font-semibold">
                        {geoProfile.area.areaKm2.toLocaleString()} km²
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">Border perimeter</span>
                      <div className="text-label font-semibold">
                        {geoProfile.area.perimeterKm.toLocaleString()} km
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">North-South span</span>
                      <div className="text-label font-semibold">
                        {geoProfile.area.nsSpanKm.toLocaleString()} km
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">East-West span</span>
                      <div className="text-label font-semibold">
                        {geoProfile.area.ewSpanKm.toLocaleString()} km
                      </div>
                    </div>
                  </div>
                </Card>

                <Card variant="inset" padding="sm" className="space-y-1">
                  <Eyebrow className="block">Biogeographic overview</Eyebrow>
                  <div className="text-footnote grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-label-secondary text-footnote">Dominant climate</span>
                      <div
                        className="text-label truncate font-semibold"
                        title={geoProfile.climate.dominant ?? undefined}
                      >
                        {geoProfile.climate.dominant}
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">Mean elevation</span>
                      <div className="text-label font-semibold">
                        {Math.round(geoProfile.elevation.meanElev).toLocaleString()} m
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">Arable land</span>
                      <div className="text-label font-semibold">
                        {geoProfile.derived.arableLandPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-label-secondary text-footnote">Terrain class</span>
                      <div className="text-label truncate font-semibold">
                        {geoProfile.elevation.terrainRoughness}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Card variant="inset" className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <Globe2 aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                  <Eyebrow>Geographic classification</Eyebrow>
                </div>
                <div className="text-footnote flex flex-wrap gap-2">
                  {geoProfile.derived.isLandlocked && (
                    <Badge variant="outline">Landlocked state</Badge>
                  )}
                  {geoProfile.derived.isIsland && <Badge variant="outline">Island nation</Badge>}
                  {geoProfile.derived.coastlineKm > 0 && (
                    <Badge variant="outline">
                      Coastline: {Math.round(geoProfile.derived.coastlineKm).toLocaleString()} km
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Borders: {geoProfile.derived.neighborCount} Neighboring Countries
                  </Badge>
                  <Badge variant="outline">
                    Hydrology: {geoProfile.hydro.riverCount} Rivers / {geoProfile.hydro.lakeCount}{" "}
                    Lakes
                  </Badge>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "climate-elevation" && (
            <div className="space-y-4">
              {/* Climate Zones Table */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CloudSun aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                  <Eyebrow>Climate zone distribution</Eyebrow>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Climate category</TableHead>
                      <TableHead className="text-right">Coverage %</TableHead>
                      <TableHead className="text-right">Area (km²)</TableHead>
                      <TableHead className="text-right">Agri weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geoProfile.climate.zones.map((zone) => (
                      <TableRow key={zone.type}>
                        <TableCell className="text-label font-medium">{zone.type}</TableCell>
                        <TableCell className="text-right">{zone.percentArea.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">
                          {Math.round(zone.areaSqKm).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          x{zone.agricultureFactor.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {geoProfile.climate.zones.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-label-secondary py-4 text-center italic"
                        >
                          No climate zones mapped.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Elevation Zones Table */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                  <Eyebrow>Altitude profile breakdown</Eyebrow>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Elevation tier</TableHead>
                      <TableHead className="text-right">Coverage %</TableHead>
                      <TableHead className="text-right">Area (km²)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geoProfile.elevation.zones.map((zone) => (
                      <TableRow key={zone.zone}>
                        <TableCell className="text-label font-medium">{zone.name}</TableCell>
                        <TableCell className="text-right">{zone.percentArea.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">
                          {Math.round(zone.areaSqKm).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {geoProfile.elevation.zones.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-label-secondary py-4 text-center italic"
                        >
                          No elevation profile mapped.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === "hydro-borders" && (
            <div className="space-y-4">
              {/* Hydrography Summary Card */}
              <div className="grid grid-cols-2 gap-4">
                <Card variant="inset" padding="sm" className="space-y-1">
                  <Eyebrow className="block">River networks</Eyebrow>
                  <div className="text-footnote space-y-2">
                    <div className="flex justify-between">
                      <span className="text-label-secondary">Unique rivers</span>
                      <span className="text-label font-semibold">
                        {geoProfile.hydro.riverCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-label-secondary">Clipped length</span>
                      <span className="text-label font-semibold">
                        {geoProfile.hydro.totalRiverLengthKm.toLocaleString()} km
                      </span>
                    </div>
                  </div>
                </Card>

                <Card variant="inset" padding="sm" className="space-y-1">
                  <Eyebrow className="block">Lakes & reservoirs</Eyebrow>
                  <div className="text-footnote space-y-2">
                    <div className="flex justify-between">
                      <span className="text-label-secondary">Unique lakes</span>
                      <span className="text-label font-semibold">{geoProfile.hydro.lakeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-label-secondary">Clipped area</span>
                      <span className="text-label font-semibold">
                        {geoProfile.hydro.totalLakeAreaSqKm.toLocaleString()} km²
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Neighbors border table */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe2 aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                  <Eyebrow>International border adjacency</Eyebrow>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bordering country</TableHead>
                      <TableHead className="text-right">Shared Frontier (km)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geoProfile.neighbors.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-label font-medium">{n.name}</TableCell>
                        <TableCell className="text-right">
                          {n.sharedBorderKm.toFixed(1)} km
                        </TableCell>
                      </TableRow>
                    ))}
                    {geoProfile.neighbors.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-label-secondary py-4 text-center italic"
                        >
                          This country is land-locked with no direct international land borders or
                          is an island.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === "superlatives" && (
            <div className="space-y-4">
              {/* Superlative cards */}
              <div className="space-y-3">
                <SuperlativeCard
                  title="Tallest peak"
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
                  title="Longest river"
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
                  title="Largest lake"
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
      </SheetContent>
    </Sheet>
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
    <Card variant="inset" padding="sm" className="space-y-1">
      <div className="flex items-center justify-between">
        <Eyebrow>{title}</Eyebrow>
      </div>
      {item ? (
        <div className="flex items-end justify-between">
          <div>
            <div className="text-label text-headline">{item.name}</div>
            <div className="text-label-secondary text-footnote">
              {subdivision && `Region: ${subdivision}`}
              {subdivision && description && " · "}
              {description}
            </div>
          </div>
          <div className="text-right">
            <span className="text-stat-label text-label-secondary block">{metricLabel}</span>
            <span className="text-label text-headline tabular-nums">{metricVal}</span>
          </div>
        </div>
      ) : (
        <div className="text-label-secondary text-footnote py-1 italic">{fallbackMsg}</div>
      )}
    </Card>
  );
}
