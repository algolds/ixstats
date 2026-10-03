"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useMemo } from "react";
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
  AreaChart as RechartsAreaChart,
  Line,
  LineChart as RechartsLineChart,
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
import type { TimeRange, ChartType } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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

  const { data: historicalData, isLoading: isHistoricalLoading } =
    api.historical.getCountryHistory.useQuery(
      { countryId },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  const { data: globalStats, isLoading: isGlobalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const { data: topCountriesByPopulation, isLoading: isTopCountriesLoading } =
    api.countries.getTopCountriesByPopulation.useQuery(
      { limit: 15 },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  const economicData: PopulationCountryData | null | undefined = economicDataRaw;

  const isLoading = isEconomicLoading || isHistoricalLoading || isGlobalLoading;

  const processChartData = (timeRange: TimeRange): PopulationChartDataPoint[] => {
    return filterAndSortHistory(
      historicalData,
      timeRange,
      (point, _, rawTimestamp): PopulationChartDataPoint => {
        const tsNum = IxTime.toTimestamp(rawTimestamp as string | number | Date) as number;
        const pop = Number(point?.population ?? 0);
        const rawGrowthRate = Number(point?.populationGrowthRate ?? 0);
        return {
          year: IxTime.getCurrentGameYear(tsNum),
          population: pop,
          populationGrowthRate: rawGrowthRate * 100,
          populationDensity: point.populationDensity ?? null,
          totalGdp: point.totalGdp ?? 0,
          timestamp: tsNum,
          date: IxTime.formatIxTime(tsNum, true),
        };
      }
    );
  };

  // Overview trailing growth uses unified 5y window to match default X-axis
  // Previously 1y caused mismatch with Trends selector
  // oxlint-disable-next-line
  const defaultChartData = useMemo(() => processChartData("5y"), [historicalData]);

  // oxlint-disable-next-line eslint/no-unused-vars
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
      .map((country) => ({
        name: country.name.length > 12 ? country.name.substring(0, 9) + "..." : country.name,
        fullName: country.name,
        population: country.currentPopulation,
        populationTier: country.populationTier,
        isCurrentCountry: country.id === countryId,
      }))
      .sort((a, b) => b.population - a.population);
  }, [topCountriesByPopulation, economicData, countryId]);

  const populationTierInfo = useMemo(() => {
    if (!economicData) return null;

    const tiers = [
      {
        name: "Tier 1",
        min: 0,
        max: 9_999_999,
        color: "text-label",
        description: "0-9.99M",
      },
      {
        name: "Tier 2",
        min: 10_000_000,
        max: 29_999_999,
        color: "text-label",
        description: "10-29.99M",
      },
      {
        name: "Tier 3",
        min: 30_000_000,
        max: 49_999_999,
        color: "text-label",
        description: "30-49.99M",
      },
      {
        name: "Tier 4",
        min: 50_000_000,
        max: 79_999_999,
        color: "text-label",
        description: "50-79.99M",
      },
      {
        name: "Tier 5",
        min: 80_000_000,
        max: 119_999_999,
        color: "text-label",
        description: "80-119.99M",
      },
      {
        name: "Tier 6",
        min: 120_000_000,
        max: 349_999_999,
        color: "text-label",
        description: "120-349.99M",
      },
      {
        name: "Tier 7",
        min: 350_000_000,
        max: 499_999_999,
        color: "text-label",
        description: "350-499.99M",
      },
      {
        name: "Tier X",
        min: 500_000_000,
        max: Infinity,
        color: "text-label",
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

  // Only the recorded urban/rural split; no estimate is derived when it is missing.
  const demographicBreakdown = useMemo(() => {
    const urban = economicData?.urbanPopulationPercent;
    const rural = economicData?.ruralPopulationPercent;
    if (!economicData || urban == null || rural == null) return [];

    return [
      {
        name: "Urban Population",
        value: (economicData.currentPopulation * urban) / 100,
        color: "var(--color-blue-500)",
        percentage: urban,
      },
      {
        name: "Rural Population",
        value: (economicData.currentPopulation * rural) / 100,
        color: "var(--chart-3)",
        percentage: rural,
      },
    ];
  }, [economicData]);

  const performanceMetrics = useMemo(() => {
    if (!economicData) return null;

    const currentPop = economicData.currentPopulation;
    const liveGrowthRate = economicData.populationGrowthRate * 100;
    const density = economicData.populationDensity || currentPop / (economicData?.landArea || 1);

    // trailingGrowth: delta between last two points (period actual)
    let trailingGrowth = liveGrowthRate;
    if (defaultChartData && defaultChartData.length >= 2) {
      const current = defaultChartData[defaultChartData.length - 1];
      const previous = defaultChartData[defaultChartData.length - 2];
      if (current && previous && previous.population > 0) {
        trailingGrowth = ((current.population - previous.population) / previous.population) * 100;
      }
    }

    let globalComparison = 0;
    let globalAverage = 0;
    let rank = 1;
    let totalCountries = 1;

    if (globalStats && globalStats.count > 0) {
      globalAverage = globalStats.totalPopulation / globalStats.count;
      globalComparison =
        globalAverage > 0 ? ((currentPop - globalAverage) / globalAverage) * 100 : 0;
    }

    if (comparisonData.length > 0) {
      const idx = comparisonData.findIndex((c) => c.isCurrentCountry);
      rank = idx !== -1 ? idx + 1 : 1;
      totalCountries = comparisonData.length;
    }

    return {
      currentValue: currentPop,
      growth: trailingGrowth,
      liveGrowth: liveGrowthRate,
      globalComparison,
      globalAverage,
      rank,
      totalCountries,
      density,
    };
  }, [economicData, defaultChartData, globalStats, comparisonData]);

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
    if (isEconomicLoading) {
      return <MetricModalLayout.Loading variant="social" mainHeight={300} sidebarCards={3} />;
    }

    if (!economicData) return null;

    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          {performanceMetrics && globalStats && (
            <Card className="flex flex-1 flex-col justify-between p-6">
              <CardHeader className="mb-4 p-0">
                <h3 className="text-label text-title-3 flex items-center gap-2">
                  <BarChart3 className="text-label-secondary h-5 w-5" />
                  Demographics performance summary
                </h3>
                <p className="text-label-secondary text-body">
                  Key growth metrics and global ranking statistics.
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center p-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card
                    variant="inset"
                    padding="none"
                    className="flex flex-col justify-center p-4 text-center"
                  >
                    <div className="text-label-secondary text-eyebrow mb-1 flex items-center justify-center gap-2">
                      {performanceMetrics.growth > 0 ? (
                        <ArrowUp className="text-green h-4 w-4" />
                      ) : performanceMetrics.growth < 0 ? (
                        <ArrowDown className="text-destructive h-4 w-4" />
                      ) : (
                        <Equal className="text-label-secondary h-4 w-4" />
                      )}
                      Recent Growth
                    </div>
                    <span
                      className={`text-title-2 ${
                        performanceMetrics.growth > 0
                          ? "text-green"
                          : performanceMetrics.growth < 0
                            ? "text-destructive"
                            : "text-label-secondary"
                      }`}
                    >
                      {performanceMetrics.growth > 0 ? "+" : ""}
                      {performanceMetrics.growth.toFixed(3)}%
                    </span>
                  </Card>

                  <Card
                    variant="inset"
                    padding="none"
                    className="flex flex-col justify-center p-4 text-center"
                  >
                    <span className="text-stat-label text-label-secondary mb-1 block">
                      vs Global Average
                    </span>
                    <span
                      className={`text-title-2 ${
                        performanceMetrics.globalComparison > 0 ? "text-green" : "text-destructive"
                      }`}
                    >
                      {performanceMetrics.globalComparison > 0 ? "+" : ""}
                      {performanceMetrics.globalComparison.toFixed(1)}%
                    </span>
                    <span className="text-label-secondary text-footnote mt-0.5">
                      Avg: {formatPopulation(performanceMetrics.globalAverage)}
                    </span>
                  </Card>

                  <Card
                    variant="inset"
                    padding="none"
                    className="flex flex-col justify-center p-4 text-center"
                  >
                    <span className="text-stat-label text-label-secondary mb-1 block">
                      World ranking
                    </span>
                    <span className="text-label text-title-2">#{performanceMetrics.rank}</span>
                    <span className="text-label-secondary text-footnote mt-0.5">
                      of {performanceMetrics.totalCountries} countries
                    </span>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Current population"
            value={economicData.currentPopulation}
            suffix=""
            decimalPlaces={0}
            icon={Users}
            variant="social"
          />

          <MetricModalLayout.StatCard
            label="Growth rate"
            value={economicData.populationGrowthRate * 100}
            suffix="%"
            decimalPlaces={3}
            icon={TrendingUp}
            variant="social"
          />

          <MetricModalLayout.StatCard
            label="Population density"
            value={performanceMetrics?.density ? Math.round(performanceMetrics.density) : 0}
            suffix="/km²"
            icon={MapPin}
            variant="social"
          />

          <div className="bg-fill-3 rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden p-4">
            <div>
              <div className="flex items-center justify-between">
                <Eyebrow>Demographics classification</Eyebrow>
                {populationTierInfo && (
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
                        {populationTierInfo.allTiers.map((tier, idx) => (
                          <div
                            key={tier.name}
                            className={cn(
                              "rounded-control-sm text-footnote flex items-center justify-between border px-2 py-1",
                              idx === populationTierInfo.currentIndex
                                ? "border-ring bg-fill-3"
                                : "border-separator"
                            )}
                          >
                            <span
                              className={cn(
                                "text-caption font-semibold",
                                idx === populationTierInfo.currentIndex
                                  ? "text-label"
                                  : "text-label-secondary"
                              )}
                            >
                              {tier.name}
                            </span>
                            <span className="text-label-secondary text-footnote">
                              {tier.description}
                            </span>
                            {idx === populationTierInfo.currentIndex && (
                              <Badge variant="default" className="ml-1">
                                Current
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
              <div className="mt-2">
                <Badge variant="default" className="text-headline">
                  {populationTierInfo?.currentTier?.name || "Unknown"}
                </Badge>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-4 leading-relaxed">
              Influences national worker recruitment capacity, taxable demographic brackets, and
              structural demands.
            </p>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange, chartType: ChartType = "composed") => {
    const chartData = processChartData(timeRange);

    if (isHistoricalLoading) {
      return <MetricModalLayout.Loading variant="social" mainHeight={400} sidebarCards={0} />;
    }

    if (chartData.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    const renderChartByFormat = () => {
      if (chartType === "line") {
        return (
          <RechartsLineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
            <XAxis
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              type="number"
              scale="time"
              name="Time"
              tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
              tickCount={6}
              stroke="var(--color-label-secondary)"
            />
            <YAxis
              yAxisId="population"
              orientation="left"
              tickFormatter={(value) => formatPopulation(value)}
              stroke="var(--color-label-secondary)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-elevated)",
                color: "var(--color-label)",
                borderColor: "var(--color-separator)",
                borderRadius: "8px",
              }}
              formatter={(value, name) => [
                formatPopulation(value as number),
                name === "population" ? "Population" : String(name ?? ""),
              ]}
              labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
            />
            <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
            <Line
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="var(--chart-2)"
              strokeWidth={3}
              dot={false}
              name="Population"
            />
          </RechartsLineChart>
        );
      }

      if (chartType === "area") {
        return (
          <RechartsAreaChart data={chartData}>
            <defs>
              <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
            <XAxis
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              type="number"
              scale="time"
              name="Time"
              tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
              tickCount={6}
              stroke="var(--color-label-secondary)"
            />
            <YAxis
              yAxisId="population"
              orientation="left"
              tickFormatter={(value) => formatPopulation(value)}
              stroke="var(--color-label-secondary)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-elevated)",
                color: "var(--color-label)",
                borderColor: "var(--color-separator)",
                borderRadius: "8px",
              }}
              formatter={(value, name) => [
                formatPopulation(value as number),
                name === "population" ? "Population" : String(name ?? ""),
              ]}
              labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
            />
            <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="var(--chart-2)"
              fillOpacity={1}
              fill="url(#popColor)"
              strokeWidth={3}
              name="Population"
            />
          </RechartsAreaChart>
        );
      }

      if (chartType === "bar") {
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
            <XAxis
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              type="number"
              scale="time"
              name="Time"
              tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
              tickCount={6}
              stroke="var(--color-label-secondary)"
            />
            <YAxis
              yAxisId="population"
              orientation="left"
              tickFormatter={(value) => formatPopulation(value)}
              stroke="var(--color-label-secondary)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-elevated)",
                color: "var(--color-label)",
                borderColor: "var(--color-separator)",
                borderRadius: "8px",
              }}
              formatter={(value, name) => [
                formatPopulation(value as number),
                name === "population" ? "Population" : String(name ?? ""),
              ]}
              labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
            />
            <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
            <Bar
              yAxisId="population"
              dataKey="population"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              name="Population"
            />
          </BarChart>
        );
      }

      // Default: Composed (Area + Bar)
      return (
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
          <XAxis
            dataKey="timestamp"
            domain={["dataMin", "dataMax"]}
            type="number"
            scale="time"
            name="Time"
            tickFormatter={(ts) => String(IxTime.getCurrentGameYear(ts as number))}
            tickCount={6}
            stroke="var(--color-label-secondary)"
          />
          <YAxis
            yAxisId="population"
            orientation="left"
            tickFormatter={(value) => formatPopulation(value)}
            stroke="var(--color-label-secondary)"
          />
          <YAxis
            yAxisId="growth"
            orientation="right"
            stroke="var(--color-label-secondary)"
            tickFormatter={(value) => `${value.toFixed(2)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-label)",
              borderColor: "var(--color-separator)",
              borderRadius: "8px",
            }}
            formatter={(value, name) => {
              if (name === "population") {
                return [formatPopulation(value as number), "Population"];
              }
              if (name === "populationGrowthRate") {
                return [`${(value as number).toFixed(3)}%`, "Growth Rate"];
              }
              return [String(value ?? ""), String(name ?? "")];
            }}
            labelFormatter={(label) => `Year ${IxTime.getCurrentGameYear(label as number)}`}
          />
          <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
          <Area
            yAxisId="population"
            type="monotone"
            dataKey="population"
            stroke="var(--chart-2)"
            fillOpacity={1}
            fill="url(#popColor)"
            strokeWidth={3}
            name="Population"
          />
          <Bar
            yAxisId="growth"
            dataKey="populationGrowthRate"
            fill="var(--chart-3)"
            opacity={0.4}
            name="Growth Rate"
            radius={[2, 2, 0, 0]}
          />
        </ComposedChart>
      );
    };

    return (
      <MetricModalLayout variant="social">
        <MetricModalLayout.MainArea>
          <Card className="p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Activity className="text-label-secondary h-5 w-5" />
                Population Growth Trends
                {economicData && (
                  <Badge variant="outline" className="ml-2">
                    Live: {(economicData.populationGrowthRate * 100).toFixed(3)}% · Trailing:{" "}
                    {performanceMetrics?.growth.toFixed(3)}%
                  </Badge>
                )}
              </h3>
              <p className="text-label-secondary text-body">
                Population development over time with {chartData.length} data points · Live rate
                from sim · Trailing from last interval delta
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {renderChartByFormat()}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Peak population
              </span>
              <span className="text-label text-title-2">
                {chartData.length > 0
                  ? formatPopulation(Math.max(...chartData.map((d) => d.population)))
                  : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Recent growth</span>
              <span className="text-title-2 text-green">
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
          <Card className="flex flex-1 flex-col p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Globe className="text-label-secondary h-5 w-5" />
                Global population rankings
              </h3>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              {isTopCountriesLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : comparisonData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.slice(0, 10)} layout="vertical">
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
                        contentStyle={{
                          background: "var(--color-surface-elevated)",
                          color: "var(--color-label)",
                          borderColor: "var(--color-separator)",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => [formatPopulation(value as number), "Population"]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload as { fullName?: string } | undefined;
                          return item?.fullName || String(label);
                        }}
                      />
                      <Bar dataKey="population" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-label-secondary flex h-64 items-center justify-center">
                  No comparison data available
                </div>
              )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="flex flex-1 flex-col justify-between p-4">
            <CardHeader className="mb-3 p-0">
              <h3 className="text-label text-title-3 text-headline">Demographics breakdown</h3>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              {demographicBreakdown.length === 0 ? (
                <p className="text-label-secondary text-footnote py-8 text-center">
                  No urban/rural split recorded
                </p>
              ) : (
                <>
                  <div className="flex h-44 w-full items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographicBreakdown}
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          fill="var(--chart-5)"
                          dataKey="value"
                          label={(props: { name?: string }) => props.name ?? ""}
                          labelLine={false}
                        >
                          {demographicBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-surface-elevated)",
                            color: "var(--color-label)",
                            borderColor: "var(--color-separator)",
                            borderRadius: "8px",
                          }}
                          formatter={(value) => formatPopulation(value as number)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                    {demographicBreakdown.map((segment) => (
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
            </CardContent>
          </Card>
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
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}
