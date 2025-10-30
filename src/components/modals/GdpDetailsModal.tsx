"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
// Removed Card import - using proper Dialog components
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  DollarSign,
  Calculator,
  Globe,
  Calendar,
  Info,
  RefreshCw,
} from "lucide-react";
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
  ResponsiveContainer,
} from "recharts";
import { format, subMonths } from "date-fns";

interface GdpDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

export function GdpDetailsModal({ isOpen, onClose, countryId, countryName }: GdpDetailsModalProps) {
  const [timeRange, setTimeRange] = useState("1y");
  const [chartType, setChartType] = useState("line");

  // Enhanced escape functionality
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Get country data
  const { data: countryData, isLoading: countryLoading } =
    api.countries.getByIdWithEconomicData.useQuery(
      { id: countryId },
      { enabled: !!countryId && isOpen }
    );

  // Get historical data
  const {
    data: historicalData,
    isLoading: historicalLoading,
    refetch,
  } = api.countries.getHistoricalData.useQuery({ countryId }, { enabled: !!countryId && isOpen });

  // Get global stats for comparison
  const { data: globalStats, isLoading: globalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const isLoading = countryLoading || historicalLoading || globalLoading;

  // Process historical data for charts
  const processedData = React.useMemo(() => {
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

    const monthsToShow = rangeMap[timeRange as keyof typeof rangeMap] || 12;
    const cutoffDate = monthsToShow === Infinity ? new Date(0) : subMonths(now, monthsToShow);

    return historicalData
      .filter((point: any) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .slice(-100) // Limit to last 100 points for performance
      .map((point: any, index: number) => ({
        period: index + 1,
        date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
        timestamp: point.ixTimeTimestamp,
        totalGdp: point.totalGdp / 1e12, // Convert to trillions
        gdpPerCapita: point.gdpPerCapita,
        gdpGrowth: point.gdpGrowth || 0,
        realGdp: point.totalGdp / 1e12 / (1 + (point.inflationRate || 0) / 100), // Rough real GDP calculation
        nominalGdp: point.totalGdp / 1e12,
      }))
      .sort(
        (a, b) => (new Date(a.timestamp).getTime() ?? 0) - (new Date(b.timestamp).getTime() ?? 0)
      );
  }, [historicalData, timeRange]);

  // Calculate GDP statistics
  const gdpStats = React.useMemo(() => {
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
    const avgGrowth = (totalGrowth / processedData.length) * 12; // Annualized

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
  }, [processedData]);

  // Economic tier information
  const tierInfo = React.useMemo(() => {
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background/95 z-[13000] max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto border-2 border-white/10 shadow-2xl backdrop-blur-xl sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            GDP Analysis - {countryName || "Country"}
          </DialogTitle>
          <DialogDescription>
            Comprehensive GDP analysis with historical trends, projections, and economic insights.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="historical">Historical Trends</TabsTrigger>
            <TabsTrigger value="analysis">Economic Analysis</TabsTrigger>
            <TabsTrigger value="projections">Projections</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  {/* Key GDP Metrics */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card>
                      <div className="p-6">
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
                      </div>
                    </Card>

                    <Card>
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-muted-foreground text-sm font-medium">
                              GDP per Capita
                            </p>
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
                      </div>
                    </Card>

                    <Card>
                      <div className="p-6">
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
                      </div>
                    </Card>

                    <Card>
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-muted-foreground text-sm font-medium">
                              Economic Tier
                            </p>
                            <Badge className={`text-sm ${tierInfo?.currentTier?.color}`}>
                              {countryData?.economicTier || "Unknown"}
                            </Badge>
                          </div>
                          <Globe className="h-8 w-8 text-orange-500" />
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* GDP Composition */}
                  <Card>
                    <div className="p-6 pb-4">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        GDP Performance Summary
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Key performance indicators and trends
                      </p>
                    </div>
                    <div className="p-6">
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
                    </div>
                  </Card>

                  {/* Global Comparison */}
                  {globalStats && (
                    <Card>
                      <div className="p-6 pb-4">
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                          <Globe className="h-5 w-5 text-green-500" />
                          Global Comparison
                        </h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                          How this country compares to global averages
                        </p>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                          <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-950/20">
                            <div className="mb-1 text-lg font-semibold text-blue-600">
                              vs Global Avg GDP per Capita
                            </div>
                            <div className="text-2xl font-bold">
                              {countryData?.currentGdpPerCapita &&
                              globalStats &&
                              typeof globalStats === "object" &&
                              globalStats !== null &&
                              "averageGdpPerCapita" in globalStats &&
                              typeof (globalStats as any).averageGdpPerCapita === "number"
                                ? `${((countryData.currentGdpPerCapita / (globalStats as any).averageGdpPerCapita - 1) * 100).toFixed(1)}%`
                                : "N/A"}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              Global Avg:{" "}
                              {globalStats &&
                              typeof globalStats === "object" &&
                              globalStats !== null &&
                              "averageGdpPerCapita" in globalStats
                                ? formatCurrency((globalStats as any).averageGdpPerCapita)
                                : "N/A"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950/20">
                            <div className="mb-1 text-lg font-semibold text-green-600">
                              Economic Tier Rank
                            </div>
                            <div className="text-2xl font-bold">
                              {tierInfo?.allTiers
                                ? tierInfo.allTiers.findIndex(
                                    (t) => t.name === countryData?.economicTier
                                  ) + 1 || 0
                                : 0}
                              /7
                            </div>
                            <div className="text-muted-foreground text-sm">Among global tiers</div>
                          </div>
                          <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-950/20">
                            <div className="mb-1 text-lg font-semibold text-purple-600">
                              GDP Share of Global
                            </div>
                            <div className="text-2xl font-bold">
                              {countryData?.currentTotalGdp &&
                              globalStats &&
                              typeof globalStats === "object" &&
                              globalStats !== null &&
                              "totalGdp" in globalStats &&
                              typeof (globalStats as any).totalGdp === "number"
                                ? `${((countryData.currentTotalGdp / (globalStats as any).totalGdp) * 100).toFixed(3)}%`
                                : "N/A"}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              Global GDP:{" "}
                              {globalStats &&
                              typeof globalStats === "object" &&
                              globalStats !== null &&
                              "totalGdp" in globalStats
                                ? formatCurrency((globalStats as any).totalGdp / 1e12)
                                : "N/A"}
                              T
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="historical" className="mt-6">
            <div className="space-y-6">
              {/* Chart Controls */}
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3m">3 Months</SelectItem>
                        <SelectItem value="6m">6 Months</SelectItem>
                        <SelectItem value="1y">1 Year</SelectItem>
                        <SelectItem value="2y">2 Years</SelectItem>
                        <SelectItem value="5y">5 Years</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <Select value={chartType} onValueChange={setChartType}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="line">Line Chart</SelectItem>
                        <SelectItem value="area">Area Chart</SelectItem>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="composed">Combined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Data
                </Button>
              </div>

              {/* Historical Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>GDP Historical Trends</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    GDP development over time with {processedData.length} data points
                  </p>
                </CardHeader>
                <CardContent>
                  {processedData.length > 0 ? (
                    <>
                      {chartType === "line" && (
                        <ChartContainer config={chartConfig} className="h-[400px]">
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
                        </ChartContainer>
                      )}
                      {chartType === "area" && (
                        <ChartContainer config={chartConfig} className="h-[400px]">
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
                        </ChartContainer>
                      )}
                      {chartType === "bar" && (
                        <ChartContainer config={chartConfig} className="h-[400px]">
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
                        </ChartContainer>
                      )}
                      {chartType === "composed" && (
                        <ChartContainer config={chartConfig} className="h-[400px]">
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
                        </ChartContainer>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground py-8 text-center">
                      <LineChart className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No historical data available</p>
                      <p className="text-sm">
                        Data points will appear as the economic system generates history
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="mt-6">
            <div className="space-y-6">
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
                  <div className="space-y-4">
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
                                  const needed =
                                    nextTier.min - (countryData?.currentGdpPerCapita || 0);
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
                  </div>
                </CardContent>
              </Card>

              {/* GDP Volatility Analysis */}
              {gdpStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>GDP Stability Analysis</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Economic volatility and stability metrics
                    </p>
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
                        <div className="text-muted-foreground text-xs">Over {timeRange} period</div>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="mb-2 text-2xl font-bold text-purple-600">
                          {(((gdpStats.maxGdp - gdpStats.minGdp) / gdpStats.minGdp) * 100).toFixed(
                            1
                          )}
                          %
                        </div>
                        <div className="mb-1 text-sm font-medium">Peak-to-Trough</div>
                        <div className="text-muted-foreground text-xs">Maximum variation</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Economic tier classifications are based on GDP per capita and determine growth
                  rate caps in the IxStats system. Higher tiers indicate more mature economies with
                  typically lower but more stable growth rates.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="projections" className="mt-6">
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
                    Advanced GDP projection models are available through the Predictive Models
                    feature in the premium analytics suite. These include multi-scenario forecasting
                    with confidence intervals based on historical patterns and economic indicators.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
