"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import {
  Group as Users,
  StatUp as TrendingUp,
  Globe,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus as Equal,
  MapPin,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  InfoCircle as Info,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Line,
  ComposedChart,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatPopulation } from "~/lib/utils/format-utils";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils/cn";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { CHART_TOOLTIP_STYLE, type TimeRange, type ChartType } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

interface PopulationChartDataPoint {
  year: number;
  population: number;
  populationGrowthRate: number;
  populationDensity: number | null;
  totalGdp: number;
  timestamp: number;
  date: string;
}

/**
 * Fields this modal reads from `countries.getByIdWithEconomicData`, whose router
 * output is currently untyped (the procedure casts its return value).
 */
interface PopulationCountryData {
  currentPopulation: number;
  populationGrowthRate: number;
  populationDensity?: number | null;
  landArea?: number | null;
  economicTier: string;
  urbanPopulationPercent?: number | null;
  ruralPopulationPercent?: number | null;
}

interface PopulationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "trends", label: "Trends", icon: LineChart },
  { id: "comparison", label: "Comparison", icon: Globe },
];

const POPULATION_TIERS = [
  { name: "Tier 1", min: 0, max: 9_999_999, description: "0-9.99M" },
  { name: "Tier 2", min: 10_000_000, max: 29_999_999, description: "10-29.99M" },
  { name: "Tier 3", min: 30_000_000, max: 49_999_999, description: "30-49.99M" },
  { name: "Tier 4", min: 50_000_000, max: 79_999_999, description: "50-79.99M" },
  { name: "Tier 5", min: 80_000_000, max: 119_999_999, description: "80-119.99M" },
  { name: "Tier 6", min: 120_000_000, max: 349_999_999, description: "120-349.99M" },
  { name: "Tier 7", min: 350_000_000, max: 499_999_999, description: "350-499.99M" },
  { name: "Tier X", min: 500_000_000, max: Infinity, description: "500M+" },
];

const POPULATION_COLOR = "var(--chart-2)";

const signedTone = (value: number) =>
  value > 0 ? "text-green" : value < 0 ? "text-destructive" : "text-label-secondary";

const formatYearTick = (ts: unknown) => String(IxTime.getCurrentGameYear(ts as number));

function toChartPoint(
  point: {
    population?: number;
    populationGrowthRate?: number;
    populationDensity?: number | null;
    totalGdp?: number;
  },
  rawTimestamp: string | number | Date
): PopulationChartDataPoint {
  const timestamp = IxTime.toTimestamp(rawTimestamp) as number;
  return {
    year: IxTime.getCurrentGameYear(timestamp),
    population: Number(point?.population ?? 0),
    populationGrowthRate: Number(point?.populationGrowthRate ?? 0) * 100,
    populationDensity: point.populationDensity ?? null,
    totalGdp: point.totalGdp ?? 0,
    timestamp,
    date: IxTime.formatIxTime(timestamp, true),
  };
}

function tooltipFormatter(value: unknown, name: unknown): [string, string] {
  if (name === "population") return [formatPopulation(value as number), "Population"];
  if (name === "populationGrowthRate") return [`${(value as number).toFixed(3)}%`, "Growth Rate"];
  return [String(value ?? ""), String(name ?? "")];
}

