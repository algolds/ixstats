"use client";

import React from "react";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import {
  Dollar as DollarSign,
  Calculator,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  InfoCircle as Info,
} from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { XAxis, YAxis, CartesianGrid, Area, Bar, Line, ComposedChart, Legend } from "recharts";
import { format } from "date-fns";
import { BaseMetricDetailsModal } from "./BaseMetricDetailsModal";
import type { MetricModalTab, TimeRange, ChartType } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";

interface GdpDetailsModalProps {
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

const GDP_TIERS = [
  { name: "Impoverished", min: 0, max: 9999, color: "text-destructive" },
  { name: "Developing", min: 10000, max: 24999, color: "text-yellow" },
  { name: "Developed", min: 25000, max: 34999, color: "text-yellow" },
  { name: "Healthy", min: 35000, max: 44999, color: "text-green" },
  { name: "Strong", min: 45000, max: 54999, color: "text-label" },
  { name: "Very Strong", min: 55000, max: 64999, color: "text-label" },
  { name: "Extravagant", min: 65000, max: Infinity, color: "text-label" },
];

const CHART_CONFIG = {
  totalGdp: { label: "Total GDP (Trillions)", color: "var(--color-blue-500)" },
  gdpPerCapita: { label: "GDP per capita", color: "var(--color-destructive)" },
  gdpGrowth: { label: "GDP Growth %", color: "var(--chart-3)" },
};

const AMBER = "var(--color-amber-500)";
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

type CountryData = NonNullable<RouterOutputs["countries"]["getByIdWithEconomicData"]>;
type GlobalStats = NonNullable<RouterOutputs["countries"]["getGlobalStats"]>;

interface GdpPoint {
  date: string;
  timestamp: number;
  totalGdp: number;
  gdpPerCapita: number | undefined;
  gdpGrowth: number;
}

function toGdpPoint(
  point: { totalGdp?: number; gdpPerCapita?: number; gdpGrowthRate?: number },
  rawTimestamp: string | number | Date
): GdpPoint {
  const timestamp =
    typeof rawTimestamp === "number" ? rawTimestamp : new Date(rawTimestamp).getTime();
  const rate = point.gdpGrowthRate ?? 0;
  return {
    date: format(new Date(timestamp), "MMM yyyy"),
    timestamp,
    totalGdp: (point.totalGdp || 0) / 1e12,
    gdpPerCapita: point.gdpPerCapita,
    // Rates stored as fractions (<= 0.5) are converted to percent; larger values are already percent.
    gdpGrowth: Math.abs(rate) <= 0.5 ? rate * 100 : rate,
  };
}

function computeGdpStats(points: GdpPoint[]) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;

  const growth = last.gdpGrowth || 0;
  const yearsElapsed = (last.timestamp - first.timestamp) / YEAR_MS;

  // Compound the growth rates over the intervals
  const compoundGrowthFactor = points.reduce((acc, p, i) => {
    const prev = points[i - 1];
    if (!prev) return 1;
    return acc * Math.pow(1 + prev.gdpGrowth / 100, (p.timestamp - prev.timestamp) / YEAR_MS);
  }, 1);

  const values = points.map((p) => p.totalGdp);
  const growthValues = points.map((p) => p.gdpGrowth);
  const meanGrowth = growthValues.reduce((a, b) => a + b, 0) / growthValues.length;
  const volatility =
    growthValues.length > 1
      ? Math.sqrt(
          growthValues.reduce((acc, val) => acc + Math.pow(val - meanGrowth, 2), 0) /
            (growthValues.length - 1)
        )
      : 0;

  return {
    growth,
    totalGrowth: (compoundGrowthFactor - 1) * 100,
    avgGrowth:
      yearsElapsed > 0.05 ? (Math.pow(compoundGrowthFactor, 1 / yearsElapsed) - 1) * 100 : growth,
    maxGdp: Math.max(...values),
    minGdp: Math.min(...values),
    volatility,
    dataPoints: points.length,
  };
}

type GdpStats = NonNullable<ReturnType<typeof computeGdpStats>>;

