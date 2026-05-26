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
import { formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import {
  BaseMetricDetailsModal,
  type MetricModalTab,
} from "./metric-details/BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./metric-details/types";

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
    { countryId },
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
    if (!defaultChartData.length || !globalStats) return null;

    const current = defaultChartData[defaultChartData.length - 1];
    const previous = defaultChartData[defaultChartData.length - 2];

    if (!current || !previous) return null;

    const growth = ((current.population - previous.population) / previous.population) * 100;
    const globalComparison =
      ((current.population - globalStats.averagePopulation) / globalStats.averagePopulation) * 100;

    return {
      currentValue: current.population,
      growth,
      globalComparison,
      globalAverage: globalStats.averagePopulation,
      rank: comparisonData.findIndex((c: any) => c.isCurrentCountry) + 1,
      totalCountries: comparisonData.length,
      density: current.populationDensity,
    };
  }, [defaultChartData, globalStats, comparisonData]);

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      );
    }

    if (!economicData) return null;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Current Population</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatPopulation(economicData.currentPopulation)}
              </p>
              <p className="text-muted-foreground text-xs">
                {populationTierInfo?.currentTier?.name}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Growth Rate</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {(economicData.populationGrowthRate * 100).toFixed(3)}%
              </p>
              <p className="text-muted-foreground text-xs">annually</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">World Ranking</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                #{performanceMetrics?.rank || "N/A"}
              </p>
              <p className="text-muted-foreground text-xs">by population</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Population Density</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {performanceMetrics?.density
                  ? `${Math.round(performanceMetrics.density)}/km²`
                  : "N/A"}
              </p>
              <p className="text-muted-foreground text-xs">people per km²</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        {performanceMetrics && globalStats && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  {performanceMetrics.growth > 0 ? (
                    <ArrowUp className="h-4 w-4 text-green-600" />
                  ) : performanceMetrics.growth < 0 ? (
                    <ArrowDown className="h-4 w-4 text-red-600" />
                  ) : (
                    <Equal className="h-4 w-4 text-gray-600" />
                  )}
                  <span className="font-medium">Recent Growth</span>
                </div>
                <p
                  className={`text-2xl font-bold ${
                    performanceMetrics.growth > 0
                      ? "text-green-600"
                      : performanceMetrics.growth < 0
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {performanceMetrics.growth > 0 ? "+" : ""}
                  {performanceMetrics.growth.toFixed(3)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">vs Global Average</span>
                </div>
                <p
                  className={`text-2xl font-bold ${
                    performanceMetrics.globalComparison > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {performanceMetrics.globalComparison > 0 ? "+" : ""}
                  {performanceMetrics.globalComparison.toFixed(1)}%
                </p>
                <p className="text-muted-foreground text-xs">
                  Global avg: {formatPopulation(performanceMetrics.globalAverage)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">World Ranking</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">#{performanceMetrics.rank}</p>
                <p className="text-muted-foreground text-xs">
                  of {performanceMetrics.totalCountries} countries
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange) => {
    const chartData = processChartData(timeRange);

    if (isHistoricalLoading) {
      return <Skeleton className="h-80" />;
    }

    if (chartData.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Population Growth Trends
          </CardTitle>
          <CardDescription>
            Population development over time with {chartData.length} data points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  domain={["dataMin", "dataMax"]}
                  type="number"
                  scale="time"
                  name="Time"
                  tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
                />
                <YAxis
                  yAxisId="population"
                  orientation="left"
                  label={{ value: "Population", angle: -90, position: "insideLeft" }}
                  tickFormatter={(value) => formatPopulation(value)}
                />
                <YAxis
                  yAxisId="growth"
                  orientation="right"
                  label={{ value: "Growth Rate (%)", angle: 90, position: "insideRight" }}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === "population") {
                      return [formatPopulation(value), "Population"];
                    }
                    if (name === "populationGrowthRate") {
                      return [`${value.toFixed(3)}%`, "Growth Rate"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
                />
                <Area
                  yAxisId="population"
                  type="monotone"
                  dataKey="population"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  strokeWidth={3}
                />
                <Bar
                  yAxisId="growth"
                  dataKey="populationGrowthRate"
                  fill="#10b981"
                  opacity={0.6}
                  radius={[2, 2, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderComparisonTab = () => {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* World Rankings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Population Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isTopCountriesLoading ? (
                <Skeleton className="h-80" />
              ) : comparisonData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.slice(0, 10)} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatPopulation(value)} />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip
                        formatter={(value: any) => [formatPopulation(value), "Population"]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullName || label;
                        }}
                      />
                      <Bar dataKey="population" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-80 items-center justify-center">
                  No comparison data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Demographics Breakdown */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demographics Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demographicBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={(props: any) =>
                          `${props.name ?? ""} ${(props.payload?.percentage ?? 0).toFixed(1)}%`
                        }
                      >
                        {demographicBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatPopulation(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {demographicBreakdown.map((segment) => (
                    <div
                      key={segment.name}
                      className="bg-muted/50 flex items-center justify-between rounded p-2"
                    >
                      <span className="text-sm font-medium">{segment.name}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatPopulation(segment.value)}</div>
                        <div className="text-muted-foreground text-xs">
                          {segment.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderDetailsTab = () => {
    return (
      <div className="space-y-6">
        {/* Population Tier System */}
        <Card>
          <CardHeader>
            <CardTitle>Population Tier System</CardTitle>
            <CardDescription>Classification based on total population</CardDescription>
          </CardHeader>
          <CardContent>
            {populationTierInfo && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {populationTierInfo.allTiers.map((tier, index) => (
                  <div
                    key={tier.name}
                    className={`rounded-lg border-2 p-3 transition-all ${
                      index === populationTierInfo.currentIndex
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="space-y-2 text-center">
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-muted-foreground text-xs">{tier.description}</div>
                      {index === populationTierInfo.currentIndex && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Population Projections */}
        {economicData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                20-Year Population Projections
                <Badge variant="outline" className="ml-2">
                  {(economicData.populationGrowthRate * 100).toFixed(3)}% growth
                </Badge>
              </CardTitle>
              <CardDescription>Projected population assuming constant growth rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis
                      label={{ value: "Population", angle: -90, position: "insideLeft" }}
                      tickFormatter={(value) => formatPopulation(value)}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatPopulation(value), "Population"]}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="population"
                      stroke="#ff7300"
                      fill="#ff7300"
                      fillOpacity={0.4}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-muted-foreground mt-4 text-sm">
                <p>* Projections assume constant growth rates and no major demographic changes</p>
                <p>
                  * Actual results may vary based on economic development, migration, and policy
                  changes
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default PopulationDetailsModal;
