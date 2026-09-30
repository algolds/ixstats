"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
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
import { FacetCard, FacetCardHeader, FacetCardContent } from "~/components/ui/facet-container";
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
    lifeExpectancy: { label: "Life Expectancy", color: "var(--chart-2)" },
    birthRate: { label: "Birth Rate", color: "var(--color-blue-500)" },
    deathRate: { label: "Death Rate", color: "var(--destructive)" },
    medianAge: { label: "Median Age", color: "var(--chart-1)" },
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
        color: "text-emerald-500",
        bg: "bg-muted/50",
        border: "border-border",
        variant: "default",
      };
    if (lifeExpectancy >= 72)
      return {
        label: "Good",
        color: "text-foreground",
        bg: "bg-muted/50",
        border: "border-border",
        variant: "default",
      };
    if (lifeExpectancy >= 65)
      return {
        label: "Average",
        color: "text-amber-500",
        bg: "bg-muted/50",
        border: "border-border",
        variant: "secondary",
      };
    return {
      label: "Below Average",
      color: "text-destructive",
      bg: "bg-muted/50",
      border: "border-border",
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
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Activity className="text-muted-foreground h-5 w-5" />
                Health & Vitality
              </h3>
              <p className="text-muted-foreground text-sm">
                Population health indicators and quality of life metrics.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-destructive text-lg font-bold tabular-nums">
                    {(demographics?.deathRate || 0).toFixed(1)}/1k
                  </div>
                  <Eyebrow className="mt-1 block">Death Rate</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500 tabular-nums">
                    {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}
                    /1k
                  </div>
                  <Eyebrow className="mt-1 block">Natural Growth</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold tabular-nums">
                    {(demographics?.migrationRate || 0).toFixed(1)}/1k
                  </div>
                  <Eyebrow className="mt-1 block">Migration Rate</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold tabular-nums">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <Eyebrow className="mt-1 block">Dependency Ratio</Eyebrow>
                </div>
              </div>

              <div className="text-muted-foreground bg-muted/50 mt-6 flex items-start gap-3 rounded-xl p-4 text-xs">
                <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Health and Demographics track the biological vitality of your citizens. Balanced
                  median age supports stable labor pipelines, while natural population growth
                  sustains resource-consumption curves and tax bases.
                </p>
              </div>
            </FacetCardContent>
          </FacetCard>
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
              <Eyebrow className="block">Health Status</Eyebrow>
              <div className="mt-2">
                <span className={`text-lg font-bold tracking-tight ${healthLevel.color}`}>
                  {healthLevel.label}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs leading-relaxed">
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
        <FacetCard surface="solid" className="rounded-xl">
          <FacetCardContent className="py-12 text-center">
            <LineChart className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">No historical data available</p>
          </FacetCardContent>
        </FacetCard>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <MetricModalLayout variant="demographics">
        <MetricModalLayout.MainArea>
          <FacetCard surface="solid" className="rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">Demographics Trends</h3>
              <p className="text-muted-foreground text-sm">
                Historical population and vital statistics
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" tickLine={false} />
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
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Peak Population</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {trendStats?.maxPopulation ? `${trendStats.maxPopulation.toFixed(2)} M` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Avg Life Expectancy</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {trendStats?.avgLifeExpectancy
                  ? `${trendStats.avgLifeExpectancy.toFixed(1)} yrs`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Data Points</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
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
          <FacetCard surface="solid" className="flex-1 rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Globe className="text-muted-foreground h-5 w-5" />
                Global Health Benchmark
              </h3>
              <p className="text-muted-foreground text-sm">
                Compare demographic vitality indicators against standard global indexes.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Your Country" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Global Avg"
                      fill="var(--muted-foreground)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">vs Global Avg Life</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {lifeExpectancy >= globalAvgLife ? "Above Average" : "Below Average"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Life: {lifeExpectancy.toFixed(1)} yrs vs {globalAvgLife} yrs Avg
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Natural Growth</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {(demographics?.birthRate || 0) > (demographics?.deathRate || 0)
                  ? "Positive"
                  : "Negative"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Natural Growth Rate:{" "}
                {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}/1k
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Age Structure</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {(demographics?.medianAge || 0) < 25
                  ? "Young"
                  : (demographics?.medianAge || 0) < 35
                    ? "Balanced"
                    : "Aging"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
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
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">Age Distribution</h3>
              <p className="text-muted-foreground text-sm">Population breakdown by age group</p>
            </FacetCardHeader>
            <FacetCardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {youthPct.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">0-14 Years</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    {workingPct.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">15-64 Years</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {elderlyPct.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">65+ Years</div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {(demographics?.dependencyRatio || 50).toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Dependency Ratio</div>
                </div>
              </div>

              {demographics?.educationLevels &&
                Array.isArray(demographics.educationLevels) &&
                demographics.educationLevels.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-foreground mb-3 text-sm font-semibold">
                      Education Attainment
                    </h4>
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
                            className="bg-muted/50 rounded-xl p-3 text-center"
                          >
                            <div
                              className="text-base font-semibold"
                              style={{ color: level.color || "var(--color-chart-2)" }}
                            >
                              {(level.percentage || level.percent || 0).toFixed(0)}%
                            </div>
                            <div className="text-muted-foreground mt-1 text-xs">{level.level}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-4"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base text-sm font-semibold">
                Societal Structure
              </h3>
              <p className="text-muted-foreground text-xs">Education & Urbanization benchmarks</p>
            </FacetCardHeader>
            <FacetCardContent className="space-y-4 p-0">
              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>Literacy Rate</Eyebrow>
                <div className="mt-1 text-lg font-semibold text-emerald-500">
                  {(demographics?.literacyRate || 95).toFixed(1)}%
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>Urban Population</Eyebrow>
                <div className="text-foreground mt-1 text-lg font-semibold">
                  {(demographics?.urbanRuralSplit?.urban || 60).toFixed(1)}%
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>Rural Population</Eyebrow>
                <div className="mt-1 text-lg font-semibold text-emerald-500">
                  {(demographics?.urbanRuralSplit?.rural || 40).toFixed(1)}%
                </div>
              </div>
            </FacetCardContent>
          </FacetCard>
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
      iconColor="text-emerald-500"
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
