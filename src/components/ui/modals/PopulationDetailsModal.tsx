// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import {
  Users,
  TrendingUp,
  Globe,
  Activity,
  ArrowUp,
  ArrowDown,
  Equal,
  MapPin,
  BarChart3,
  LineChart,
  Info,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatPopulation } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import {
  BaseMetricDetailsModal,
  type MetricModalTab,
} from "./metric-details/BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./metric-details/types";
import { MetricModalLayout } from "./metric-details/MetricModalLayout";

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
  { id: "details", label: "Details", icon: Info },
];

/**
 * PopulationDetailsModal - Comprehensive population demographics and analysis
 *
 * Displays:
 * - Overview: Current population, growth rate, world ranking, density
 * - Trends: Historical population growth with time range controls
 * - Comparison: Global rankings and demographic breakdown
 * - Details: Population tier system and 20-year projections
 */
export function PopulationDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: PopulationDetailsModalProps) {
  const {
    data: economicDataRaw,
    isLoading: isEconomicLoading,
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const { data: historicalDataRaw, isLoading: isHistoricalLoading } =
    api.historical.getCountryHistory.useQuery(
      { countryId },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  const { data: globalStatsRaw, isLoading: isGlobalLoading } =
    api.countries.getGlobalStats.useQuery(undefined, {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    });

  const { data: topCountriesByPopulationRaw, isLoading: isTopCountriesLoading } =
    api.countries.getTopCountriesByPopulation.useQuery(
      { limit: 15 },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  // Type assertions to access computed fields
  const economicData = economicDataRaw as any;
  const historicalData = historicalDataRaw as any;
  const globalStats = globalStatsRaw as any;
  const topCountriesByPopulation = topCountriesByPopulationRaw as any;

  const isLoading = isEconomicLoading || isHistoricalLoading || isGlobalLoading;

  const processChartData = (timeRange: TimeRange) => {
    if (!historicalData?.length) return [];

    const rangeMap = {
      "3m": 3,
      "6m": 6,
      "1y": 12,
      "2y": 24,
      "5y": 60,
      all: Infinity,
    };

    const monthsToShow = rangeMap[timeRange] || 12;
    const cutoffDate =
      monthsToShow === Infinity
        ? new Date(0)
        : new Date(Date.now() - monthsToShow * 30 * 24 * 60 * 60 * 1000);

    return historicalData
      .filter((point: any) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .map((point: any) => ({
        year: IxTime.getCurrentGameYear(point.ixTimeTimestamp),
        population: point.population,
        populationGrowthRate: (point.populationGrowthRate || 0) * 100,
        populationDensity: point.populationDensity,
        totalGdp: point.totalGdp,
        timestamp: point.ixTimeTimestamp,
        date: IxTime.formatIxTime(point.ixTimeTimestamp, true),
      }))
      .sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  };

  // Default chart data for overview metrics
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultChartData = useMemo(() => processChartData("1y"), [historicalData]);

  const projectionData = useMemo(() => {
    if (!economicData) return [];

    const currentYear = IxTime.getCurrentGameYear();
    const data = [];

    for (let i = 0; i <= 20; i++) {
      const year = currentYear + i;
      const yearsFromNow = i;
      const growthFactor = Math.pow(1 + economicData.populationGrowthRate, yearsFromNow);

      data.push({
        year,
        population: economicData.currentPopulation * growthFactor,
        isProjection: i > 0,
      });
    }

    return data;
  }, [economicData]);

  const comparisonData = useMemo(() => {
    if (!topCountriesByPopulation || !economicData) return [];

    return topCountriesByPopulation
      .map((country: any) => ({
        name: country.name.length > 12 ? country.name.substring(0, 9) + "..." : country.name,
        fullName: country.name,
        population: country.currentPopulation,
        populationTier: country.populationTier,
        isCurrentCountry: country.id === countryId,
      }))
      .sort((a: any, b: any) => b.population - a.population);
  }, [topCountriesByPopulation, economicData, countryId]);

  const populationTierInfo = useMemo(() => {
    if (!economicData) return null;

    const tiers = [
      {
        name: "Tier 1",
        min: 0,
        max: 9_999_999,
        color: "bg-red-100 text-red-800",
        description: "0-9.99M",
      },
      {
        name: "Tier 2",
        min: 10_000_000,
        max: 29_999_999,
        color: "bg-orange-100 text-orange-800",
        description: "10-29.99M",
      },
      {
        name: "Tier 3",
        min: 30_000_000,
        max: 49_999_999,
        color: "bg-yellow-100 text-yellow-800",
        description: "30-49.99M",
      },
      {
        name: "Tier 4",
        min: 50_000_000,
        max: 79_999_999,
        color: "bg-green-100 text-green-800",
        description: "50-79.99M",
      },
      {
        name: "Tier 5",
        min: 80_000_000,
        max: 119_999_999,
        color: "bg-blue-100 text-blue-800",
        description: "80-119.99M",
      },
      {
        name: "Tier 6",
        min: 120_000_000,
        max: 349_999_999,
        color: "bg-indigo-100 text-indigo-800",
        description: "120-349.99M",
      },
      {
        name: "Tier 7",
        min: 350_000_000,
        max: 499_999_999,
        color: "bg-purple-100 text-purple-800",
        description: "350-499.99M",
      },
      {
        name: "Tier X",
        min: 500_000_000,
        max: Infinity,
        color: "bg-pink-100 text-pink-800",
        description: "500M+",
      },
    ];

    const currentTierIndex = tiers.findIndex(
      (tier) =>
        economicData.currentPopulation >= tier.min && economicData.currentPopulation <= tier.max
    );

    return {
      currentTier: tiers[currentTierIndex],
      nextTier: tiers[currentTierIndex + 1],
      allTiers: tiers,
      currentIndex: currentTierIndex,
    };
  }, [economicData]);

  const demographicBreakdown = useMemo(() => {
    if (!economicData) return [];

    const urbanizationRate =
      economicData.economicTier === "Extravagant"
        ? 0.85
        : economicData.economicTier === "Very Strong"
          ? 0.75
          : economicData.economicTier === "Strong"
            ? 0.65
            : economicData.economicTier === "Healthy"
              ? 0.55
              : economicData.economicTier === "Developed"
                ? 0.45
                : economicData.economicTier === "Developing"
                  ? 0.35
                  : 0.25;

    const urbanPop = economicData.currentPopulation * urbanizationRate;
    const ruralPop = economicData.currentPopulation * (1 - urbanizationRate);

    return [
      {
        name: "Urban Population",
        value: urbanPop,
        color: "#3b82f6",
        percentage: urbanizationRate * 100,
      },
      {
        name: "Rural Population",
        value: ruralPop,
        color: "#10b981",
        percentage: (1 - urbanizationRate) * 100,
      },
    ];
  }, [economicData]);

  const performanceMetrics = useMemo(() => {
    if (!economicData) return null;

    const currentPop = economicData.currentPopulation;
    const growthRate = economicData.populationGrowthRate;
    const density = economicData.populationDensity || currentPop / (economicData?.landArea || 1);

    let growth = growthRate * 100;
    let globalComparison = 0;
    let globalAverage = 0;
    let rank = 1;
    let totalCountries = 1;

    if (globalStats) {
      globalAverage = globalStats.averagePopulation;
      globalComparison = ((currentPop - globalAverage) / globalAverage) * 100;
    }

    if (comparisonData.length > 0) {
      const idx = comparisonData.findIndex((c: any) => c.isCurrentCountry);
      rank = idx !== -1 ? idx + 1 : 1;
      totalCountries = comparisonData.length;
    }

    if (defaultChartData && defaultChartData.length >= 2) {
      const current = defaultChartData[defaultChartData.length - 1];
      const previous = defaultChartData[defaultChartData.length - 2];
      if (current && previous && previous.population > 0) {
        growth = ((current.population - previous.population) / previous.population) * 100;
      }
    }

    return {
      currentValue: currentPop,
      growth,
      globalComparison,
      globalAverage,
      rank,
      totalCountries,
      density,
    };
  }, [economicData, defaultChartData, globalStats, comparisonData]);

  const renderTabContent = (activeTab: string, timeRange: TimeRange, _chartType: ChartType) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "trends":
        return renderTrendsTab(timeRange);
      case "comparison":
        return renderComparisonTab();
      case "details":
        return renderDetailsTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (isEconomicLoading) {
      return (
        <MetricModalLayout variant="social">
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

    if (!economicData) return null;

    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          {performanceMetrics && globalStats && (
            <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
              <CardHeader className="mb-4 p-0">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  Demographics Performance Summary
                </CardTitle>
                <CardDescription>Key growth metrics and global ranking statistics.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center p-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                    <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                      {performanceMetrics.growth > 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      ) : performanceMetrics.growth < 0 ? (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Equal className="h-4 w-4 text-gray-500" />
                      )}
                      Recent Growth
                    </div>
                    <span
                      className={`text-xl font-bold ${
                        performanceMetrics.growth > 0
                          ? "text-green-400"
                          : performanceMetrics.growth < 0
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {performanceMetrics.growth > 0 ? "+" : ""}
                      {performanceMetrics.growth.toFixed(3)}%
                    </span>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                    <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                      vs Global Average
                    </div>
                    <span
                      className={`text-xl font-bold ${
                        performanceMetrics.globalComparison > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {performanceMetrics.globalComparison > 0 ? "+" : ""}
                      {performanceMetrics.globalComparison.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground mt-0.5 text-[10px]">
                      Avg: {formatPopulation(performanceMetrics.globalAverage)}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                    <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                      World Ranking
                    </div>
                    <span className="text-xl font-bold text-purple-400">
                      #{performanceMetrics.rank}
                    </span>
                    <span className="text-muted-foreground mt-0.5 text-[10px]">
                      of {performanceMetrics.totalCountries} countries
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Current Population"
            value={economicData.currentPopulation}
            suffix=""
            decimalPlaces={0}
            icon={Users}
            variant="social"
          />

          <MetricModalLayout.StatCard
            label="Growth Rate"
            value={economicData.populationGrowthRate * 100}
            suffix="%"
            decimalPlaces={3}
            icon={TrendingUp}
            variant="social"
          />

          <MetricModalLayout.StatCard
            label="Population Density"
            value={performanceMetrics?.density ? Math.round(performanceMetrics.density) : 0}
            suffix="/km²"
            icon={MapPin}
            variant="social"
          />

          <div className="facet-refraction relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div>
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Demographics Classification
              </span>
              <div className="mt-2">
                <Badge className="border-none bg-cyan-500/20 text-sm font-semibold text-cyan-400">
                  {populationTierInfo?.currentTier?.name || "Unknown"}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Influences national worker recruitment capacity, taxable demographic brackets, and
              structural demands.
            </p>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange) => {
    const chartData = processChartData(timeRange);

    if (isHistoricalLoading) {
      return (
        <MetricModalLayout variant="social">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[400px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    if (chartData.length === 0) {
      return (
        <Card className="facet-refraction border-white/5">
          <CardContent className="py-12 text-center">
            <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-500" />
                Population Growth Trends
              </CardTitle>
              <CardDescription>
                Population development over time with {chartData.length} data points
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis
                      dataKey="timestamp"
                      domain={["dataMin", "dataMax"]}
                      type="number"
                      scale="time"
                      name="Time"
                      tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
                      stroke="rgba(255, 255, 255, 0.3)"
                    />
                    <YAxis
                      yAxisId="population"
                      orientation="left"
                      tickFormatter={(value) => formatPopulation(value)}
                      stroke="rgba(255, 255, 255, 0.3)"
                    />
                    <YAxis
                      yAxisId="growth"
                      orientation="right"
                      stroke="rgba(255, 255, 255, 0.3)"
                      tickFormatter={(value) => `${value.toFixed(2)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(18, 20, 24, 0.8)",
                        backdropFilter: "blur(8px)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === "population") {
                          return [formatPopulation(value), "Population"];
                        }
                        if (name === "populationGrowthRate") {
                          return [`${value.toFixed(3)}%`, "Growth Rate"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) =>
                        `Year ${IxTime.getCurrentGameYear(label as number)}`
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
                    <Area
                      yAxisId="population"
                      type="monotone"
                      dataKey="population"
                      stroke="#06b6d4"
                      fillOpacity={1}
                      fill="url(#popColor)"
                      strokeWidth={3}
                      name="Population"
                    />
                    <Bar
                      yAxisId="growth"
                      dataKey="populationGrowthRate"
                      fill="#10b981"
                      opacity={0.4}
                      name="Growth Rate"
                      radius={[2, 2, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Peak Population
              </span>
              <span className="text-xl font-bold text-cyan-400">
                {chartData.length > 0
                  ? formatPopulation(Math.max(...chartData.map((d) => d.population)))
                  : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Recent Growth
              </span>
              <span className="text-xl font-bold text-emerald-400">
                {performanceMetrics?.growth ? `${performanceMetrics.growth.toFixed(3)}%` : "N/A"}
              </span>
            </div>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderComparisonTab = () => {
    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-500" />
                Global Population Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              {isTopCountriesLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : comparisonData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatPopulation(value)}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={80}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [formatPopulation(value), "Population"]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullName || label;
                        }}
                      />
                      <Bar dataKey="population" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-64 items-center justify-center">
                  No comparison data available
                </div>
              )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-4">
            <CardHeader className="mb-3 p-0">
              <CardTitle className="text-sm font-semibold">Demographics Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              <div className="flex h-44 w-full items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      label={(props: any) => props.name}
                      labelLine={false}
                    >
                      {demographicBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(18, 20, 24, 0.8)",
                        backdropFilter: "blur(8px)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any) => formatPopulation(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1">
                {demographicBreakdown.map((segment) => (
                  <div
                    key={segment.name}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-2 text-[11px]"
                  >
                    <span className="text-muted-foreground font-medium">{segment.name}</span>
                    <div className="text-right">
                      <div className="font-bold text-white">{formatPopulation(segment.value)}</div>
                      <div className="text-[9px] text-cyan-400">
                        {segment.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderDetailsTab = () => {
    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          {economicData && (
            <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
              <CardHeader className="mb-4 p-0">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-cyan-500" />
                  20-Year Population Projections
                  <Badge
                    variant="outline"
                    className="ml-2 border-cyan-500/20 bg-cyan-500/5 text-cyan-400"
                  >
                    {(economicData.populationGrowthRate * 100).toFixed(3)}% growth
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Projected population assuming constant growth rates
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center p-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                      <defs>
                        <linearGradient id="popProjGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis dataKey="year" stroke="rgba(255, 255, 255, 0.3)" />
                      <YAxis
                        tickFormatter={(value) => formatPopulation(value)}
                        stroke="rgba(255, 255, 255, 0.3)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [formatPopulation(value), "Population"]}
                        labelFormatter={(label) => `Year ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="population"
                        stroke="#06b6d4"
                        fillOpacity={1}
                        fill="url(#popProjGrad)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-muted-foreground mt-4 space-y-0.5 text-[10px]">
                  <p>* Projections assume constant growth rates and no major demographic changes</p>
                  <p>
                    * Actual results may vary based on economic development, migration, and policy
                    changes
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          {populationTierInfo && (
            <div className="facet-refraction flex flex-1 flex-col justify-between space-y-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <div>
                <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Population Tier System
                </h4>
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {populationTierInfo.allTiers.map((tier, index) => (
                    <div
                      key={tier.name}
                      className={cn(
                        "rounded-lg border p-2 text-xs transition-all",
                        index === populationTierInfo.currentIndex
                          ? "border-cyan-500/40 bg-cyan-500/10 shadow-inner"
                          : "border-white/5 bg-black/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold text-white">
                          <span
                            className={cn(
                              index === populationTierInfo.currentIndex && "text-cyan-400"
                            )}
                          >
                            {tier.name}
                          </span>
                          {index === populationTierInfo.currentIndex && (
                            <Badge className="ml-1.5 scale-90 border-none bg-cyan-500/20 px-1 py-0 text-[8px] text-cyan-400">
                              Current
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                        {tier.description}
                      </p>
                    </div>
                  ))}
                </div>
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
      title="Population Analysis"
      description="Comprehensive population demographics, growth trends, and comparative analysis"
      icon={Users}
      iconColor="text-blue-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="social"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default PopulationDetailsModal;
