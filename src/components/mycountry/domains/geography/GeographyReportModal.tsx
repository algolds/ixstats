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
import { cn } from "~/lib/utils";
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

type IconType = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

/** A bordered panel of label/value pairs; each cell may truncate with a tooltip. */
function MetricsCard({
  title,
  cells,
}: {
  title: string;
  cells: { label: string; value: React.ReactNode; truncate?: boolean; title?: string }[];
}) {
  return (
    <Card variant="inset" padding="sm" className="space-y-1">
      <Eyebrow className="block">{title}</Eyebrow>
      <div className="text-footnote grid grid-cols-2 gap-2">
        {cells.map((c) => (
          <div key={c.label}>
            <span className="text-label-secondary text-footnote">{c.label}</span>
            <div
              className={cn("text-label font-semibold", c.truncate && "truncate")}
              title={c.title}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RowsCard({
  title,
  rows,
}: {
  title: string;
  rows: [label: string, value: React.ReactNode][];
}) {
  return (
    <Card variant="inset" padding="sm" className="space-y-1">
      <Eyebrow className="block">{title}</Eyebrow>
      <div className="text-footnote space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-label-secondary">{label}</span>
            <span className="text-label font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TableSection({
  icon: Icon,
  title,
  columns,
  rows,
  empty,
}: {
  icon: IconType;
  title: string;
  columns: string[];
  rows: { key: string | number; cells: React.ReactNode[] }[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
        <Eyebrow>{title}</Eyebrow>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => (
              <TableHead key={c} className={i > 0 ? "text-right" : undefined}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              {r.cells.map((cell, i) => (
                <TableCell key={i} className={i === 0 ? "text-label font-medium" : "text-right"}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-label-secondary py-4 text-center italic"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const km = (n: number) => `${n.toLocaleString()} km`;
const areaKm2 = (n: number) => Math.round(n).toLocaleString();

function OverviewTab({ profile: p }: { profile: GeoProfileData }) {
  const { derived } = p;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <MetricsCard
          title="Spatial metrics"
          cells={[
            { label: "Total area", value: `${p.area.areaKm2.toLocaleString()} km²` },
            { label: "Border perimeter", value: km(p.area.perimeterKm) },
            { label: "North-South span", value: km(p.area.nsSpanKm) },
            { label: "East-West span", value: km(p.area.ewSpanKm) },
          ]}
        />
        <MetricsCard
          title="Biogeographic overview"
          cells={[
            {
              label: "Dominant climate",
              value: p.climate.dominant,
              truncate: true,
              title: p.climate.dominant ?? undefined,
            },
            {
              label: "Mean elevation",
              value: `${Math.round(p.elevation.meanElev).toLocaleString()} m`,
            },
            { label: "Arable land", value: `${derived.arableLandPercent.toFixed(1)}%` },
            { label: "Terrain class", value: p.elevation.terrainRoughness, truncate: true },
          ]}
        />
      </div>

      <Card variant="inset" className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <Globe2 aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
          <Eyebrow>Geographic classification</Eyebrow>
        </div>
        <div className="text-footnote flex flex-wrap gap-2">
          {derived.isLandlocked && <Badge variant="outline">Landlocked state</Badge>}
          {derived.isIsland && <Badge variant="outline">Island nation</Badge>}
          {derived.coastlineKm > 0 && (
            <Badge variant="outline">
              Coastline: {Math.round(derived.coastlineKm).toLocaleString()} km
            </Badge>
          )}
          <Badge variant="outline">Borders: {derived.neighborCount} Neighboring Countries</Badge>
          <Badge variant="outline">
            Hydrology: {p.hydro.riverCount} Rivers / {p.hydro.lakeCount} Lakes
          </Badge>
        </div>
      </Card>
    </div>
  );
}

function ClimateTab({ profile: p }: { profile: GeoProfileData }) {
  return (
    <div className="space-y-4">
      <TableSection
        icon={CloudSun}
        title="Climate zone distribution"
        columns={["Climate category", "Coverage %", "Area (km²)", "Agri weight"]}
        rows={p.climate.zones.map((z) => ({
          key: z.type,
          cells: [
            z.type,
            `${z.percentArea.toFixed(1)}%`,
            areaKm2(z.areaSqKm),
            `x${z.agricultureFactor.toFixed(1)}`,
          ],
        }))}
        empty="No climate zones mapped."
      />
      <TableSection
        icon={TrendingUp}
        title="Altitude profile breakdown"
        columns={["Elevation tier", "Coverage %", "Area (km²)"]}
        rows={p.elevation.zones.map((z) => ({
          key: z.zone,
          cells: [z.name, `${z.percentArea.toFixed(1)}%`, areaKm2(z.areaSqKm)],
        }))}
        empty="No elevation profile mapped."
      />
    </div>
  );
}

function HydroTab({ profile: p }: { profile: GeoProfileData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <RowsCard
          title="River networks"
          rows={[
            ["Unique rivers", p.hydro.riverCount],
            ["Clipped length", km(p.hydro.totalRiverLengthKm)],
          ]}
        />
        <RowsCard
          title="Lakes & reservoirs"
          rows={[
            ["Unique lakes", p.hydro.lakeCount],
            ["Clipped area", `${p.hydro.totalLakeAreaSqKm.toLocaleString()} km²`],
          ]}
        />
      </div>
      <TableSection
        icon={Globe2}
        title="International border adjacency"
        columns={["Bordering country", "Shared Frontier (km)"]}
        rows={p.neighbors.map((n) => ({
          key: n.id,
          cells: [n.name, `${n.sharedBorderKm.toFixed(1)} km`],
        }))}
        empty="This country is land-locked with no direct international land borders or is an island."
      />
    </div>
  );
}

function SuperlativesTab({ profile: p }: { profile: GeoProfileData }) {
  const { tallestPeak, longestRiver, largestLake } = p.superlatives;
  return (
    <div className="space-y-3">
      <SuperlativeCard
        title="Tallest peak"
        item={tallestPeak}
        metricLabel="Elevation"
        metricVal={tallestPeak ? `${tallestPeak.elevation ?? 0}m` : null}
        description={tallestPeak?.prominence ? `Prominence: ${tallestPeak.prominence}m` : undefined}
        fallbackMsg="No named peaks exist. Add a Peak in the map editor geography section."
      />
      <SuperlativeCard
        title="Longest river"
        item={longestRiver}
        metricLabel="Length"
        metricVal={longestRiver?.lengthKm ? `${longestRiver.lengthKm.toFixed(2)} km` : null}
        fallbackMsg="No named rivers exist. Add a River in the map editor."
      />
      <SuperlativeCard
        title="Largest lake"
        item={largestLake}
        metricLabel="Surface Area"
        metricVal={largestLake?.areaSqKm ? `${largestLake.areaSqKm.toFixed(2)} km²` : null}
        description={largestLake?.maxDepthM ? `Max Depth: ${largestLake.maxDepthM}m` : undefined}
        fallbackMsg="No named lakes exist. Add a Lake in the map editor."
      />
    </div>
  );
}

const TAB_PANELS: Record<ReportTab, (props: { profile: GeoProfileData }) => React.ReactNode> = {
  overview: OverviewTab,
  "climate-elevation": ClimateTab,
  "hydro-borders": HydroTab,
  superlatives: SuperlativesTab,
};

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
  const Panel = TAB_PANELS[activeTab];

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

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <Panel profile={geoProfile} />
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
