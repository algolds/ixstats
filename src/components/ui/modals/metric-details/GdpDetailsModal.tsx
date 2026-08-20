// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import { formatCompactCurrency } from "~/lib/utils";
import {
  DollarSign,
  Calculator,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Globe,
  Info,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
  Tooltip,
  Legend,
} from "recharts";
import { format, subMonths } from "date-fns";
import {
  BaseMetricDetailsModal,
  type MetricModalTab,
} from "./BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";

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
  { id: "details", label: "Details", icon: Info },
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

  // Process historical data for charts
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

    const now = new Date();
    const rangeMap = {
      "3m": 3,
      "6m": 6,
      "1y": 12,
      "2y": 24,
      "5y": 60,
      all: Infinity,
    };

    const monthsToShow = rangeMap[timeRange] || 12;
    const cutoffDate = monthsToShow === Infinity ? new Date(0) : subMonths(now, monthsToShow);

    return historicalData
      .filter((point: any) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .slice(-100)
      .map((point: any, index: number) => ({
        period: index + 1,
        date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
        timestamp: point.ixTimeTimestamp,
        totalGdp: point.totalGdp / 1e12,
        gdpPerCapita: point.gdpPerCapita,
        gdpGrowth: (() => {
          const rate =
            point.gdpGrowthRate !== undefined ? point.gdpGrowthRate : point.gdpGrowth || 0;
          const abs = Math.abs(rate);
          if (abs < 0.01) {
            return rate * 2500;
          } else if (abs <= 0.5) {
            return rate * 100;
          } else {
            return rate;
          }
        })(),
        realGdp: point.totalGdp / 1e12,
        nominalGdp: point.totalGdp / 1e12,
      }))
      .sort(
        (a: any, b: any) =>
          (new Date(a.timestamp).getTime() ?? 0) - (new Date(b.timestamp).getTime() ?? 0)
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

  // Default processed data and stats for overview (1y range)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultProcessedData = useMemo(() => processHistoricalData("1y"), [historicalData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gdpStats = useMemo(() => createGdpStats(defaultProcessedData), [defaultProcessedData]);

  // Economic tier information
  const tierInfo = useMemo(() => {
    if (!countryData) return null;

    const tiers = [
      { name: "Impoverished", min: 0, max: 9999, color: "text-red-600" },
      { name: "Developing", min: 10000, max: 24999, color: "text-orange-600" },
      { name: "Developed", min: 25000, max: 34999, color: "text-yellow-600" },
      { name: "Healthy", min: 35000, max: 44999, color: "text-green-600" },
      { name: "Strong", min: 45000, max: 54999, color: "text-blue-600" },
      { name: "Very Strong", min: 55000, max: 64999, color: "text-indigo-600" },
      { name: "Extravagant", min: 65000, max: Infinity, color: "text-purple-600" },
    ];

    const currentTier = tiers.find(
      (tier) =>
        countryData.currentGdpPerCapita >= tier.min && countryData.currentGdpPerCapita <= tier.max
    );

    return { currentTier, allTiers: tiers };
  }, [countryData]);

  const chartConfig = {
    totalGdp: { label: "Total GDP (Trillions)", color: "#2563eb" },
    gdpPerCapita: { label: "GDP per Capita", color: "#dc2626" },
    gdpGrowth: { label: "GDP Growth %", color: "#16a34a" },
    realGdp: { label: "Real GDP (Trillions)", color: "#7c3aed" },
    nominalGdp: { label: "Nominal GDP (Trillions)", color: "#ea580c" },
  };

  const getTrendIcon = (value: number) => {
    return value > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : value < 0 ? (
      <TrendingDown className="h-4 w-4 text-red-500" />
    ) : (
      <BarChart3 className="h-4 w-4 text-gray-500" />
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
      case "details":
        return renderDetailsTab();
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
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                GDP Performance Summary
              </CardTitle>
              <CardDescription>
                Key performance indicators and historical volatility metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-amber-500">
                    {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Avg Annual Growth</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {gdpStats?.volatility ? `${gdpStats.volatility.toFixed(2)}%` : "N/A"}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">GDP Volatility</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-emerald-400">
                    {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Peak GDP</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-blue-400">{gdpStats?.dataPoints || 0}</div>
                  <div className="text-muted-foreground mt-1 text-xs">Data Points</div>
                </div>
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

          <div className="facet-refraction relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div>
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Economic Tier
              </span>
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
        <Card className="facet-refraction border-white/5">
          <CardContent className="py-12 text-center">
            <LineChart className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">No historical data available</p>
            <p className="text-muted-foreground text-sm">
              Data points will appear as the economic system generates history
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>GDP Historical Trends</CardTitle>
              <CardDescription>
                GDP development over time with {processedData.length} data points
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                {chartType === "line" && (
                  <RechartsLineChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="facet-floating facet-refraction rounded-xl border border-white/10 bg-black/80" />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="totalGdp"
                      stroke="#fbbf24"
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
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="facet-floating facet-refraction rounded-xl border border-white/10 bg-black/80" />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="totalGdp"
                      stroke="#fbbf24"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gdpColor)"
                      name="Total GDP (T)"
                    />
                  </AreaChart>
                )}
                {chartType === "bar" && (
                  <BarChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="facet-floating facet-refraction rounded-xl border border-white/10 bg-black/80" />
                      }
                    />
                    <Bar
                      dataKey="totalGdp"
                      fill="#fbbf24"
                      name="Total GDP (T)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
                {chartType === "composed" && (
                  <ComposedChart data={processedData}>
                    <defs>
                      <linearGradient id="realGdpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" />
                    <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.3)" />
                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.3)" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="facet-floating facet-refraction rounded-xl border border-white/10 bg-black/80" />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="realGdp"
                      stroke="#7c3aed"
                      fillOpacity={1}
                      fill="url(#realGdpGrad)"
                      name="Real GDP (T)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="nominalGdp"
                      stroke="#ea580c"
                      strokeWidth={2}
                      dot={false}
                      name="Nominal GDP (T)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="gdpGrowth"
                      fill="#fbbf24"
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
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Avg Growth
              </span>
              <span className="text-xl font-bold text-amber-500">
                {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Peak GDP
              </span>
              <span className="text-xl font-bold text-emerald-400">
                {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Volatility Factor
              </span>
              <span className="text-xl font-bold text-purple-400">
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
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-500" />
                Economic Tier Analysis
              </CardTitle>
              <CardDescription>
                Understanding your economic classification and growth potential
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Current Economic Tier</h4>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-4">
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
                  <div className="flex min-h-[106px] flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
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
                                  <Badge
                                    variant="outline"
                                    className="border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
                                  >
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
                              <div className="text-center text-green-500">
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
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          {globalStats && (
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                  vs Global Avg GDP/Capita
                </span>
                <span className="text-xl font-bold text-cyan-400">
                  {countryData?.currentGdpPerCapita &&
                  typeof globalStats === "object" &&
                  globalStats !== null &&
                  "averageGdpPerCapita" in globalStats &&
                  typeof (globalStats as any).averageGdpPerCapita === "number"
                    ? `${((countryData.currentGdpPerCapita / (globalStats as any).averageGdpPerCapita - 1) * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
                <span className="text-muted-foreground mt-1 text-[10px]">
                  Avg: {formatCurrency((globalStats as any).averageGdpPerCapita)}
                </span>
              </div>
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                  Economic Tier Rank
                </span>
                <span className="text-xl font-bold text-amber-500">
                  {tierInfo?.allTiers
                    ? tierInfo.allTiers.findIndex((t) => t.name === countryData?.economicTier) +
                        1 || 0
                    : 0}
                  /7
                </span>
              </div>
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                  Global GDP Share
                </span>
                <span className="text-xl font-bold text-purple-400">
                  {countryData?.currentTotalGdp &&
                  typeof globalStats === "object" &&
                  globalStats !== null &&
                  "totalGdp" in globalStats &&
                  typeof (globalStats as any).totalGdp === "number"
                    ? `${((countryData.currentTotalGdp / (globalStats as any).totalGdp) * 100).toFixed(3)}%`
                    : "N/A"}
                </span>
                <span className="text-muted-foreground mt-1 text-[10px]">
                  Global: {formatCurrency((globalStats as any).totalGdp / 1e12)}T
                </span>
              </div>
            </div>
          )}
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderDetailsTab = () => {
    if (isLoading) {
      return (
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[300px] w-full" />
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
          <div className="space-y-6">
            <Card className="facet-refraction border-white/5 p-6">
              <CardHeader className="mb-4 p-0">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  GDP Projections
                </CardTitle>
                <CardDescription>Economic forecasting and growth scenarios</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Alert className="border-amber-500/20 bg-amber-500/5 text-amber-500">
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                    Advanced GDP projection models are available through the Predictive Models
                    feature in the premium analytics suite. These include multi-scenario forecasting
                    with confidence intervals based on historical patterns and economic indicators.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Alert className="border-white/5 bg-white/5">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                Economic tier classifications are based on GDP per capita and determine growth rate
                caps in the IxStats system. Higher tiers indicate more mature economies with
                typically lower but more stable growth rates.
              </AlertDescription>
            </Alert>
          </div>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          {gdpStats && (
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-2xl font-bold text-amber-500">
                  {gdpStats.volatility.toFixed(2)}%
                </span>
                <span className="mt-1 text-sm font-medium">GDP Volatility</span>
                <span className="text-muted-foreground mt-0.5 text-[10px]">
                  {gdpStats.volatility < 5
                    ? "Very Stable"
                    : gdpStats.volatility < 10
                      ? "Stable"
                      : gdpStats.volatility < 20
                        ? "Moderate"
                        : "High Volatility"}
                </span>
              </div>
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-2xl font-bold text-emerald-400">
                  {gdpStats.totalGrowth.toFixed(1)}%
                </span>
                <span className="mt-1 text-sm font-medium">Total Growth</span>
                <span className="text-muted-foreground mt-0.5 text-[10px]">
                  Over selected period
                </span>
              </div>
              <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
                <span className="text-2xl font-bold text-purple-400">
                  {(((gdpStats.maxGdp - gdpStats.minGdp) / gdpStats.maxGdp) * 100).toFixed(1)}%
                </span>
                <span className="mt-1 text-sm font-medium">Peak-to-Trough</span>
                <span className="text-muted-foreground mt-0.5 text-[10px]">Maximum variance</span>
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
      iconColor="text-green-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="economy"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default GdpDetailsModal;
