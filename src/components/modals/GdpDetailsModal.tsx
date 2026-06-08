// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import { formatCompactCurrency } from "~/lib/format-utils";
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
} from "./metric-details/BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./metric-details/types";

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
        gdpGrowth: point.gdpGrowth || 0,
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
    const previous = processedData[processedData.length - 2];
    const firstPoint = processedData[0];

    const growth =
      previous && current?.totalGdp && previous.totalGdp
        ? ((current.totalGdp - previous.totalGdp) / previous.totalGdp) * 100
        : 0;
    const totalGrowth =
      current?.totalGdp && firstPoint?.totalGdp
        ? ((current.totalGdp - firstPoint.totalGdp) / firstPoint.totalGdp) * 100
        : 0;
    const avgGrowth = (totalGrowth / processedData.length) * 12;

    const values = processedData.map((p) => p.totalGdp);
    const maxGdp = Math.max(...values);
    const minGdp = Math.min(...values);
    const volatility =
      values.length > 1
        ? Math.sqrt(
            values.reduce((acc, val, i, arr) => {
              if (i === 0) return 0;
              const change = (val - arr[i - 1]!) / arr[i - 1]!;
              return acc + Math.pow(change * 100, 2);
            }, 0) /
              (values.length - 1)
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
  const defaultProcessedData = useMemo(() => processHistoricalData("1y"), [historicalData]);
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Key GDP Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Current GDP</p>
                  <p className="text-2xl font-bold text-green-600">
                    $
                    <NumberFlowDisplay
                      value={(countryData?.currentTotalGdp || 0) / 1e12}
                      decimalPlaces={2}
                      className="inline"
                    />
                    T
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">GDP per Capita</p>
                  <p className="text-2xl font-bold text-blue-600">
                    $
                    <NumberFlowDisplay
                      value={countryData?.currentGdpPerCapita || 0}
                      decimalPlaces={0}
                      className="inline"
                    />
                  </p>
                </div>
                <Calculator className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Growth Rate</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">
                      {gdpStats?.growth ? (
                        <>
                          <NumberFlowDisplay
                            value={gdpStats.growth}
                            decimalPlaces={2}
                            className="inline"
                          />
                          %
                        </>
                      ) : (
                        "N/A"
                      )}
                    </p>
                    {gdpStats?.growth && getTrendIcon(gdpStats.growth)}
                  </div>
                </div>
                <LineChart className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Economic Tier</p>
                  <Badge className={`text-sm ${tierInfo?.currentTier?.color}`}>
                    {countryData?.economicTier || "Unknown"}
                  </Badge>
                </div>
                <Globe className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GDP Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              GDP Performance Summary
            </CardTitle>
            <CardDescription>Key performance indicators and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {gdpStats?.avgGrowth ? `${gdpStats.avgGrowth.toFixed(2)}%` : "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">Avg Annual Growth</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {gdpStats?.volatility ? `${gdpStats.volatility.toFixed(2)}%` : "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">GDP Volatility</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency((gdpStats?.maxGdp || 0) * 1e12)}
                </div>
                <div className="text-muted-foreground text-sm">Peak GDP</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {gdpStats?.dataPoints || 0}
                </div>
                <div className="text-muted-foreground text-sm">Data Points</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange, chartType: ChartType) => {
    const processedData = processHistoricalData(timeRange);

    if (historicalLoading) {
      return <Skeleton className="h-[400px]" />;
    }

    if (processedData.length === 0) {
      return (
        <Card>
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
      <Card>
        <CardHeader>
          <CardTitle>GDP Historical Trends</CardTitle>
          <CardDescription>
            GDP development over time with {processedData.length} data points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            {chartType === "line" && (
              <RechartsLineChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="totalGdp"
                  stroke={chartConfig.totalGdp.color}
                  strokeWidth={2}
                  name="Total GDP (T)"
                />
              </RechartsLineChart>
            )}
            {chartType === "area" && (
              <AreaChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="totalGdp"
                  stroke={chartConfig.totalGdp.color}
                  fill={chartConfig.totalGdp.color}
                  fillOpacity={0.3}
                  name="Total GDP (T)"
                />
              </AreaChart>
            )}
            {chartType === "bar" && (
              <BarChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="totalGdp"
                  fill={chartConfig.totalGdp.color}
                  name="Total GDP (T)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
            {chartType === "composed" && (
              <ComposedChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="realGdp"
                  stroke={chartConfig.realGdp.color}
                  fill={chartConfig.realGdp.color}
                  fillOpacity={0.3}
                  name="Real GDP (T)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="nominalGdp"
                  stroke={chartConfig.nominalGdp.color}
                  strokeWidth={2}
                  name="Nominal GDP (T)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="gdpGrowth"
                  fill={chartConfig.gdpGrowth.color}
                  name="Growth Rate %"
                  radius={[2, 2, 0, 0]}
                />
              </ComposedChart>
            )}
          </ChartContainer>
        </CardContent>
      </Card>
    );
  };

  const renderComparisonTab = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Global Comparison */}
        {globalStats && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-950/20">
                <div className="mb-1 text-lg font-semibold text-blue-600">
                  vs Global Avg GDP per Capita
                </div>
                <div className="text-2xl font-bold">
                  {countryData?.currentGdpPerCapita &&
                  typeof globalStats === "object" &&
                  globalStats !== null &&
                  "averageGdpPerCapita" in globalStats &&
                  typeof (globalStats as any).averageGdpPerCapita === "number"
                    ? `${((countryData.currentGdpPerCapita / (globalStats as any).averageGdpPerCapita - 1) * 100).toFixed(1)}%`
                    : "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">
                  Global Avg:{" "}
                  {typeof globalStats === "object" &&
                  globalStats !== null &&
                  "averageGdpPerCapita" in globalStats
                    ? formatCurrency((globalStats as any).averageGdpPerCapita)
                    : "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="rounded-lg bg-green-50 p-6 text-center dark:bg-green-950/20">
                <div className="mb-1 text-lg font-semibold text-green-600">Economic Tier Rank</div>
                <div className="text-2xl font-bold">
                  {tierInfo?.allTiers
                    ? tierInfo.allTiers.findIndex((t) => t.name === countryData?.economicTier) +
                        1 || 0
                    : 0}
                  /7
                </div>
                <div className="text-muted-foreground text-sm">Among global tiers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="rounded-lg bg-purple-50 p-6 text-center dark:bg-purple-950/20">
                <div className="mb-1 text-lg font-semibold text-purple-600">
                  GDP Share of Global
                </div>
                <div className="text-2xl font-bold">
                  {countryData?.currentTotalGdp &&
                  typeof globalStats === "object" &&
                  globalStats !== null &&
                  "totalGdp" in globalStats &&
                  typeof (globalStats as any).totalGdp === "number"
                    ? `${((countryData.currentTotalGdp / (globalStats as any).totalGdp) * 100).toFixed(3)}%`
                    : "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">
                  Global GDP:{" "}
                  {typeof globalStats === "object" &&
                  globalStats !== null &&
                  "totalGdp" in globalStats
                    ? formatCurrency((globalStats as any).totalGdp / 1e12)
                    : "N/A"}
                  T
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Economic Tier Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Economic Tier Analysis
            </CardTitle>
            <CardDescription>
              Understanding your economic classification and growth potential
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-semibold">Current Economic Tier</h4>
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{countryData?.economicTier}</span>
                    <Badge className={tierInfo?.currentTier?.color}>
                      {tierInfo?.currentTier?.name}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    GDP per Capita: {formatCurrency(countryData?.currentGdpPerCapita || 0)}
                  </p>
                  <p className="text-muted-foreground text-sm">
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
              <div>
                <h4 className="mb-3 font-semibold">Next Tier Target</h4>
                <div className="rounded-lg border p-4">
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
                                <span className="font-medium">{nextTier.name}</span>
                                <Badge variant="outline">Next Level</Badge>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                Minimum: {formatCurrency(nextTier.min)}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                Need:{" "}
                                {needed > 0
                                  ? formatCurrency(needed) + " more"
                                  : "Already qualified!"}
                              </p>
                            </>
                          );
                        } else {
                          return (
                            <div className="text-center text-green-600">
                              <p className="font-medium">Maximum Tier Achieved!</p>
                              <p className="text-sm">
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
      </div>
    );
  };

  const renderDetailsTab = () => {
    if (isLoading) {
      return <Skeleton className="h-80" />;
    }

    return (
      <div className="space-y-6">
        {/* GDP Stability Analysis */}
        {gdpStats && (
          <Card>
            <CardHeader>
              <CardTitle>GDP Stability Analysis</CardTitle>
              <CardDescription>Economic volatility and stability metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <div className="mb-2 text-2xl font-bold text-blue-600">
                    {gdpStats.volatility.toFixed(2)}%
                  </div>
                  <div className="mb-1 text-sm font-medium">GDP Volatility</div>
                  <div className="text-muted-foreground text-xs">
                    {gdpStats.volatility < 5
                      ? "Very Stable"
                      : gdpStats.volatility < 10
                        ? "Stable"
                        : gdpStats.volatility < 20
                          ? "Moderate"
                          : "High Volatility"}
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="mb-2 text-2xl font-bold text-green-600">
                    {gdpStats.totalGrowth.toFixed(1)}%
                  </div>
                  <div className="mb-1 text-sm font-medium">Total Growth</div>
                  <div className="text-muted-foreground text-xs">Over selected period</div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="mb-2 text-2xl font-bold text-purple-600">
                    {(((gdpStats.maxGdp - gdpStats.minGdp) / gdpStats.minGdp) * 100).toFixed(1)}%
                  </div>
                  <div className="mb-1 text-sm font-medium">Peak-to-Trough</div>
                  <div className="text-muted-foreground text-xs">Maximum variation</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* GDP Projections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              GDP Projections
            </CardTitle>
            <CardDescription>Economic forecasting and growth scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                Advanced GDP projection models are available through the Predictive Models feature
                in the premium analytics suite. These include multi-scenario forecasting with
                confidence intervals based on historical patterns and economic indicators.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Economic tier classifications are based on GDP per capita and determine growth rate caps
            in the IxStats system. Higher tiers indicate more mature economies with typically lower
            but more stable growth rates.
          </AlertDescription>
        </Alert>
      </div>
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
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default GdpDetailsModal;