/** A percentage with the given precision, or "N/A" when the value is zero or missing. */
const percentOrNA = (value: number | undefined, digits: number) =>
  value ? `${value.toFixed(digits)}%` : "N/A";

function findTier(gdpPerCapita: number) {
  const index = GDP_TIERS.findIndex((tier) => gdpPerCapita >= tier.min && gdpPerCapita <= tier.max);
  return { index, current: GDP_TIERS[index], next: GDP_TIERS[index + 1] };
}

/** The trend chart in the chosen format; "composed" overlays growth-rate bars on a second axis. */
function GdpTrendChart({ data, chartType }: { data: GdpPoint[]; chartType: ChartType }) {
  const isComposed = chartType === "composed";
  const gradientColor = isComposed ? "var(--chart-1)" : AMBER;
  const series = {
    line: (
      <Line
        type="monotone"
        dataKey="totalGdp"
        stroke={AMBER}
        strokeWidth={3}
        dot={false}
        activeDot={{ r: 6 }}
        name="Total GDP (T)"
      />
    ),
    area: (
      <Area
        type="monotone"
        dataKey="totalGdp"
        stroke={AMBER}
        strokeWidth={2.5}
        fillOpacity={1}
        fill="url(#gdpColor)"
        name="Total GDP (T)"
      />
    ),
    bar: <Bar dataKey="totalGdp" fill={AMBER} name="Total GDP (T)" radius={[4, 4, 0, 0]} />,
    composed: (
      <>
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="totalGdp"
          stroke="var(--chart-1)"
          fillOpacity={1}
          fill="url(#gdpColor)"
          name="Total GDP (T)"
        />
        <Bar
          yAxisId="right"
          dataKey="gdpGrowth"
          fill={AMBER}
          name="Growth Rate %"
          radius={[2, 2, 0, 0]}
        />
      </>
    ),
  };

  return (
    <ComposedChart data={data}>
      {(chartType === "area" || isComposed) && (
        <defs>
          <linearGradient id="gdpColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={gradientColor} stopOpacity={isComposed ? 0.2 : 0.25} />
            <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
      <XAxis dataKey="date" stroke="var(--color-label-secondary)" />
      <YAxis yAxisId={isComposed ? "left" : undefined} stroke="var(--color-label-secondary)" />
      {isComposed && (
        <YAxis yAxisId="right" orientation="right" stroke="var(--color-label-secondary)" />
      )}
      <ChartTooltip content={<ChartTooltipContent />} />
      {isComposed && <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />}
      {series[chartType]}
    </ComposedChart>
  );
}

interface TabProps {
  country: CountryData;
  formatCurrency: (value: number) => string;
}

function GdpOverview({ country, stats, formatCurrency }: TabProps & { stats: GdpStats | null }) {
  const tier = findTier(country.currentGdpPerCapita);

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          icon={BarChart3}
          title="GDP performance summary"
          subtitle="Key performance indicators and historical volatility metrics. Volatility / Peak-Trough / Total Growth merged from former Details tab."
          contentClassName="flex flex-1 flex-col justify-center"
        >
          <MetricModalLayout.TileGrid columns="grid-cols-2 md:grid-cols-3">
            <MetricModalLayout.Tile
              labelStyle="footnote"
              value={percentOrNA(stats?.avgGrowth, 2)}
              label="Avg annual growth"
            />
            <MetricModalLayout.Tile
              labelStyle="footnote"
              value={percentOrNA(stats?.volatility, 2)}
              label="GDP volatility"
            />
            <MetricModalLayout.Tile
              labelStyle="footnote"
              tone="text-green"
              value={formatCurrency((stats?.maxGdp || 0) * 1e12)}
              label="Peak GDP"
            />
            <MetricModalLayout.Tile
              labelStyle="footnote"
              tone="text-green"
              value={percentOrNA(stats?.totalGrowth, 1)}
              label="Total growth"
            />
            <MetricModalLayout.Tile
              labelStyle="footnote"
              value={
                stats
                  ? `${(((stats.maxGdp - stats.minGdp) / stats.maxGdp) * 100).toFixed(1)}%`
                  : "N/A"
              }
              label="Peak-to-Trough"
            />
            <MetricModalLayout.Tile
              labelStyle="footnote"
              value={stats?.dataPoints || 0}
              label="Data points"
            />
          </MetricModalLayout.TileGrid>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.StatCard
          label="Current GDP"
          value={(country.currentTotalGdp || 0) / 1e12}
          prefix="$"
          suffix=" T"
          decimalPlaces={2}
          icon={DollarSign}
          variant="economy"
        />
        <MetricModalLayout.StatCard
          label="GDP per capita"
          value={country.currentGdpPerCapita || 0}
          prefix="$"
          icon={Calculator}
          variant="economy"
        />
        <MetricModalLayout.StatCard
          label="Growth rate"
          value={stats?.growth || 0}
          suffix="%"
          decimalPlaces={2}
          icon={LineChart}
          variant="economy"
        />
        <MetricModalLayout.Classification
          bordered={false}
          label="Economic tier"
          description="Determines national economic classification, simulation capacities, and growth caps."
        >
          <Badge className={`text-headline ${tier.current?.color}`} variant="secondary">
            {country.economicTier || "Unknown"}
          </Badge>
        </MetricModalLayout.Classification>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function GdpTrends({
  data,
  chartType,
  stats,
  formatCurrency,
}: Pick<TabProps, "formatCurrency"> & {
  data: GdpPoint[];
  chartType: ChartType;
  stats: GdpStats | null;
}) {
  if (data.length === 0) {
    return (
      <MetricModalLayout.Empty
        icon={LineChart}
        message="No historical data available"
        hint="GDP history is recorded as the economy updates."
      />
    );
  }

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          className=""
          contentClassName=""
          title="GDP historical trends"
          subtitle={`GDP development over time with ${data.length} data points`}
        >
          <ChartContainer config={CHART_CONFIG} className="h-[350px] w-full">
            <GdpTrendChart data={data} chartType={chartType} />
          </ChartContainer>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.Highlights>
          <MetricModalLayout.Highlight
            label="Avg growth"
            value={percentOrNA(stats?.avgGrowth, 2)}
          />
          <MetricModalLayout.Highlight
            label="Peak GDP"
            tone="text-green"
            value={formatCurrency((stats?.maxGdp || 0) * 1e12)}
          />
          <MetricModalLayout.Highlight
            label="Volatility factor"
            value={percentOrNA(stats?.volatility, 2)}
          />
        </MetricModalLayout.Highlights>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function NextTierCard({ country, formatCurrency }: TabProps) {
  const { current, next } = findTier(country.currentGdpPerCapita);
  if (!current) return "N/A";

  if (!next) {
    return (
      <div className="text-green text-center">
        <p className="font-semibold">Maximum Tier Achieved!</p>
        <p className="text-label-secondary text-footnote mt-1">
          Your economy has reached the highest classification
        </p>
      </div>
    );
  }

  const needed = next.min - (country.currentGdpPerCapita || 0);
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-title-3">{next.name}</span>
        <Badge variant="warning">Next level</Badge>
      </div>
      <p className="text-label-secondary text-footnote">Minimum: {formatCurrency(next.min)}</p>
      <p className="text-label-secondary text-footnote mt-1">
        Need: {needed > 0 ? formatCurrency(needed) + " more" : "Already qualified"}
      </p>
    </>
  );
}

function GdpComparison({
  country,
  globalStats,
  formatCurrency,
}: TabProps & { globalStats: GlobalStats | undefined }) {
  const { current } = findTier(country.currentGdpPerCapita);
  const tierRank = GDP_TIERS.findIndex((t) => t.name === country.economicTier) + 1;

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          className=""
          contentClassName=""
          icon={Info}
          title="Economic tier analysis"
          subtitle="Understanding your economic classification and growth potential"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-headline">Current economic tier</h4>
              <Card variant="inset" padding="none" className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-title-3">{country.economicTier}</span>
                  <Badge className={current?.color} variant="secondary">
                    {current?.name}
                  </Badge>
                </div>
                <p className="text-label-secondary text-footnote">
                  GDP per Capita: {formatCurrency(country.currentGdpPerCapita || 0)}
                </p>
                <p className="text-label-secondary text-footnote mt-1">
                  Range:{" "}
                  {current
                    ? `${formatCurrency(current.min)} - ${
                        current.max === Infinity ? "∞" : formatCurrency(current.max)
                      }`
                    : "N/A"}
                </p>
              </Card>
            </div>
            <div className="space-y-3">
              <h4 className="text-headline">Next tier target</h4>
              <Card
                variant="inset"
                padding="none"
                className="flex min-h-[106px] flex-col justify-center p-4"
              >
                <NextTierCard country={country} formatCurrency={formatCurrency} />
              </Card>
            </div>
          </div>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        {globalStats && (
          <MetricModalLayout.Highlights className="flex h-full flex-col justify-between gap-4">
            <MetricModalLayout.Highlight
              label="vs Global Avg GDP/Capita"
              value={
                country.currentGdpPerCapita && globalStats.avgGdpPerCapita > 0
                  ? `${((country.currentGdpPerCapita / globalStats.avgGdpPerCapita - 1) * 100).toFixed(1)}%`
                  : "N/A"
              }
              note={`Avg: ${formatCurrency(globalStats.avgGdpPerCapita)}`}
            />
            <MetricModalLayout.Highlight label="Economic tier rank" value={`${tierRank || 0}/7`} />
            <MetricModalLayout.Highlight
              label="Global GDP share"
              value={
                country.currentTotalGdp && globalStats.totalGdp > 0
                  ? `${((country.currentTotalGdp / globalStats.totalGdp) * 100).toFixed(3)}%`
                  : "N/A"
              }
              note={`Global: ${formatCurrency(globalStats.totalGdp / 1e12)}T`}
            />
          </MetricModalLayout.Highlights>
        )}
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

export function GdpDetailsModal({ isOpen, onClose, countryId, countryName }: GdpDetailsModalProps) {
  const enabled = !!countryId && isOpen;
  const {
    data: countryData,
    isLoading: countryLoading,
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery({ id: countryId }, { enabled });
  const { data: historicalData, isLoading: historicalLoading } =
    api.historical.getCountryHistory.useQuery({ countryId }, { enabled });
  const { data: globalStats, isLoading: globalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const isLoading = countryLoading || historicalLoading || globalLoading;

  const processHistoricalData = (timeRange: TimeRange) =>
    filterAndSortHistory(
      historicalData,
      timeRange,
      (point, _, rawTimestamp) => toGdpPoint(point, rawTimestamp),
      365
    );

  // Summary statistics use a 5y window to match the Population modal's default.
  const stats = computeGdpStats(processHistoricalData("5y"));

  const currency = countryData?.nationalIdentity?.currency || countryData?.currency || "USD";
  const formatCurrency = (value: number) => formatCompactCurrency(value, "N/A", currency);

  const renderTab = (tab: string, timeRange: TimeRange, chartType: ChartType) => {
    if (tab === "trends") {
      return historicalLoading ? (
        <MetricModalLayout.Loading variant="economy" mainHeight={400} sidebarCards={0} />
      ) : (
        <GdpTrends
          data={processHistoricalData(timeRange)}
          chartType={chartType}
          stats={stats}
          formatCurrency={formatCurrency}
        />
      );
    }
    if (isLoading) {
      return (
        <MetricModalLayout.Loading
          variant="economy"
          mainHeight={tab === "overview" ? 300 : 400}
          sidebarCards={tab === "overview" ? 3 : 0}
        />
      );
    }
    if (!countryData) {
      return <MetricModalLayout.Empty icon={DollarSign} message="Country data unavailable" />;
    }
    if (tab === "overview") {
      return <GdpOverview country={countryData} stats={stats} formatCurrency={formatCurrency} />;
    }
    if (tab === "comparison") {
      return (
        <GdpComparison
          country={countryData}
          globalStats={globalStats}
          formatCurrency={formatCurrency}
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
      title="GDP analysis"
      description="Historical trends, projections and economic insights"
      icon={DollarSign}
      iconColor="text-green"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="economy"
      persistKey="ixstats:gdp-analysis"
      defaultTimeRange="5y"
    >
      {renderTab}
    </BaseMetricDetailsModal>
  );
}
