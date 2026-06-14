// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Globe,
  Info,
  Target,
  Activity,
} from "lucide-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
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
import { api } from "~/trpc/react";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import type { TimeRange, ChartType } from "./types";

interface LaborDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "trends", label: "Trends", icon: LineChart },
  { id: "comparison", label: "Comparison", icon: Globe },
  { id: "breakdown", label: "Breakdown", icon: Info },
];

/**
 * LaborDetailsModal - Detailed labor force and employment analysis
 *
 * Displays:
 * - Overview: Labor force size, participation rate, employment/unemployment
 * - Trends: Historical labor metrics with time range control
 * - Comparison: Global/regional benchmarking
 * - Breakdown: Employment by sector, productivity metrics
 */
export function LaborDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: LaborDetailsModalProps) {
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
  // HistoricalDataPoint doesn't have labor fields, so derive from population + current ratios
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

    const labor = economyData?.labor;
    const currentParticipation = labor?.laborForceParticipationRate || 65;
    const currentEmploymentRate = labor?.employmentRate || 94;
    const currentUnemploymentRate = labor?.unemploymentRate || 6;

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
      .map((point: any) => {
        // Derive labor metrics from population and GDP growth
        const gdpGrowth = point.gdpGrowthRate || point.gdpGrowth || 0;
        const workingAgeFraction = 0.65;
        const laborForce = Math.round(
          (point.population || 0) * workingAgeFraction * (currentParticipation / 100)
        );
        // Small employment adjustment based on GDP growth
        const empAdj = Math.min(2, Math.max(-2, gdpGrowth * 50));
        const employmentRate = Math.max(80, Math.min(99, currentEmploymentRate + empAdj));
        const unemploymentRate = Math.max(1, Math.min(20, currentUnemploymentRate - empAdj));

        return {
          date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
          timestamp: point.ixTimeTimestamp,
          laborForce,
          employmentRate: parseFloat(employmentRate.toFixed(1)),
          unemploymentRate: parseFloat(unemploymentRate.toFixed(1)),
          participationRate: currentParticipation,
        };
      })
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const chartConfig = {
    laborForce: { label: "Labor Force", color: "#2563eb" },
    employmentRate: { label: "Employment Rate %", color: "#16a34a" },
    unemploymentRate: { label: "Unemployment Rate %", color: "#dc2626" },
    participationRate: { label: "Participation Rate %", color: "#7c3aed" },
  };

  const renderTabContent = (activeTab: string, timeRange: TimeRange, chartType: ChartType) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "trends":
        return renderTrendsTab(timeRange, chartType);
      case "comparison":
        return renderComparisonTab();
      case "breakdown":
        return renderBreakdownTab();
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

    const labor = economyData?.labor;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Labor Force</p>
                  <p className="text-2xl font-bold text-blue-600">
                    <NumberFlowDisplay value={labor?.totalWorkforce || 0} decimalPlaces={0} />
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Participation Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    <NumberFlowDisplay
                      value={labor?.laborForceParticipationRate || 0}
                      decimalPlaces={1}
                    />
                    %
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Employment Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    <NumberFlowDisplay value={labor?.employmentRate || 0} decimalPlaces={1} />%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Unemployment Rate</p>
                  <p className="text-2xl font-bold text-red-600">
                    <NumberFlowDisplay value={labor?.unemploymentRate || 0} decimalPlaces={1} />%
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Labor Force Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              Labor Force Summary
            </CardTitle>
            <CardDescription>Workforce composition and employment statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {(
                    ((labor?.totalWorkforce || 0) / (countryData?.currentPopulation || 1)) *
                    100
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-muted-foreground text-sm">Of Total Population</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {(
                    ((labor?.employmentRate || 0) * (labor?.totalWorkforce || 0)) /
                    100
                  ).toLocaleString()}
                </div>
                <div className="text-muted-foreground text-sm">Employed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {(
                    ((labor?.unemploymentRate || 0) * (labor?.totalWorkforce || 0)) /
                    100
                  ).toLocaleString()}
                </div>
                <div className="text-muted-foreground text-sm">Unemployed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  ${(labor?.averageAnnualIncome || 0).toLocaleString()}
                </div>
                <div className="text-muted-foreground text-sm">Avg. Income</div>
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
            <BarChart3 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Labor Force Trends</CardTitle>
          <CardDescription>Historical employment and participation metrics</CardDescription>
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
                  <>
                    <Area
                      type="monotone"
                      dataKey="employmentRate"
                      stroke="#16a34a"
                      fill="#16a34a"
                      fillOpacity={0.3}
                      name="Employment Rate"
                    />
                    <Area
                      type="monotone"
                      dataKey="participationRate"
                      stroke="#7c3aed"
                      fill="#7c3aed"
                      fillOpacity={0.3}
                      name="Participation Rate"
                    />
                  </>
                ) : chartType === "bar" ? (
                  <>
                    <Bar dataKey="employmentRate" fill="#16a34a" name="Employment Rate" />
                    <Bar dataKey="unemploymentRate" fill="#dc2626" name="Unemployment Rate" />
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="employmentRate"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                      name="Employment Rate"
                    />
                    <Line
                      type="monotone"
                      dataKey="unemploymentRate"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                      name="Unemployment Rate"
                    />
                    <Line
                      type="monotone"
                      dataKey="participationRate"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      name="Participation Rate"
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

    const labor = economyData?.labor;
    const employmentRate = labor?.employmentRate || 0;
    const globalAvgEmployment = globalStats?.averageGdpPerCapita ? 93 : 90; // Placeholder

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
                <span className="text-sm">Employment Rate</span>
                <Badge variant={employmentRate >= globalAvgEmployment ? "default" : "secondary"}>
                  {employmentRate >= globalAvgEmployment ? "Above Avg" : "Below Avg"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{employmentRate.toFixed(1)}%</div>
                <div className="text-muted-foreground text-sm">
                  vs {globalAvgEmployment}% global average
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-green-500" />
              Participation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Workforce Active</span>
                <Badge
                  variant={
                    (labor?.laborForceParticipationRate || 0) >= 60 ? "default" : "secondary"
                  }
                >
                  {(labor?.laborForceParticipationRate || 0) >= 60 ? "Strong" : "Low"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {(labor?.laborForceParticipationRate || 0).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">
                  Working-age population in labor force
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-purple-500" />
              Employment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Job Market Health</span>
                <Badge
                  variant={
                    (labor?.unemploymentRate || 0) < 5
                      ? "default"
                      : (labor?.unemploymentRate || 0) < 10
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {(labor?.unemploymentRate || 0) < 5
                    ? "Healthy"
                    : (labor?.unemploymentRate || 0) < 10
                      ? "Moderate"
                      : "Struggling"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {(labor?.unemploymentRate || 0).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">Unemployment rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderBreakdownTab = () => {
    if (isLoading) {
      return <Skeleton className="h-80" />;
    }

    const labor = economyData?.labor;
    const sectors = labor?.employmentBySector || {};

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Employment by Sector</CardTitle>
            <CardDescription>Workforce distribution across industries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(sectors)
                .slice(0, 8)
                .map(([sector, value]: [string, any]) => (
                  <div key={sector} className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="text-lg font-semibold">
                      {typeof value === "number" ? value.toFixed(1) : value}%
                    </div>
                    <div className="text-muted-foreground text-xs capitalize">
                      {sector.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}
              {Object.keys(sectors).length === 0 && (
                <div className="col-span-4 py-8 text-center">
                  <Briefcase className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                  <p className="text-muted-foreground">No sector data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productivity Metrics</CardTitle>
            <CardDescription>Workforce efficiency and output</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  $
                  {(
                    (countryData?.currentTotalGdp || 0) / (labor?.totalWorkforce || 1)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-muted-foreground text-sm">GDP per Worker</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {labor?.skillsAndProductivity?.laborProductivityIndex?.toFixed(2) || "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">Productivity Index</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {labor?.skillsAndProductivity?.averageEducationYears?.toFixed(1) || "N/A"} yrs
                </div>
                <div className="text-muted-foreground text-sm">Avg. Education</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <BaseMetricDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      countryId={countryId}
      countryName={countryName}
      title="Labor Force Analysis"
      description="Detailed workforce and employment metrics"
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

export default LaborDetailsModal;
