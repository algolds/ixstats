"use client";

import React, { useMemo } from "react";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import {
  Dollar as DollarSign,
  Calculator,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  InfoCircle as Info,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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

/**
 * GdpDetailsModal - Detailed GDP analysis with historical trends and projections
 *
 * Displays:
 * - Overview: Current GDP, per capita, growth rate, economic tier
 * - Trends: Historical GDP charts with time range and chart type controls
 * - Comparison: Global benchmarking and tier analysis
 * - Details: GDP stability analysis and projections
 */
export function GdpDetailsModal({ isOpen, onClose, countryId, countryName }: GdpDetailsModalProps) {
  // Fetch country economic data
  const {
    data: countryData,
    isLoading: countryLoading,
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId && isOpen }
  );

  // Fetch historical data
  const { data: historicalData, isLoading: historicalLoading } =
    api.historical.getCountryHistory.useQuery({ countryId }, { enabled: !!countryId && isOpen });

  // Fetch global stats for comparison
  const { data: globalStats, isLoading: globalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const isLoading = countryLoading || historicalLoading || globalLoading;

  // Process historical data for charts - IxTime-aware cutoff (not real subMonths)
  const processHistoricalData = (timeRange: TimeRange) => {
    return filterAndSortHistory(
      historicalData,
      timeRange,
      (point, _, rawTimestamp) => {
        const tsNum =
          typeof rawTimestamp === "number" ? rawTimestamp : new Date(rawTimestamp).getTime();
        return {
          period: 1,
          date: format(new Date(tsNum), "MMM yyyy"),
          timestamp: tsNum,
          totalGdp: (point.totalGdp || 0) / 1e12,
          gdpPerCapita: point.gdpPerCapita,
          gdpGrowth: (() => {
            const rate = point.gdpGrowthRate ?? 0;
            const abs = Math.abs(rate);
            if (abs < 0.01) return rate * 100;
            if (abs <= 0.5) return rate * 100;
            return rate;
          })(),
        };
      },
      365
    );
  };

  // Calculate GDP statistics from processed data
  const createGdpStats = (processedData: ReturnType<typeof processHistoricalData>) => {
    if (!processedData || processedData.length === 0) return null;

    const current = processedData[processedData.length - 1];
    const firstPoint = processedData[0];

    const growth = current?.gdpGrowth || 0;

    const firstTimestamp = new Date(firstPoint.timestamp).getTime();
    const currentTimestamp = new Date(current.timestamp).getTime();
    const yearsElapsed = (currentTimestamp - firstTimestamp) / (365.25 * 24 * 60 * 60 * 1000);

    // Compound the growth rates over the intervals
    const compoundGrowthFactor = processedData.reduce((acc, p, i) => {
      if (i === 0) return 1;
      const prev = processedData[i - 1];
      const dt =
        (new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000);
      return acc * Math.pow(1 + prev.gdpGrowth / 100, dt);
    }, 1);

    const totalGrowth = (compoundGrowthFactor - 1) * 100;
    const avgGrowth =
      yearsElapsed > 0.05 ? (Math.pow(compoundGrowthFactor, 1 / yearsElapsed) - 1) * 100 : growth;

    const values = processedData.map((p) => p.totalGdp);
    const maxGdp = Math.max(...values);
    const minGdp = Math.min(...values);

    const growthValues = processedData.map((p) => p.gdpGrowth);
    const meanGrowth = growthValues.reduce((a, b) => a + b, 0) / growthValues.length;
    const volatility =
      growthValues.length > 1
        ? Math.sqrt(
            growthValues.reduce((acc, val) => acc + Math.pow(val - meanGrowth, 2), 0) /
              (growthValues.length - 1)
          )
        : 0;

    return {
      current: current?.totalGdp || 0,
      growth,
      totalGrowth,
      avgGrowth,
      maxGdp,
      minGdp,
      volatility,
      dataPoints: processedData.length,
    };
  };

  // Default stats use 5y window to match Population modal + new default
  // oxlint-disable-next-line
  const defaultProcessedData = useMemo(() => processHistoricalData("5y"), [historicalData]);
  const gdpStats = useMemo(() => createGdpStats(defaultProcessedData), [defaultProcessedData]);

  // Economic tier information
  const tierInfo = useMemo(() => {
    if (!countryData) return null;

    const tiers = [
      { name: "Impoverished", min: 0, max: 9999, color: "text-destructive" },
      { name: "Developing", min: 10000, max: 24999, color: "text-yellow" },
      { name: "Developed", min: 25000, max: 34999, color: "text-yellow" },
      { name: "Healthy", min: 35000, max: 44999, color: "text-green" },
      { name: "Strong", min: 45000, max: 54999, color: "text-label" },
      { name: "Very Strong", min: 55000, max: 64999, color: "text-label" },
      { name: "Extravagant", min: 65000, max: Infinity, color: "text-label" },
    ];

    const currentTier = tiers.find(
      (tier) =>
        countryData.currentGdpPerCapita >= tier.min && countryData.currentGdpPerCapita <= tier.max
    );

    return { currentTier, allTiers: tiers };
  }, [countryData]);

  const chartConfig = {
    totalGdp: { label: "Total GDP (Trillions)", color: "var(--color-blue-500)" },
    gdpPerCapita: { label: "GDP per capita", color: "var(--color-destructive)" },
    gdpGrowth: { label: "GDP Growth %", color: "var(--chart-3)" },
  };

  // oxlint-disable-next-line eslint/no-unused-vars
  const getTrendIcon = (value: number) => {
    return value > 0 ? (
      <TrendingUp className="text-green h-4 w-4" />
    ) : value < 0 ? (
      <TrendingDown className="text-destructive h-4 w-4" />
    ) : (
      <BarChart3 className="text-label-secondary h-4 w-4" />
    );
  };

  const formatCurrency = (value: number) => {
    const currency = countryData?.nationalIdentity?.currency || countryData?.currency || "USD";
    return formatCompactCurrency(value, "N/A", currency);
  };

  const renderTabContent = (activeTab: string, timeRange: TimeRange, chartType: ChartType) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "trends":
        return renderTrendsTab(timeRange, chartType);
      case "comparison":
        return renderComparisonTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (isLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={300} sidebarCards={3} />;
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <BarChart3 className="text-label-secondary h-5 w-5" />
                GDP performance summary
              </h3>
              <p className="text-label-secondary text-body">
                Key performance indicators and historical volatility metrics. Volatility /
                Peak-Trough / Total Growth merged from former Details tab.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Avg annual growth</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {gdpStats?.volatility ? `${gdpStats.volatility.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">GDP volatility</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Peak GDP</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {gdpStats?.totalGrowth ? `${gdpStats.totalGrowth.toFixed(1)}%` : "N/A"}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Total growth</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {gdpStats
                      ? `${(((gdpStats.maxGdp - gdpStats.minGdp) / gdpStats.maxGdp) * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Peak-to-Trough</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{gdpStats?.dataPoints || 0}</div>
                  <div className="text-label-secondary text-footnote mt-1">Data points</div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Current GDP"
            value={(countryData?.currentTotalGdp || 0) / 1e12}
            prefix="$"
            suffix=" T"
            decimalPlaces={2}
            icon={DollarSign}
            variant="economy"
          />

          <MetricModalLayout.StatCard
            label="GDP per capita"
            value={countryData?.currentGdpPerCapita || 0}
            prefix="$"
            icon={Calculator}
            variant="economy"
          />

          <MetricModalLayout.StatCard
            label="Growth rate"
            value={gdpStats?.growth || 0}
            suffix="%"
            decimalPlaces={2}
            icon={LineChart}
            variant="economy"
          />

          <div className="bg-fill-3 rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden p-4">
            <div>
              <span className="text-stat-label text-label-secondary">Economic tier</span>
              <div className="mt-2">
                <Badge
                  className={`text-headline ${tierInfo?.currentTier?.color}`}
                  variant="secondary"
                >
                  {countryData?.economicTier || "Unknown"}
                </Badge>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-4 leading-relaxed">
              Determines national economic classification, simulation capacities, and growth caps.
            </p>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange, chartType: ChartType) => {
    const processedData = processHistoricalData(timeRange);

    if (historicalLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={400} sidebarCards={0} />;
    }

    if (processedData.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <LineChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No historical data available</p>
            <p className="text-label-secondary text-body">
              GDP history is recorded as the economy updates.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">GDP historical trends</h3>
              <p className="text-label-secondary text-body">
                GDP development over time with {processedData.length} data points
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                {chartType === "line" && (
                  <RechartsLineChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" />
                    <YAxis stroke="var(--color-label-secondary)" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="totalGdp"
                      stroke="var(--color-amber-500)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Total GDP (T)"
                    />
                  </RechartsLineChart>
                )}
                {chartType === "area" && (
                  <AreaChart data={processedData}>
                    <defs>
                      <linearGradient id="gdpColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amber-500)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-amber-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" />
                    <YAxis stroke="var(--color-label-secondary)" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="totalGdp"
                      stroke="var(--color-amber-500)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gdpColor)"
                      name="Total GDP (T)"
                    />
                  </AreaChart>
                )}
                {chartType === "bar" && (
                  <BarChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" />
                    <YAxis stroke="var(--color-label-secondary)" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="totalGdp"
                      fill="var(--color-amber-500)"
                      name="Total GDP (T)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
                {chartType === "composed" && (
                  <ComposedChart data={processedData}>
                    <defs>
                      <linearGradient id="totalGdpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" />
                    <YAxis yAxisId="left" stroke="var(--color-label-secondary)" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--color-label-secondary)"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalGdp"
                      stroke="var(--chart-1)"
                      fillOpacity={1}
                      fill="url(#totalGdpGrad)"
                      name="Total GDP (T)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="gdpGrowth"
                      fill="var(--color-amber-500)"
                      name="Growth Rate %"
                      radius={[2, 2, 0, 0]}
                    />
                  </ComposedChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Avg growth</span>
              <span className="text-label text-title-2">
                {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Peak GDP</span>
              <span className="text-title-2 text-green">
                {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Volatility factor
              </span>
              <span className="text-label text-title-2">
                {gdpStats?.volatility ? `${gdpStats.volatility.toFixed(2)}%` : "N/A"}
              </span>
            </div>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderComparisonTab = () => {
    if (isLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={400} sidebarCards={0} />;
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Info className="text-label-secondary h-5 w-5" />
                Economic tier analysis
              </h3>
              <p className="text-label-secondary text-body">
                Understanding your economic classification and growth potential
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-headline">Current economic tier</h4>
                  <Card variant="inset" padding="none" className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-title-3">{countryData?.economicTier}</span>
                      <Badge className={tierInfo?.currentTier?.color} variant="secondary">
                        {tierInfo?.currentTier?.name}
                      </Badge>
                    </div>
                    <p className="text-label-secondary text-footnote">
                      GDP per Capita: {formatCurrency(countryData?.currentGdpPerCapita || 0)}
                    </p>
                    <p className="text-label-secondary text-footnote mt-1">
                      Range:{" "}
                      {tierInfo?.currentTier
                        ? `${formatCurrency(tierInfo.currentTier.min)} - ${
                            tierInfo.currentTier.max === Infinity
                              ? "∞"
                              : formatCurrency(tierInfo.currentTier.max)
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
                    {tierInfo?.currentTier && tierInfo.allTiers
                      ? (() => {
                          const currentIndex = tierInfo.allTiers.findIndex(
                            (t) => t.name === tierInfo.currentTier?.name
                          );
                          const nextTier = tierInfo.allTiers[currentIndex + 1];

                          if (nextTier) {
                            const needed = nextTier.min - (countryData?.currentGdpPerCapita || 0);
                            return (
                              <>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-title-3">{nextTier.name}</span>
                                  <Badge variant="warning">Next level</Badge>
                                </div>
                                <p className="text-label-secondary text-footnote">
                                  Minimum: {formatCurrency(nextTier.min)}
                                </p>
                                <p className="text-label-secondary text-footnote mt-1">
                                  Need:{" "}
                                  {needed > 0
                                    ? formatCurrency(needed) + " more"
                                    : "Already qualified"}
                                </p>
                              </>
                            );
                          } else {
                            return (
                              <div className="text-green text-center">
                                <p className="font-semibold">Maximum Tier Achieved!</p>
                                <p className="text-label-secondary text-footnote mt-1">
                                  Your economy has reached the highest classification
                                </p>
                              </div>
                            );
                          }
                        })()
                      : "N/A"}
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          {globalStats && (
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
                <span className="text-stat-label text-label-secondary mb-1 block">
                  vs Global Avg GDP/Capita
                </span>
                <span className="text-label text-title-2">
                  {countryData?.currentGdpPerCapita && globalStats.avgGdpPerCapita > 0
                    ? `${((countryData.currentGdpPerCapita / globalStats.avgGdpPerCapita - 1) * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
                <span className="text-label-secondary text-footnote mt-1">
                  Avg: {formatCurrency(globalStats.avgGdpPerCapita)}
                </span>
              </div>
              <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
                <span className="text-stat-label text-label-secondary mb-1 block">
                  Economic tier rank
                </span>
                <span className="text-label text-title-2">
                  {tierInfo?.allTiers
                    ? tierInfo.allTiers.findIndex((t) => t.name === countryData?.economicTier) +
                        1 || 0
                    : 0}
                  /7
                </span>
              </div>
              <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
                <span className="text-stat-label text-label-secondary mb-1 block">
                  Global GDP share
                </span>
                <span className="text-label text-title-2">
                  {countryData?.currentTotalGdp && globalStats.totalGdp > 0
                    ? `${((countryData.currentTotalGdp / globalStats.totalGdp) * 100).toFixed(3)}%`
                    : "N/A"}
                </span>
                <span className="text-label-secondary text-footnote mt-1">
                  Global: {formatCurrency(globalStats.totalGdp / 1e12)}T
                </span>
              </div>
            </div>
          )}
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
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
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}
