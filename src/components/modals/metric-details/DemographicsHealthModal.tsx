"use client";

import React from "react";
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
} from "recharts";
import { format, subMonths } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
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

/**
 * DemographicsHealthModal - Population health and demographics analysis
 *
 * Displays:
 * - Overview: Life expectancy, birth/death rates, median age
 * - Trends: Historical health metrics with time range control
 * - Comparison: Global/regional benchmarking
 * - Details: Age distribution, health indicators, quality of life
 */
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
    api.countries.getHistoricalData.useQuery(
      { countryId },
      { enabled: !!countryId && isOpen }
    );

  // Fetch global stats for comparison
  const { data: globalStats, isLoading: globalLoading } =
    api.countries.getGlobalStats.useQuery(undefined, { enabled: isOpen });

  const isLoading = countryLoading || historicalLoading || globalLoading;

  // Process historical data for charts
  // HistoricalDataPoint has population & populationGrowthRate; use current snapshot for other metrics
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
    const cutoffDate =
      monthsToShow === Infinity ? new Date(0) : subMonths(now, monthsToShow);

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
      .sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  };

  const chartConfig = {
    lifeExpectancy: { label: "Life Expectancy", color: "#16a34a" },
    birthRate: { label: "Birth Rate", color: "#2563eb" },
    deathRate: { label: "Death Rate", color: "#dc2626" },
    medianAge: { label: "Median Age", color: "#7c3aed" },
    population: { label: "Population (M)", color: "#f59e0b" },
  };

  const getHealthLevel = (lifeExpectancy: number): { label: string; color: string; variant: "default" | "secondary" | "destructive" } => {
    if (lifeExpectancy >= 78) return { label: "Excellent", color: "text-green-600", variant: "default" };
    if (lifeExpectancy >= 72) return { label: "Good", color: "text-blue-600", variant: "default" };
    if (lifeExpectancy >= 65) return { label: "Average", color: "text-yellow-600", variant: "secondary" };
    return { label: "Below Average", color: "text-red-600", variant: "destructive" };
  };

  const renderTabContent = (
    activeTab: string,
    timeRange: TimeRange,
    chartType: ChartType
  ) => {
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

    const demographics = economyData?.demographics;
    const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
    const healthLevel = getHealthLevel(lifeExpectancy);

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Life Expectancy
                  </p>
                  <p className={`text-2xl font-bold ${healthLevel.color}`}>
                    <NumberFlowDisplay
                      value={lifeExpectancy}
                      decimalPlaces={1}
                    /> yrs
                  </p>
                </div>
                <Heart className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Birth Rate
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    <NumberFlowDisplay
                      value={demographics?.birthRate || 0}
                      decimalPlaces={1}
                    />/1k
                  </p>
                </div>
                <Baby className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Median Age
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    <NumberFlowDisplay
                      value={demographics?.medianAge || countryData?.medianAge || 0}
                      decimalPlaces={1}
                    /> yrs
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Health Status
                  </p>
                  <Badge variant={healthLevel.variant} className="mt-1 text-lg">
                    {healthLevel.label}
                  </Badge>
                </div>
                <Stethoscope className={`h-8 w-8 ${healthLevel.color}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demographics Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Health & Vitality
            </CardTitle>
            <CardDescription>
              Population health indicators and quality of life metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {(demographics?.deathRate || 0).toFixed(1)}/1k
                </div>
                <div className="text-muted-foreground text-sm">Death Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}/1k
                </div>
                <div className="text-muted-foreground text-sm">Natural Growth</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {(demographics?.migrationRate || 0).toFixed(1)}/1k
                </div>
                <div className="text-muted-foreground text-sm">Migration Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {(demographics?.dependencyRatio || 50).toFixed(0)}%
                </div>
                <div className="text-muted-foreground text-sm">Dependency Ratio</div>
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
      return <Skeleton className="h-80" />;
    }

    if (processedData.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    const ChartComponent = chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Demographics Trends</CardTitle>
          <CardDescription>
            Historical population and vital statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ChartComponent data={processedData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {chartType === "area" ? (
                  <Area
                    type="monotone"
                    dataKey="population"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                    name="Population (M)"
                  />
                ) : chartType === "bar" ? (
                  <Bar dataKey="population" fill="#f59e0b" name="Population (M)" />
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="population"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Population (M)"
                    />
                    <Line
                      type="monotone"
                      dataKey="lifeExpectancy"
                      stroke="#16a34a"
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

    const demographics = economyData?.demographics;
    const lifeExpectancy = demographics?.lifeExpectancy || countryData?.lifeExpectancy || 0;
    const globalAvgLife = 73; // Placeholder
    const healthLevel = getHealthLevel(lifeExpectancy);

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-500" />
              Global Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Life Expectancy</span>
                <Badge variant={lifeExpectancy >= globalAvgLife ? "default" : "secondary"}>
                  {lifeExpectancy >= globalAvgLife ? "Above Avg" : "Below Avg"}
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${healthLevel.color}`}>
                  {lifeExpectancy.toFixed(1)} yrs
                </div>
                <div className="text-sm text-muted-foreground">
                  vs {globalAvgLife} yrs global average
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Baby className="h-4 w-4 text-green-500" />
              Population Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Growth Status</span>
                <Badge
                  variant={
                    (demographics?.birthRate || 0) > (demographics?.deathRate || 0)
                      ? "default"
                      : "destructive"
                  }
                >
                  {(demographics?.birthRate || 0) > (demographics?.deathRate || 0) ? "Growing" : "Declining"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {((demographics?.birthRate || 0) - (demographics?.deathRate || 0)).toFixed(1)}/1k
                </div>
                <div className="text-sm text-muted-foreground">
                  Natural growth rate
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-purple-500" />
              Age Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Population Type</span>
                <Badge variant="outline">
                  {(demographics?.medianAge || 0) < 25
                    ? "Young"
                    : (demographics?.medianAge || 0) < 35
                    ? "Balanced"
                    : "Aging"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {(demographics?.medianAge || countryData?.medianAge || 0).toFixed(1)} yrs
                </div>
                <div className="text-sm text-muted-foreground">
                  Median age
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

    const demographics = economyData?.demographics;
    // Age distribution from mapped data (array of {group, percentage})
    const ageDistribution = demographics?.ageDistribution;
    const youthPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("0-14"))?.percentage || 25
      : 25;
    const workingPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("15-64") || a.group?.includes("15-"))?.percentage || 60
      : 60;
    const elderlyPct = Array.isArray(ageDistribution)
      ? ageDistribution.find((a: any) => a.group?.includes("65"))?.percentage || 15
      : 15;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
            <CardDescription>Population breakdown by age group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-blue-600">
                  {youthPct.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">0-14 Years</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-green-600">
                  {workingPct.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">15-64 Years</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-purple-600">
                  {elderlyPct.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">65+ Years</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-amber-600">
                  {(demographics?.dependencyRatio || 50).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Dependency Ratio</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Education & Literacy</CardTitle>
            <CardDescription>Population education and knowledge metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {(demographics?.literacyRate || 95).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Literacy Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {(demographics?.urbanRuralSplit?.urban || 60).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Urban Population
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {(demographics?.urbanRuralSplit?.rural || 40).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Rural Population
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Education Levels breakdown if available */}
        {demographics?.educationLevels && Array.isArray(demographics.educationLevels) && demographics.educationLevels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Education Levels</CardTitle>
              <CardDescription>Population by education attainment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {demographics.educationLevels.slice(0, 8).map((level: any, i: number) => (
                  <div key={level.level || i} className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-semibold" style={{ color: level.color || '#6366f1' }}>
                      {(level.percentage || level.percent || 0).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">{level.level}</div>
                  </div>
                ))}
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
      title="Demographics & Health"
      description="Population health and quality of life metrics"
      icon={Heart}
      iconColor="text-green-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default DemographicsHealthModal;
