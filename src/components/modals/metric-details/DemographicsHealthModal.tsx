// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useMemo } from "react";
import {
  Heart,
  BarChart3,
  LineChart,
  Globe,
  Info,
  Activity,
  Baby,
  Clock,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
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
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format, subMonths } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";

interface DemographicsHealthModalProps {
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

export function DemographicsHealthModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: DemographicsHealthModalProps) {
  // Fetch country data + mapped economyData
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
    refetch,
  } = useCountryEconomicData(countryId, isOpen);

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

    const demographics = economyData?.demographics;
    const currentLifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 75;
    const currentBirthRate = demographics?.birthRate || 12;
    const currentDeathRate = demographics?.deathRate || 8;
    const currentMedianAge = demographics?.medianAge || countryData?.medianAge || 30;

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
      .map((point: any) => ({
        date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
        timestamp: point.ixTimeTimestamp,
        population: (point.population || 0) / 1e6,
        lifeExpectancy: currentLifeExpectancy,
        birthRate: currentBirthRate,
        deathRate: currentDeathRate,
        medianAge: currentMedianAge,
      }))
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const chartConfig = {
    lifeExpectancy: { label: "Life Expectancy", color: "#06b6d4" },
    birthRate: { label: "Birth Rate", color: "#3b82f6" },
    deathRate: { label: "Death Rate", color: "#ef4444" },
    medianAge: { label: "Median Age", color: "#8b5cf6" },
    population: { label: "Population (M)", color: "#fbbf24" },
  };

  const getHealthLevel = (
    lifeExpectancy: number
  ): {
    label: string;
    color: string;
    bg: string;
    border: string;
    variant: "default" | "secondary" | "destructive";
  } => {
    if (lifeExpectancy >= 78)
      return {
        label: "Excellent",
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
        variant: "default",
      };
    if (lifeExpectancy >= 72)
      return {
        label: "Good",
        color: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        variant: "default",
      };
    if (lifeExpectancy >= 65)
      return {
        label: "Average",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        variant: "secondary",
      };
    return {
      label: "Below Average",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      variant: "destructive",
    };
  };

  // Default trends data for sidebar summary
  const defaultProcessedData = useMemo(
    () => processHistoricalData("1y"),
    [historicalData, economyData]
  );
  const trendStats = useMemo(() => {
    if (!defaultProcessedData || defaultProcessedData.length === 0) return null;
    const pops = defaultProcessedData.map((p) => p.population);
    const lifes = defaultProcessedData.map((p) => p.lifeExpectancy);

    return {
      maxPopulation: Math.max(...pops),
      avgLifeExpectancy: lifes.reduce((acc, v) => acc + v, 0) / lifes.length,
      dataPoints: defaultProcessedData.length,
    };
  }, [defaultProcessedData]);

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
        <MetricModalLayout variant="demographics">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[300px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const demographics = economyData?.demographics;
    const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
    const healthLevel = getHealthLevel(lifeExpectancy);

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-500" />
                Health & Vitality
              </CardTitle>
              <CardDescription>
                Population health indicators and quality of life metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-rose-450 text-lg font-bold">
                    {(demographics?.deathRate || 0).toFixed(1)}/1k
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Death Rate
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}
                    /1k
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Natural Growth
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-cyan-400">
                    {(demographics?.migrationRate || 0).toFixed(1)}/1k
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Migration Rate
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Dependency Ratio
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-4 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                <p className="leading-relaxed">
                  Health and Demographics track the biological vitality of your citizens. Balanced
                  median age supports stable labor pipelines, while natural population growth
                  sustains resource-consumption curves and tax bases.
                </p>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Life Expectancy"
            value={lifeExpectancy}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Heart}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Birth Rate"
            value={demographics?.birthRate || 0}
            suffix=" /1k"
            decimalPlaces={1}
            icon={Baby}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Median Age"
            value={demographics?.medianAge || countryData?.medianAge || 0}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Clock}
            variant="demographics"
          />

          <div
            className={`facet-refraction relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden rounded-xl border p-4 ${healthLevel.bg} ${healthLevel.border}`}
          >
            <div>
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                Health Status
              </span>
              <div className="mt-2">
                <span className={`text-lg font-bold tracking-tight ${healthLevel.color}`}>
                  {healthLevel.label}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-[10.5px] leading-relaxed">
              <Stethoscope className="h-3 w-3 shrink-0" />
              General wellness index and public health quality level.
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
        <MetricModalLayout variant="demographics">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
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
          </CardContent>
        </Card>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Demographics Trends</CardTitle>
              <CardDescription>Historical population and vital statistics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lifeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent className="facet-floating facet-refraction rounded-xl border border-white/10 bg-black/80" />
                      }
                    />
                    {chartType === "area" ? (
                      <Area
                        type="monotone"
                        dataKey="population"
                        stroke="#fbbf24"
                        fillOpacity={1}
                        fill="url(#popGrad)"
                        strokeWidth={2}
                        name="Population (M)"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="population"
                        fill="#fbbf24"
                        name="Population (M)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="population"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          dot={false}
                          name="Population (M)"
                        />
                        <Line
                          type="monotone"
                          dataKey="lifeExpectancy"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={false}
                          name="Life Expectancy"
                        />
                      </>
                    )}
                  </ChartComponent>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Peak Population
              </span>
              <span className="text-xl font-bold text-amber-500">
                {trendStats?.maxPopulation ? `${trendStats.maxPopulation.toFixed(2)} M` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Avg Life Expectancy
              </span>
              <span className="text-xl font-bold text-cyan-400">
                {trendStats?.avgLifeExpectancy
                  ? `${trendStats.avgLifeExpectancy.toFixed(1)} yrs`
                  : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Data Points
              </span>
              <span className="text-xl font-bold text-purple-400">
                {trendStats?.dataPoints || 0}
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
        <MetricModalLayout variant="demographics">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const demographics = economyData?.demographics;
    const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
    const globalAvgLife = 73.0;

    const compData = [
      {
        name: "Life Expectancy",
        "Your Country": lifeExpectancy,
        "Global Avg": globalAvgLife,
      },
      {
        name: "Median Age",
        "Your Country": demographics?.medianAge || countryData?.medianAge || 30.0,
        "Global Avg": 31.0,
      },
      {
        name: "Birth Rate (/10)",
        "Your Country": (demographics?.birthRate || 0) * 10,
        "Global Avg": 18 * 10,
      },
    ];

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex-1 border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-500" />
                Global Health Benchmark
              </CardTitle>
              <CardDescription>
                Compare demographic vitality indicators against standard global indexes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(18, 20, 24, 0.8)",
                        backdropFilter: "blur(8px)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Your Country" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Global Avg"
                      fill="rgba(255, 255, 255, 0.15)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                vs Global Avg Life
              </span>
              <span className="text-xl font-bold text-cyan-400">
                {lifeExpectancy >= globalAvgLife ? "Above Average" : "Below Average"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Life: {lifeExpectancy.toFixed(1)} yrs vs {globalAvgLife} yrs Avg
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Natural Growth
              </span>
              <span className="text-xl font-bold text-green-400">
                {(demographics?.birthRate || 0) > (demographics?.deathRate || 0)
                  ? "Positive"
                  : "Negative"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Natural Growth Rate:{" "}
                {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}/1k
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Age Structure
              </span>
              <span className="text-xl font-bold text-purple-400">
                {(demographics?.medianAge || 0) < 25
                  ? "Young"
                  : (demographics?.medianAge || 0) < 35
                    ? "Balanced"
                    : "Aging"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Median Age: {(demographics?.medianAge || countryData?.medianAge || 30.0).toFixed(1)}{" "}
                yrs
              </span>
            </div>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderDetailsTab = () => {
    if (isLoading) {
      return (
        <MetricModalLayout variant="demographics">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const demographics = economyData?.demographics;
    const ageDistribution = demographics?.ageDistribution;
    const youthPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("0-14"))?.percent || 25
      : 25;
    const workingPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("15-64") || a.group?.includes("15-"))
          ?.percent || 60
      : 60;
    const elderlyPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("65"))?.percent || 15
      : 15;

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Age Distribution</CardTitle>
              <CardDescription>Population breakdown by age group</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-blue-400">{youthPct.toFixed(0)}%</div>
                  <div className="text-muted-foreground mt-1 text-xs">0-14 Years</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-green-400">
                    {workingPct.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">15-64 Years</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-purple-400">
                    {elderlyPct.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">65+ Years</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-amber-400">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Dependency Ratio</div>
                </div>
              </div>

              {demographics?.educationLevels &&
                Array.isArray(demographics.educationLevels) &&
                demographics.educationLevels.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Education Attainment
                    </h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {demographics.educationLevels.slice(0, 8).map((level: any, i: number) => (
                        <div
                          key={level.level || i}
                          className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"
                        >
                          <div
                            className="text-base font-semibold"
                            style={{ color: level.color || "#06b6d4" }}
                          >
                            {(level.percentage || level.percent || 0).toFixed(0)}%
                          </div>
                          <div className="text-muted-foreground mt-1 text-[10px]">
                            {level.level}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-4">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="text-sm font-semibold">Societal Structure</CardTitle>
              <CardDescription className="text-[10px]">
                Education & Urbanization benchmarks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Literacy Rate
                </span>
                <div className="mt-1 text-lg font-bold text-green-400">
                  {(demographics?.literacyRate || 95).toFixed(1)}%
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Urban Population
                </span>
                <div className="mt-1 text-lg font-bold text-cyan-400">
                  {(demographics?.urbanRuralSplit?.urban || 60).toFixed(1)}%
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Rural Population
                </span>
                <div className="mt-1 text-lg font-bold text-purple-400">
                  {(demographics?.urbanRuralSplit?.rural || 40).toFixed(1)}%
                </div>
              </div>
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
      title="Demographics & Health"
      description="Population health and quality of life metrics"
      icon={Heart}
      iconColor="text-green-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="demographics"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default DemographicsHealthModal;
