"use client";

import React, { useMemo } from "react";
import {
  Heart,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  InfoCircle as Info,
  Activity,
  Lullaby as Baby,
  Clock,
  Healthcare as Stethoscope,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
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
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format, subMonths } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  // oxlint-disable-next-line eslint/no-unused-vars
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

    return filterAndSortHistory(historicalData, timeRange, (point, formattedDate, timestamp) => ({
      date: formattedDate,
      timestamp,
      population: (point.population || 0) / 1e6,
      lifeExpectancy: currentLifeExpectancy,
      birthRate: currentBirthRate,
      deathRate: currentDeathRate,
      medianAge: currentMedianAge,
    }));
  };

  const chartConfig = {
    lifeExpectancy: { label: "Life expectancy", color: "var(--chart-2)" },
    birthRate: { label: "Birth rate", color: "var(--color-blue-500)" },
    deathRate: { label: "Death rate", color: "var(--color-destructive)" },
    medianAge: { label: "Median age", color: "var(--chart-1)" },
    population: { label: "Population (M)", color: "var(--color-amber-500)" },
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
        color: "text-green",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "default",
      };
    if (lifeExpectancy >= 72)
      return {
        label: "Good",
        color: "text-label",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "default",
      };
    if (lifeExpectancy >= 65)
      return {
        label: "Average",
        color: "text-yellow",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "secondary",
      };
    return {
      label: "Below average",
      color: "text-destructive",
      bg: "bg-fill-3",
      border: "border-separator",
      variant: "destructive",
    };
  };

  // Default trends data for sidebar summary
  const defaultProcessedData = useMemo(
    // oxlint-disable-next-line
    () => processHistoricalData("1y"),
    // oxlint-disable-next-line
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
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Activity className="text-label-secondary h-5 w-5" />
                Health & vitality
              </h3>
              <p className="text-label-secondary text-body">
                Population health indicators and quality of life metrics.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-destructive text-title-3 tabular-nums">
                    {(demographics?.deathRate || 0).toFixed(1)}/1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Death rate
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green tabular-nums">
                    {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}
                    /1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Natural growth
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3 tabular-nums">
                    {(demographics?.migrationRate || 0).toFixed(1)}/1k
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Migration rate
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3 tabular-nums">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Dependency ratio
                  </span>
                </Card>
              </div>

              <Card
                variant="inset"
                padding="none"
                className="text-label-secondary text-footnote mt-6 flex items-start gap-3 p-4"
              >
                <Info className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Health and Demographics track the biological vitality of your citizens. Balanced
                  median age supports stable labor pipelines, while natural population growth
                  sustains resource-consumption curves and tax bases.
                </p>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Life expectancy"
            value={lifeExpectancy}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Heart}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Birth rate"
            value={demographics?.birthRate || 0}
            suffix=" /1k"
            decimalPlaces={1}
            icon={Baby}
            variant="demographics"
          />
          <MetricModalLayout.StatCard
            label="Median age"
            value={demographics?.medianAge || countryData?.medianAge || 0}
            suffix=" yrs"
            decimalPlaces={1}
            icon={Clock}
            variant="demographics"
          />

          <div
            className={`rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden border p-4 ${healthLevel.bg} ${healthLevel.border}`}
          >
            <div>
              <span className="text-stat-label text-label-secondary block">Health status</span>
              <div className="mt-2">
                <span className={`text-title-3 ${healthLevel.color}`}>{healthLevel.label}</span>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-4 flex items-center gap-2 leading-relaxed">
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
        <Card>
          <CardContent className="py-12 text-center">
            <LineChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Demographics trends</h3>
              <p className="text-label-secondary text-body">
                Historical population and vital statistics
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amber-500)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-amber-500)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lifeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" tickLine={false} />
                    <YAxis stroke="var(--color-label-secondary)" tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {chartType === "area" ? (
                      <Area
                        type="monotone"
                        dataKey="population"
                        stroke="var(--color-amber-500)"
                        fillOpacity={1}
                        fill="url(#popGrad)"
                        strokeWidth={2}
                        name="Population (M)"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="population"
                        fill="var(--color-amber-500)"
                        name="Population (M)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="population"
                          stroke="var(--color-amber-500)"
                          strokeWidth={2}
                          dot={false}
                          name="Population (M)"
                        />
                        <Line
                          type="monotone"
                          dataKey="lifeExpectancy"
                          stroke="var(--chart-2)"
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Peak population
              </span>
              <span className="text-label text-title-2">
                {trendStats?.maxPopulation ? `${trendStats.maxPopulation.toFixed(2)} M` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Avg life expectancy
              </span>
              <span className="text-label text-title-2">
                {trendStats?.avgLifeExpectancy
                  ? `${trendStats.avgLifeExpectancy.toFixed(1)} yrs`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Data points</span>
              <span className="text-label text-title-2">{trendStats?.dataPoints || 0}</span>
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
          <Card className="flex-1 p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Globe className="text-label-secondary h-5 w-5" />
                Global health benchmark
              </h3>
              <p className="text-label-secondary text-body">
                Compare demographic vitality indicators against standard global indexes.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="name" stroke="var(--color-label-secondary)" tickLine={false} />
                    <YAxis stroke="var(--color-label-secondary)" tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-elevated)",
                        color: "var(--color-label)",
                        borderColor: "var(--color-separator)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Your Country" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Global Avg"
                      fill="var(--color-label-secondary)"
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                vs Global Avg Life
              </span>
              <span className="text-label text-title-2">
                {lifeExpectancy >= globalAvgLife ? "Above Average" : "Below Average"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
                Life: {lifeExpectancy.toFixed(1)} yrs vs {globalAvgLife} yrs Avg
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Natural growth
              </span>
              <span className="text-title-2 text-green">
                {(demographics?.birthRate || 0) > (demographics?.deathRate || 0)
                  ? "Positive"
                  : "Negative"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
                Natural Growth Rate:{" "}
                {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}/1k
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Age structure</span>
              <span className="text-label text-title-2">
                {(demographics?.medianAge || 0) < 25
                  ? "Young"
                  : (demographics?.medianAge || 0) < 35
                    ? "Balanced"
                    : "Aging"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
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
      ? (ageDistribution as Array<{ group?: string; percent?: number }>).find((a) =>
          a.group?.includes("0-14")
        )?.percent || 25
      : 25;
    const workingPct = Array.isArray(ageDistribution)
      ? (ageDistribution as Array<{ group?: string; percent?: number }>).find(
          (a) => a.group?.includes("15-64") || a.group?.includes("15-")
        )?.percent || 60
      : 60;
    const elderlyPct = Array.isArray(ageDistribution)
      ? (ageDistribution as Array<{ group?: string; percent?: number }>).find((a) =>
          a.group?.includes("65")
        )?.percent || 15
      : 15;

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Age distribution</h3>
              <p className="text-label-secondary text-body">Population breakdown by age group</p>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{youthPct.toFixed(0)}%</div>
                  <div className="text-label-secondary text-footnote mt-1">0-14 Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">{workingPct.toFixed(0)}%</div>
                  <div className="text-label-secondary text-footnote mt-1">15-64 Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{elderlyPct.toFixed(0)}%</div>
                  <div className="text-label-secondary text-footnote mt-1">65+ Years</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <div className="text-label-secondary text-footnote mt-1">Dependency ratio</div>
                </Card>
              </div>

              {demographics?.educationLevels &&
                Array.isArray(demographics.educationLevels) &&
                demographics.educationLevels.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-label text-headline mb-3">Education attainment</h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(
                        demographics.educationLevels as Array<{
                          level?: string;
                          percentage?: number;
                          percent?: number;
                          color?: string;
                        }>
                      )
                        .slice(0, 8)
                        .map((level, i) => (
                          <div
                            key={level.level || i}
                            className="bg-fill-3 rounded-row p-3 text-center"
                          >
                            <div
                              className="text-title-3"
                              style={{ color: level.color || "var(--color-chart-2)" }}
                            >
                              {(level.percentage || level.percent || 0).toFixed(0)}%
                            </div>
                            <div className="text-label-secondary text-footnote mt-1">
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
          <Card className="flex flex-1 flex-col justify-between p-4">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 text-headline">Societal structure</h3>
              <p className="text-label-secondary text-footnote">
                Education & urbanization benchmarks
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Literacy rate</span>
                <div className="text-title-3 text-green mt-1">
                  {(demographics?.literacyRate || 95).toFixed(1)}%
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Urban population</span>
                <div className="text-label text-title-3 mt-1">
                  {(demographics?.urbanRuralSplit?.urban || 60).toFixed(1)}%
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Rural population</span>
                <div className="text-title-3 text-green mt-1">
                  {(demographics?.urbanRuralSplit?.rural || 40).toFixed(1)}%
                </div>
              </Card>
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
      title="Demographics & health"
      description="Population health and quality of life metrics"
      icon={Heart}
      iconColor="text-green"
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
