"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
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
import { FacetCard, FacetCardHeader, FacetCardContent } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
// oxlint-disable-next-line eslint/no-unused-vars
import { NumberFlowDisplay } from "~/components/ui/number-flow";
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
          realGdp: (point.totalGdp || 0) / 1e12,
          nominalGdp: (point.totalGdp || 0) / 1e12,
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
      { name: "Developing", min: 10000, max: 24999, color: "text-amber-500" },
      { name: "Developed", min: 25000, max: 34999, color: "text-amber-500" },
      { name: "Healthy", min: 35000, max: 44999, color: "text-emerald-500" },
      { name: "Strong", min: 45000, max: 54999, color: "text-foreground" },
      { name: "Very Strong", min: 55000, max: 64999, color: "text-foreground" },
      { name: "Extravagant", min: 65000, max: Infinity, color: "text-foreground" },
    ];

    const currentTier = tiers.find(
      (tier) =>
        countryData.currentGdpPerCapita >= tier.min && countryData.currentGdpPerCapita <= tier.max
    );

    return { currentTier, allTiers: tiers };
  }, [countryData]);

  const chartConfig = {
    totalGdp: { label: "Total GDP (Trillions)", color: "var(--color-blue-500)" },
    gdpPerCapita: { label: "GDP per Capita", color: "var(--destructive)" },
    gdpGrowth: { label: "GDP Growth %", color: "var(--chart-3)" },
    realGdp: { label: "Real GDP (Trillions)", color: "var(--chart-1)" },
    nominalGdp: { label: "Nominal GDP (Trillions)", color: "var(--chart-4)" },
  };

  // oxlint-disable-next-line eslint/no-unused-vars
  const getTrendIcon = (value: number) => {
    return value > 0 ? (
      <TrendingUp className="h-4 w-4 text-emerald-500" />
    ) : value < 0 ? (
      <TrendingDown className="text-destructive h-4 w-4" />
    ) : (
      <BarChart3 className="text-muted-foreground h-4 w-4" />
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
      return (
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[300px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="text-muted-foreground h-5 w-5" />
                GDP Performance Summary
              </h3>
              <p className="text-muted-foreground text-sm">
                Key performance indicators and historical volatility metrics. Volatility /
                Peak-Trough / Total Growth merged from former Details tab.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Avg Annual Growth</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {gdpStats?.volatility ? `${gdpStats.volatility.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">GDP Volatility</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Peak GDP</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    {gdpStats?.totalGrowth ? `${gdpStats.totalGrowth.toFixed(1)}%` : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Total Growth</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {gdpStats
                      ? `${(((gdpStats.maxGdp - gdpStats.minGdp) / gdpStats.maxGdp) * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Peak-to-Trough</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {gdpStats?.dataPoints || 0}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Data Points</div>
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>
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
            label="GDP per Capita"
            value={countryData?.currentGdpPerCapita || 0}
            prefix="$"
            icon={Calculator}
            variant="economy"
          />

          <MetricModalLayout.StatCard
            label="Growth Rate"
            value={gdpStats?.growth || 0}
            suffix="%"
            decimalPlaces={2}
            icon={LineChart}
            variant="economy"
          />

          <div className="bg-muted/50 relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden rounded-xl p-4">
            <div>
              <Eyebrow>Economic Tier</Eyebrow>
              <div className="mt-2">
                <Badge className={`text-sm font-semibold ${tierInfo?.currentTier?.color}`}>
                  {countryData?.economicTier || "Unknown"}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
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
      return (
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[400px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    if (processedData.length === 0) {
      return (
        <FacetCard surface="solid" className="rounded-xl">
          <FacetCardContent className="py-12 text-center">
            <LineChart className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">No historical data available</p>
            <p className="text-muted-foreground text-sm">
              Data points will appear as the economic system generates history
            </p>
          </FacetCardContent>
        </FacetCard>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard surface="solid" className="rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">GDP Historical Trends</h3>
              <p className="text-muted-foreground text-sm">
                GDP development over time with {processedData.length} data points
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                {chartType === "line" && (
                  <RechartsLineChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
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
                      <linearGradient id="realGdpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis yAxisId="left" stroke="var(--muted-foreground)" />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="realGdp"
                      stroke="var(--chart-1)"
                      fillOpacity={1}
                      fill="url(#realGdpGrad)"
                      name="Real GDP (T)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="nominalGdp"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      dot={false}
                      name="Nominal GDP (T)"
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
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Avg Growth</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Peak GDP</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Volatility Factor</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
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
      return (
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[400px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard surface="solid" className="rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Info className="text-muted-foreground h-5 w-5" />
                Economic Tier Analysis
              </h3>
              <p className="text-muted-foreground text-sm">
                Understanding your economic classification and growth potential
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Current Economic Tier</h4>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-base font-semibold">{countryData?.economicTier}</span>
                      <Badge className={tierInfo?.currentTier?.color}>
                        {tierInfo?.currentTier?.name}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      GDP per Capita: {formatCurrency(countryData?.currentGdpPerCapita || 0)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Range:{" "}
                      {tierInfo?.currentTier
                        ? `${formatCurrency(tierInfo.currentTier.min)} - ${
                            tierInfo.currentTier.max === Infinity
                              ? "∞"
                              : formatCurrency(tierInfo.currentTier.max)
                          }`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Next Tier Target</h4>
                  <div className="bg-muted/50 flex min-h-[106px] flex-col justify-center rounded-xl p-4">
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
                                  <span className="text-base font-semibold">{nextTier.name}</span>
                                  <Badge variant="outline" className="text-amber-500">
                                    Next Level
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                  Minimum: {formatCurrency(nextTier.min)}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Need:{" "}
                                  {needed > 0
                                    ? formatCurrency(needed) + " more"
                                    : "Already qualified!"}
                                </p>
                              </>
                            );
                          } else {
                            return (
                              <div className="text-center text-emerald-500">
                                <p className="font-semibold">Maximum Tier Achieved!</p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Your economy has reached the highest classification
                                </p>
                              </div>
                            );
                          }
                        })()
                      : "N/A"}
                  </div>
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          {globalStats && (
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
                <Eyebrow className="mb-1 block">vs Global Avg GDP/Capita</Eyebrow>
                <span className="text-foreground text-xl font-semibold">
                  {countryData?.currentGdpPerCapita && globalStats.avgGdpPerCapita > 0
                    ? `${((countryData.currentGdpPerCapita / globalStats.avgGdpPerCapita - 1) * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
                <span className="text-muted-foreground mt-1 text-xs">
                  Avg: {formatCurrency(globalStats.avgGdpPerCapita)}
                </span>
              </div>
              <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
                <Eyebrow className="mb-1 block">Economic Tier Rank</Eyebrow>
                <span className="text-foreground text-xl font-semibold">
                  {tierInfo?.allTiers
                    ? tierInfo.allTiers.findIndex((t) => t.name === countryData?.economicTier) +
                        1 || 0
                    : 0}
                  /7
                </span>
              </div>
              <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
                <Eyebrow className="mb-1 block">Global GDP Share</Eyebrow>
                <span className="text-foreground text-xl font-semibold">
                  {countryData?.currentTotalGdp && globalStats.totalGdp > 0
                    ? `${((countryData.currentTotalGdp / globalStats.totalGdp) * 100).toFixed(3)}%`
                    : "N/A"}
                </span>
                <span className="text-muted-foreground mt-1 text-xs">
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
      title="GDP Analysis"
      description="Comprehensive GDP analysis with historical trends, projections, and economic insights"
      icon={DollarSign}
      iconColor="text-emerald-500"
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

export default GdpDetailsModal;
