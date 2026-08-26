"use client";

import React, { useMemo } from "react";
import {
  Group as Users,
  Suitcase as Briefcase,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  InfoCircle as Info,
  Activity,
  Calculator,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
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
import { api } from "~/trpc/react";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
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
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

    const labor = economyData?.labor;
    const currentParticipation = labor?.laborForceParticipationRate || 65;
    const currentEmploymentRate = labor?.employmentRate || 94;
    const currentUnemploymentRate = labor?.unemploymentRate || 6;

    const now = new Date();
    const rangeMap: Record<TimeRange, number> = {
      "3m": 3,
      "6m": 6,
      "1y": 12,
      "2y": 24,
      "4y": 48,
      "5y": 60,
      "20y": 240,
      all: Infinity,
    };

    const monthsToShow = rangeMap[timeRange] || 12;
    const cutoffDate = monthsToShow === Infinity ? new Date(0) : subMonths(now, monthsToShow);

    return historicalData
      .filter((point: any) => new Date(point.ixTimeTimestamp) >= cutoffDate)
      .slice(-100)
      .map((point: any) => {
        const gdpGrowth = point.gdpGrowthRate || point.gdpGrowth || 0;
        const workingAgeFraction = 0.65;
        const laborForce = Math.round(
          (point.population || 0) * workingAgeFraction * (currentParticipation / 100)
        );
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
    laborForce: { label: "Labor Force", color: "#3b82f6" },
    employmentRate: { label: "Employment Rate %", color: "#10b981" },
    unemploymentRate: { label: "Unemployment Rate %", color: "#ef4444" },
    participationRate: { label: "Participation Rate %", color: "#8b5cf6" },
  };

  // Derive labor stats
  const defaultProcessedData = useMemo(
    () => processHistoricalData("1y"),
    [historicalData, economyData]
  );
  const laborStats = useMemo(() => {
    if (!defaultProcessedData || defaultProcessedData.length === 0) return null;
    const rates = defaultProcessedData.map((p) => p.employmentRate);
    const unemp = defaultProcessedData.map((p) => p.unemploymentRate);
    const part = defaultProcessedData.map((p) => p.participationRate);

    return {
      maxEmployment: Math.max(...rates),
      minUnemployment: Math.min(...unemp),
      avgParticipation: part.reduce((acc, v) => acc + v, 0) / part.length,
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
      case "breakdown":
        return renderBreakdownTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (isLoading) {
      return (
        <MetricModalLayout variant="labor">
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

    const labor = economyData?.labor;

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-500" />
                Labor Force Composition
              </CardTitle>
              <CardDescription>
                Workforce composition and national employment statistics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {(
                      ((labor?.totalWorkforce || 0) / (countryData?.currentPopulation || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
                    Of Population
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {(
                      ((labor?.employmentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
                    Employed
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-red-400">
                    {(
                      ((labor?.unemploymentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
                    Unemployed
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    ${(labor?.averageAnnualIncome || 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
                    Avg. Income
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-lg border border-blue-500/10 bg-blue-500/5 p-4 text-xs">
                <Info className="text-blue-450 mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Workforce dynamics play a critical role in determining overall production
                  efficiency and industrial stability. High employment rates support higher consumer
                  demand and stability, while the average income influences domestic market
                  velocity.
                </p>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Total Workforce"
            value={labor?.totalWorkforce || 0}
            decimalPlaces={0}
            icon={Users}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Participation Rate"
            value={labor?.laborForceParticipationRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={Activity}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Employment Rate"
            value={labor?.employmentRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={TrendingUp}
            variant="labor"
          />
          <MetricModalLayout.StatCard
            label="Unemployment Rate"
            value={labor?.unemploymentRate || 0}
            suffix="%"
            decimalPlaces={1}
            icon={TrendingDown}
            variant="labor"
          />
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange, chartType: ChartType) => {
    const processedData = processHistoricalData(timeRange);

    if (historicalLoading) {
      return (
        <MetricModalLayout variant="labor">
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
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Labor Force Trends</CardTitle>
              <CardDescription>Historical employment and participation metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="partGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                      <>
                        <Area
                          type="monotone"
                          dataKey="employmentRate"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#empGrad)"
                          strokeWidth={2}
                          name="Employment Rate"
                        />
                        <Area
                          type="monotone"
                          dataKey="participationRate"
                          stroke="#8b5cf6"
                          fillOpacity={1}
                          fill="url(#partGrad)"
                          strokeWidth={2}
                          name="Participation Rate"
                        />
                      </>
                    ) : chartType === "bar" ? (
                      <>
                        <Bar
                          dataKey="employmentRate"
                          fill="#10b981"
                          name="Employment Rate"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="unemploymentRate"
                          fill="#ef4444"
                          name="Unemployment Rate"
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="employmentRate"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="Employment Rate"
                        />
                        <Line
                          type="monotone"
                          dataKey="unemploymentRate"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          name="Unemployment Rate"
                        />
                        <Line
                          type="monotone"
                          dataKey="participationRate"
                          stroke="#8b5cf6"
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
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Max Employment Rate
              </span>
              <span className="text-xl font-bold text-green-400">
                {laborStats?.maxEmployment ? `${laborStats.maxEmployment.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Min Unemployment Rate
              </span>
              <span className="text-xl font-bold text-red-400">
                {laborStats?.minUnemployment ? `${laborStats.minUnemployment.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Avg Participation
              </span>
              <span className="text-xl font-bold text-purple-400">
                {laborStats?.avgParticipation
                  ? `${laborStats.avgParticipation.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Data Points Analyzed
              </span>
              <span className="text-xl font-bold text-blue-400">{laborStats?.dataPoints || 0}</span>
            </div>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderComparisonTab = () => {
    if (isLoading) {
      return (
        <MetricModalLayout variant="labor">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const labor = economyData?.labor;
    const employmentRate = labor?.employmentRate || 0;
    const globalAvgEmployment = globalStats?.avgGdpPerCapita ? 93 : 90;

    const comparisonData = [
      {
        name: "Employment",
        "Your Country": employmentRate,
        "Global Avg": globalAvgEmployment,
      },
      {
        name: "Participation",
        "Your Country": labor?.laborForceParticipationRate || 0,
        "Global Avg": 65.0,
      },
      {
        name: "Unemployment",
        "Your Country": labor?.unemploymentRate || 0,
        "Global Avg": 6.5,
      },
    ];

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex-1 border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Benchmark Analysis
              </CardTitle>
              <CardDescription>
                Comparison of national labor indicators against global benchmark rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                    <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                    <YAxis stroke="rgba(255, 255, 255, 0.3)" tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(18, 20, 24, 0.8)",
                        backdropFilter: "blur(8px)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="Your Country" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                Global Comparison
              </span>
              <span className="text-xl font-bold text-blue-400">
                {employmentRate >= globalAvgEmployment ? "Above Average" : "Below Average"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Employment: {employmentRate.toFixed(1)}% vs {globalAvgEmployment}% Avg
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Workforce Activity
              </span>
              <span className="text-xl font-bold text-green-400">
                {(labor?.laborForceParticipationRate || 0) >= 60 ? "Strong" : "Low"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Active Participation Rate: {(labor?.laborForceParticipationRate || 0).toFixed(1)}%
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Job Market Health
              </span>
              <span className="text-xl font-bold text-purple-400">
                {(labor?.unemploymentRate || 0) < 5
                  ? "Healthy"
                  : (labor?.unemploymentRate || 0) < 10
                    ? "Moderate"
                    : "Struggling"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Unemployment Rate: {(labor?.unemploymentRate || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderBreakdownTab = () => {
    if (isLoading) {
      return (
        <MetricModalLayout variant="labor">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const labor = economyData?.labor;
    const sectors = labor?.employmentBySector || {};

    const sectorData = Object.entries(sectors)
      .slice(0, 8)
      .map(([name, value]: [string, any]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: typeof value === "number" ? parseFloat(value.toFixed(1)) : parseFloat(value),
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Employment by Sector</CardTitle>
              <CardDescription>
                Workforce distribution across key industrial sectors
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {sectorData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis type="number" stroke="rgba(255, 255, 255, 0.3)" tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="rgba(255, 255, 255, 0.3)"
                        tickLine={false}
                        width={100}
                        tick={{ fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(18, 20, 24, 0.8)",
                          backdropFilter: "blur(8px)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        name="Percentage %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="text-muted-foreground mb-2 h-8 w-8 opacity-40" />
                  <p className="text-muted-foreground text-sm">No sector data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-4">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="text-sm font-semibold">Productivity Metrics</CardTitle>
              <CardDescription className="text-[10px]">
                Workforce efficiency and output
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  GDP per Worker
                </span>
                <div className="mt-1 text-lg font-bold text-blue-400">
                  $
                  {(
                    (countryData?.currentTotalGdp || 0) / (labor?.totalWorkforce || 1)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Productivity Index
                </span>
                <div className="mt-1 text-lg font-bold text-green-400">
                  {labor?.skillsAndProductivity?.laborProductivityIndex?.toFixed(2) || "1.00"}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Avg. Education
                </span>
                <div className="mt-1 text-lg font-bold text-purple-400">
                  {labor?.skillsAndProductivity?.averageEducationYears?.toFixed(1) || "12.0"} Years
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
      title="Labor Force Analysis"
      description="Detailed workforce and employment metrics"
      icon={Users}
      iconColor="text-blue-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="labor"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default LaborDetailsModal;