/** The trend chart in the format picked in the modal header; "composed" adds the growth-rate bars. */
function PopulationTrendChart({
  data,
  chartType,
}: {
  data: PopulationChartDataPoint[];
  chartType: ChartType;
}) {
  const showsArea = chartType === "area" || chartType === "composed";
  const populationSeries = {
    line: (
      <Line
        yAxisId="population"
        type="monotone"
        dataKey="population"
        stroke={POPULATION_COLOR}
        strokeWidth={3}
        dot={false}
        name="Population"
      />
    ),
    bar: (
      <Bar
        yAxisId="population"
        dataKey="population"
        fill={POPULATION_COLOR}
        radius={[4, 4, 0, 0]}
        name="Population"
      />
    ),
    area: (
      <Area
        yAxisId="population"
        type="monotone"
        dataKey="population"
        stroke={POPULATION_COLOR}
        fillOpacity={1}
        fill="url(#popColor)"
        strokeWidth={3}
        name="Population"
      />
    ),
  };

  return (
    <ComposedChart data={data}>
      {showsArea && (
        <defs>
          <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={POPULATION_COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={POPULATION_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
      <XAxis
        dataKey="timestamp"
        domain={["dataMin", "dataMax"]}
        type="number"
        scale="time"
        name="Time"
        tickFormatter={formatYearTick}
        tickCount={6}
        stroke="var(--color-label-secondary)"
      />
      <YAxis
        yAxisId="population"
        orientation="left"
        tickFormatter={(value) => formatPopulation(value)}
        stroke="var(--color-label-secondary)"
      />
      {chartType === "composed" && (
        <YAxis
          yAxisId="growth"
          orientation="right"
          stroke="var(--color-label-secondary)"
          tickFormatter={(value) => `${value.toFixed(2)}%`}
        />
      )}
      <Tooltip
        contentStyle={CHART_TOOLTIP_STYLE}
        formatter={tooltipFormatter}
        labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
      />
      <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
      {populationSeries[chartType === "composed" ? "area" : chartType]}
      {chartType === "composed" && (
        <Bar
          yAxisId="growth"
          dataKey="populationGrowthRate"
          fill="var(--chart-3)"
          opacity={0.4}
          name="Growth Rate"
          radius={[2, 2, 0, 0]}
        />
      )}
    </ComposedChart>
  );
}

function TierInfoPopover({ currentIndex }: { currentIndex: number }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="About population tiers"
          className="text-label-secondary hover:text-label size-5 rounded-full"
        >
          <Info className="size-3" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-72 p-3">
        <h4 className="text-label text-headline mb-2">Population tier system</h4>
        <div className="space-y-2">
          {POPULATION_TIERS.map((tier, idx) => (
            <div
              key={tier.name}
              className={cn(
                "rounded-control-sm text-footnote flex items-center justify-between border px-2 py-1",
                idx === currentIndex ? "border-ring bg-fill-3" : "border-separator"
              )}
            >
              <span
                className={cn(
                  "text-caption font-semibold",
                  idx === currentIndex ? "text-label" : "text-label-secondary"
                )}
              >
                {tier.name}
              </span>
              <span className="text-label-secondary text-footnote">{tier.description}</span>
              {idx === currentIndex && (
                <Badge variant="default" className="ml-1">
                  Current
                </Badge>
              )}
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface PerformanceMetrics {
  growth: number;
  globalComparison: number;
  globalAverage: number;
  rank: number;
  totalCountries: number;
  density: number;
}

interface GlobalStats {
  count: number;
  totalPopulation: number;
}

/** Growth between the last two chart points when there are two, else the live rate. */
function trailingGrowth(chartData: PopulationChartDataPoint[], liveGrowthRate: number): number {
  const [previous, current] = chartData.slice(-2);
  if (!previous || !current || previous.population <= 0) return liveGrowthRate;
  return ((current.population - previous.population) / previous.population) * 100;
}

function computePerformance(
  country: PopulationCountryData,
  chartData: PopulationChartDataPoint[],
  globalStats: GlobalStats | undefined,
  rankIndex: number,
  totalCountries: number
): PerformanceMetrics {
  const population = country.currentPopulation;
  const globalAverage =
    globalStats && globalStats.count > 0 ? globalStats.totalPopulation / globalStats.count : 0;

  return {
    growth: trailingGrowth(chartData, country.populationGrowthRate * 100),
    globalComparison: globalAverage > 0 ? ((population - globalAverage) / globalAverage) * 100 : 0,
    globalAverage,
    rank: rankIndex === -1 ? 1 : rankIndex + 1,
    totalCountries: totalCountries || 1,
    density: country.populationDensity || population / (country.landArea || 1),
  };
}

function PerformanceSummary({ metrics }: { metrics: PerformanceMetrics }) {
  const GrowthIcon = metrics.growth > 0 ? ArrowUp : metrics.growth < 0 ? ArrowDown : Equal;
  const tileClass = "flex flex-col justify-center p-4 text-center";
  return (
    <MetricModalLayout.Panel
      icon={BarChart3}
      title="Demographics performance summary"
      subtitle="Key growth metrics and global ranking statistics."
      contentClassName="flex flex-1 flex-col justify-center"
    >
      <MetricModalLayout.TileGrid columns="grid-cols-1 md:grid-cols-3">
        <Card variant="inset" padding="none" className={tileClass}>
          <div className="text-label-secondary text-eyebrow mb-1 flex items-center justify-center gap-2">
            <GrowthIcon className={cn("h-4 w-4", signedTone(metrics.growth))} />
            Recent Growth
          </div>
          <span className={cn("text-title-2", signedTone(metrics.growth))}>
            {metrics.growth > 0 ? "+" : ""}
            {metrics.growth.toFixed(3)}%
          </span>
        </Card>

        <Card variant="inset" padding="none" className={tileClass}>
          <span className="text-stat-label text-label-secondary mb-1 block">vs Global Average</span>
          <span
            className={cn(
              "text-title-2",
              metrics.globalComparison > 0 ? "text-green" : "text-destructive"
            )}
          >
            {metrics.globalComparison > 0 ? "+" : ""}
            {metrics.globalComparison.toFixed(1)}%
          </span>
          <span className="text-label-secondary text-footnote mt-0.5">
            Avg: {formatPopulation(metrics.globalAverage)}
          </span>
        </Card>

        <Card variant="inset" padding="none" className={tileClass}>
          <span className="text-stat-label text-label-secondary mb-1 block">World ranking</span>
          <span className="text-label text-title-2">#{metrics.rank}</span>
          <span className="text-label-secondary text-footnote mt-0.5">
            of {metrics.totalCountries} countries
          </span>
        </Card>
      </MetricModalLayout.TileGrid>
    </MetricModalLayout.Panel>
  );
}

type ComparisonRow = {
  name: string;
  fullName: string;
  population: number;
  isCurrentCountry: boolean;
};

function PopulationOverview({
  country,
  metrics,
  hasGlobalStats,
}: {
  country: PopulationCountryData;
  metrics: PerformanceMetrics;
  hasGlobalStats: boolean;
}) {
  const tierIndex = POPULATION_TIERS.findIndex(
    (tier) => country.currentPopulation >= tier.min && country.currentPopulation <= tier.max
  );

  return (
    <MetricModalLayout variant="social">
      <MetricModalLayout.MainArea>
        {hasGlobalStats && <PerformanceSummary metrics={metrics} />}
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.StatCard
          label="Current population"
          value={country.currentPopulation}
          decimalPlaces={0}
          icon={Users}
          variant="social"
        />
        <MetricModalLayout.StatCard
          label="Growth rate"
          value={country.populationGrowthRate * 100}
          suffix="%"
          decimalPlaces={3}
          icon={TrendingUp}
          variant="social"
        />
        <MetricModalLayout.StatCard
          label="Population density"
          value={Math.round(metrics.density) || 0}
          suffix="/km²"
          icon={MapPin}
          variant="social"
        />
        <MetricModalLayout.Classification
          bordered={false}
          label={
            <div className="flex items-center justify-between">
              <Eyebrow>Demographics classification</Eyebrow>
              <TierInfoPopover currentIndex={tierIndex} />
            </div>
          }
          description="Influences national worker recruitment capacity, taxable demographic brackets, and structural demands."
        >
          <Badge variant="default" className="text-headline">
            {POPULATION_TIERS[tierIndex]?.name || "Unknown"}
          </Badge>
        </MetricModalLayout.Classification>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function PopulationTrends({
  chartData,
  chartType,
  country,
  trailing,
}: {
  chartData: PopulationChartDataPoint[];
  chartType: ChartType;
  country: PopulationCountryData | null | undefined;
  trailing: number | undefined;
}) {
  if (chartData.length === 0) {
    return <MetricModalLayout.Empty icon={Activity} message="No historical data available" />;
  }

  return (
    <MetricModalLayout variant="social">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          className=""
          contentClassName=""
          icon={Activity}
          title="Population Growth Trends"
          titleExtra={
            country && (
              <Badge variant="outline" className="ml-2">
                Live: {(country.populationGrowthRate * 100).toFixed(3)}% · Trailing:{" "}
                {trailing?.toFixed(3)}%
              </Badge>
            )
          }
          subtitle={`Population development over time with ${chartData.length} data points · Live rate from sim · Trailing from last interval delta`}
        >
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PopulationTrendChart data={chartData} chartType={chartType} />
            </ResponsiveContainer>
          </div>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.Highlights>
          <MetricModalLayout.Highlight
            label="Peak population"
            value={formatPopulation(Math.max(...chartData.map((d) => d.population)))}
          />
          <MetricModalLayout.Highlight
            label="Recent growth"
            tone="text-green"
            value={trailing ? `${trailing.toFixed(3)}%` : "N/A"}
          />
        </MetricModalLayout.Highlights>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function PopulationComparison({
  comparison,
  isLoading,
  breakdown,
}: {
  comparison: ComparisonRow[];
  isLoading: boolean;
  breakdown: Array<{ name: string; value: number; color: string; percentage: number }>;
}) {
  return (
    <MetricModalLayout variant="social">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          className="flex flex-1 flex-col"
          contentClassName="flex flex-1 flex-col justify-center"
          icon={Globe}
          title="Global population rankings"
        >
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : comparison.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatPopulation(value)}
                    stroke="var(--color-label-secondary)"
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    stroke="var(--color-label-secondary)"
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => [formatPopulation(value as number), "Population"]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return item?.fullName || String(label);
                    }}
                  />
                  <Bar dataKey="population" fill={POPULATION_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-label-secondary flex h-64 items-center justify-center">
              No comparison data available
            </div>
          )}
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.SidePanel title="Demographics breakdown" contentClassName="space-y-3">
          {breakdown.length === 0 ? (
            <p className="text-label-secondary text-footnote py-8 text-center">
              No urban/rural split recorded
            </p>
          ) : (
            <>
              <div className="flex h-44 w-full items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="var(--chart-5)"
                      dataKey="value"
                      label={(props: { name?: string }) => props.name ?? ""}
                      labelLine={false}
                    >
                      {breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => formatPopulation(value as number)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                {breakdown.map((segment) => (
                  <div
                    key={segment.name}
                    className="bg-fill-3 rounded-row text-footnote flex items-center justify-between p-2"
                  >
                    <span className="text-label-secondary font-medium">{segment.name}</span>
                    <div className="text-right">
                      <div className="text-label font-semibold tabular-nums">
                        {formatPopulation(segment.value)}
                      </div>
                      <div className="text-label-secondary text-footnote">
                        {segment.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </MetricModalLayout.SidePanel>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

const QUERY_OPTIONS = { staleTime: 5 * 60 * 1000 };

export function PopulationDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: PopulationDetailsModalProps) {
  const options = { ...QUERY_OPTIONS, enabled: isOpen };
  const {
    data: economicData,
    isLoading: isEconomicLoading,
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery({ id: countryId }, options);
  const { data: historicalData, isLoading: isHistoricalLoading } =
    api.historical.getCountryHistory.useQuery({ countryId }, options);
  const { data: globalStats, isLoading: isGlobalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    options
  );
  const { data: topCountries, isLoading: isTopCountriesLoading } =
    api.countries.getTopCountriesByPopulation.useQuery({ limit: 15 }, options);

  const country: PopulationCountryData | null | undefined = economicData;
  const isLoading = isEconomicLoading || isHistoricalLoading || isGlobalLoading;

  const chartDataFor = (timeRange: TimeRange) =>
    filterAndSortHistory(historicalData, timeRange, (point, _, rawTimestamp) =>
      toChartPoint(point, rawTimestamp)
    );

  const comparison: ComparisonRow[] = country
    ? (topCountries ?? [])
        .map((c) => ({
          name: c.name.length > 12 ? c.name.substring(0, 9) + "..." : c.name,
          fullName: c.name,
          population: c.currentPopulation,
          isCurrentCountry: c.id === countryId,
        }))
        .sort((a, b) => b.population - a.population)
    : [];

  // Only the recorded urban/rural split; no estimate is derived when it is missing.
  const urban = country?.urbanPopulationPercent;
  const rural = country?.ruralPopulationPercent;
  const breakdown =
    country && urban != null && rural != null
      ? [
          {
            name: "Urban Population",
            value: (country.currentPopulation * urban) / 100,
            color: "var(--color-blue-500)",
            percentage: urban,
          },
          {
            name: "Rural Population",
            value: (country.currentPopulation * rural) / 100,
            color: "var(--chart-3)",
            percentage: rural,
          },
        ]
      : [];

  // Trailing growth uses the 5y window, matching the Trends tab's default range.
  const metrics = country
    ? computePerformance(
        country,
        chartDataFor("5y"),
        globalStats,
        comparison.findIndex((c) => c.isCurrentCountry),
        comparison.length
      )
    : null;

  const renderTab = (tab: string, timeRange: TimeRange, chartType: ChartType) => {
    if (tab === "overview") {
      if (isEconomicLoading) {
        return <MetricModalLayout.Loading variant="social" mainHeight={300} sidebarCards={3} />;
      }
      return country && metrics ? (
        <PopulationOverview country={country} metrics={metrics} hasGlobalStats={!!globalStats} />
      ) : null;
    }
    if (tab === "trends") {
      return isHistoricalLoading ? (
        <MetricModalLayout.Loading variant="social" mainHeight={400} sidebarCards={0} />
      ) : (
        <PopulationTrends
          chartData={chartDataFor(timeRange)}
          chartType={chartType}
          country={country}
          trailing={metrics?.growth}
        />
      );
    }
    if (tab === "comparison") {
      return (
        <PopulationComparison
          comparison={comparison}
          isLoading={isTopCountriesLoading}
          breakdown={breakdown}
        />
      );
    }
    return null;
  };

  return (
    <BaseMetricDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      countryId={countryId}
      countryName={countryName}
      title="Population analysis"
      description="Demographics, growth trends and comparisons"
      icon={Users}
      iconColor="text-label-secondary"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="social"
      persistKey="ixstats:pop-analysis"
      defaultTimeRange="5y"
    >
      {renderTab}
    </BaseMetricDetailsModal>
  );
}
