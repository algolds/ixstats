"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import {
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  StatsReport as BarChart3,
  Archery as Target,
  Component as Layers,
  Minus,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import type { ComparisonCountry } from "~/types/country-comparison";

interface ComparisonChartsProps {
  countries: ComparisonCountry[];
  onCountriesChangeAction: (countries: ComparisonCountry[]) => void;
  isLoading?: boolean;
}

type ComparisonChartType = "population" | "gdp" | "growth" | "scatter" | "radar";
type ChartRow = { name: string; color: string; [metric: string]: string | number };

const CHART_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
];

/** The chart colour for the nth selected country. */
export const chartColor = (index: number) => CHART_COLORS[index] || "#8b5cf6";

const MILLION = 1e6;
const BILLION = 1e9;

// Chart theme: semantic tokens, so both themes resolve without a manual dark branch.
const GRID = "var(--border)";
const TICK = { fontSize: 12, fill: "var(--muted-foreground)" };

/** Per chart type: its title, its menu entry and how a country becomes a row. */
const CHARTS: Record<
  ComparisonChartType,
  {
    title: string;
    option: string;
    icon: typeof Users;
    toRow: (c: ComparisonCountry) => Record<string, number>;
  }
> = {
  population: {
    title: "Population comparison",
    option: "Population",
    icon: Users,
    toRow: (c) => ({ value: c.currentPopulation / MILLION }),
  },
  gdp: {
    title: "Economic comparison",
    option: "Economic",
    icon: DollarSign,
    toRow: (c) => ({
      gdpPerCapita: c.currentGdpPerCapita / 1000,
      totalGdp: c.currentTotalGdp / BILLION,
    }),
  },
  growth: {
    title: "Growth rate comparison",
    option: "Growth rates",
    icon: TrendingUp,
    toRow: (c) => ({
      populationGrowth: c.populationGrowthRate * 100,
      gdpGrowth: c.adjustedGdpGrowth * 100,
    }),
  },
  scatter: {
    title: "GDP vs population",
    option: "GDP vs population",
    icon: Target,
    toRow: (c) => ({
      x: c.currentGdpPerCapita / 1000,
      y: c.currentPopulation / MILLION,
      z: c.currentTotalGdp / BILLION,
    }),
  },
  radar: {
    title: "Multi-metric radar",
    option: "Multi-metric",
    icon: BarChart3,
    // Scaled, capped or shifted so the axes share a 0-100 range.
    toRow: (c) => ({
      population: Math.log10(c.currentPopulation / MILLION) * 20,
      gdpPerCapita: Math.min(c.currentGdpPerCapita / 1000, 100),
      popGrowth: (c.populationGrowthRate + 0.1) * 500,
      gdpGrowth: (c.adjustedGdpGrowth + 0.1) * 500,
      density: c.populationDensity ? Math.min(c.populationDensity / 10, 100) : 0,
    }),
  },
};

const RADAR_SERIES = [
  { name: "Population", dataKey: "population", color: "#8b5cf6" },
  { name: "GDP per Capita", dataKey: "gdpPerCapita", color: "#06b6d4" },
  { name: "Pop. Growth", dataKey: "popGrowth", color: "#84cc16" },
  { name: "GDP Growth", dataKey: "gdpGrowth", color: "#f97316" },
  { name: "Density", dataKey: "density", color: "#ec4899" },
];

const percent = (v: number) => `${v.toFixed(2)}%`;
const money = (scale: number) => (v: number) => formatCurrency(v * scale);
const population = (v: number) => formatPopulation(v * MILLION);

/** Tooltip formatting by data key: values are shown in the units the charts plot them in. */
const TOOLTIP_FORMAT: Record<string, (v: number) => string> = {
  value: population,
  gdpPerCapita: money(1000),
  totalGdp: money(BILLION),
  populationGrowth: percent,
  gdpGrowth: percent,
  x: money(1000),
  y: population,
  z: money(BILLION),
  population: (v) => `${v.toFixed(1)} (log scale)`,
  popGrowth: (v) => `${v.toFixed(1)} (scaled)`,
  density: (v) => `${v.toFixed(1)}/km²`,
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated text-label border-separator rounded-control shadow-card border p-3">
      <div className="space-y-2">
        <div className="font-medium">{label}</div>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }} className="text-body">
              {entry.name}:
            </span>
            <span className="text-body font-medium">
              {TOOLTIP_FORMAT[entry.dataKey]?.(entry.value) ??
                (typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const colorCells = (data: ChartRow[]) =>
  data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />);

const BAR_MARGIN = { top: 20, right: 30, left: 20, bottom: 5 };
const GRID_LINES = <CartesianGrid strokeDasharray="3 3" stroke={GRID} />;
const NAME_AXIS = <XAxis dataKey="name" tick={TICK} angle={-20} textAnchor="end" height={60} />;
const TOOLTIP = <Tooltip content={<CustomTooltip />} />;
const LEGEND = <Legend wrapperStyle={{ fontSize: "11px" }} />;

/** A plain function, not a component: `ResponsiveContainer` injects its size into its direct child, which must be the recharts chart. */
function renderChart(type: ComparisonChartType, data: ChartRow[]) {
  switch (type) {
    case "population":
      return (
        <BarChart data={data} margin={BAR_MARGIN}>
          {GRID_LINES}
          {NAME_AXIS}
          <YAxis
            tick={TICK}
            label={{ value: "Population (M)", angle: -90, style: { fontSize: 10 } }}
          />
          <Bar dataKey="value">{colorCells(data)}</Bar>
          {TOOLTIP}
        </BarChart>
      );
    case "gdp":
      return (
        <BarChart data={data} margin={BAR_MARGIN}>
          {GRID_LINES}
          {NAME_AXIS}
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={TICK}
            label={{ value: "GDP/Cap ($K)", angle: -90, style: { fontSize: 9 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={TICK}
            label={{ value: "Total GDP ($B)", angle: 90, style: { fontSize: 9 } }}
          />
          {LEGEND}
          <Bar yAxisId="left" dataKey="gdpPerCapita" name="GDP per Capita" fill="#06b6d4" />
          <Bar yAxisId="right" dataKey="totalGdp" name="Total GDP" fill="#84cc16" />
          {TOOLTIP}
        </BarChart>
      );
    case "growth":
      return (
        <BarChart data={data} margin={BAR_MARGIN}>
          {GRID_LINES}
          {NAME_AXIS}
          <YAxis
            tick={TICK}
            label={{ value: "Growth rate (%)", angle: -90, style: { fontSize: 10 } }}
          />
          {LEGEND}
          <Bar dataKey="populationGrowth" name="Pop. Growth" fill="#8b5cf6" />
          <Bar dataKey="gdpGrowth" name="GDP Growth" fill="#06b6d4" />
          {TOOLTIP}
        </BarChart>
      );
    case "scatter":
      return (
        <ScatterChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          {GRID_LINES}
          <XAxis
            dataKey="x"
            tick={TICK}
            label={{ value: "GDP per Capita ($K)", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            dataKey="y"
            tick={TICK}
            label={{ value: "Population (M)", angle: -90, position: "insideLeft" }}
          />
          {TOOLTIP}
          <Scatter dataKey="z" fill="#8b5cf6">
            {colorCells(data)}
          </Scatter>
        </ScatterChart>
      );
    case "radar":
      return (
        <RadarChart data={data} margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={TICK} />
          <PolarRadiusAxis tick={TICK} />
          {TOOLTIP}
          {RADAR_SERIES.map(({ name, dataKey, color }) => (
            <Radar
              key={dataKey}
              name={name}
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.1}
            />
          ))}
        </RadarChart>
      );
  }
}

export function ComparisonCharts({
  countries,
  onCountriesChangeAction,
  isLoading = false,
}: ComparisonChartsProps) {
  const [chartType, setChartType] = useState<ComparisonChartType>("population");

  const removeCountry = (countryId: string) =>
    onCountriesChangeAction(
      countries
        .filter((c) => c.id !== countryId)
        .map((country, index) => ({ ...country, color: chartColor(index) }))
    );

  const data = useMemo<ChartRow[]>(
    () => countries.map((c) => ({ name: c.name, ...CHARTS[chartType].toRow(c), color: c.color })),
    [countries, chartType]
  );

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  const summary =
    countries.length === 0
      ? []
      : [
          ["Countries", countries.length],
          [
            "Total population",
            formatPopulation(countries.reduce((n, c) => n + c.currentPopulation, 0)),
          ],
          ["Total GDP", formatCurrency(countries.reduce((n, c) => n + c.currentTotalGdp, 0))],
          [
            "Avg GDP per capita",
            formatCurrency(
              countries.reduce((n, c) => n + c.currentGdpPerCapita, 0) / countries.length
            ),
          ],
        ];

  return (
    <Card className="flex w-full flex-col gap-6 py-6">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">{CHARTS[chartType].title}</CardTitle>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-medium">Countries</span>

            {countries.map((country) => (
              <Badge
                key={country.id}
                variant="default"
                className="flex items-center gap-1"
                style={{ backgroundColor: `${country.color}20`, borderColor: country.color }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: country.color }} />
                {country.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-4 w-4 p-0"
                  onClick={() => removeCountry(country.id)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-body font-medium">Chart type</span>
            <Select
              value={chartType}
              onValueChange={(value) => setChartType(value as ComparisonChartType)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHARTS).map(([type, { option, icon: Icon }]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {option}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {countries.length === 0 ? (
          <div className="text-label-secondary flex h-96 items-center justify-center">
            <div className="text-center">
              <Layers className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-title-3">No countries selected</p>
              <p className="text-body">Add countries to compare them</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-[300px] w-full sm:h-[350px] lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart(chartType, data)}
              </ResponsiveContainer>
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                {summary.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-label-secondary text-body">{label}</p>
                    <p className="text-title-3">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
