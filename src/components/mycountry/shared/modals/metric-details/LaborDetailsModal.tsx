"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
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
  // oxlint-disable-next-line eslint/no-unused-vars
  Calculator,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
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
import { api } from "~/trpc/react";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";

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

    return filterAndSortHistory(historicalData, timeRange, (point, formattedDate, timestamp) => {
      const gdpGrowth = point.gdpGrowthRate || 0;
      const workingAgeFraction = 0.65;
      const laborForce = Math.round(
        (point.population || 0) * workingAgeFraction * (currentParticipation / 100)
      );
      const empAdj = Math.min(2, Math.max(-2, gdpGrowth * 50));
      const employmentRate = Math.max(80, Math.min(99, currentEmploymentRate + empAdj));
      const unemploymentRate = Math.max(1, Math.min(20, currentUnemploymentRate - empAdj));

      return {
        date: formattedDate,
        timestamp,
        laborForce,
        employmentRate: parseFloat(employmentRate.toFixed(1)),
        unemploymentRate: parseFloat(unemploymentRate.toFixed(1)),
        participationRate: currentParticipation,
      };
    });
  };

  const chartConfig = {
    laborForce: { label: "Labor Force", color: "var(--color-blue-500)" },
    employmentRate: { label: "Employment Rate %", color: "var(--chart-3)" },
    unemploymentRate: { label: "Unemployment Rate %", color: "var(--destructive)" },
    participationRate: { label: "Participation Rate %", color: "var(--chart-1)" },
  };

  // Derive labor stats
  const defaultProcessedData = useMemo(
    // oxlint-disable-next-line
    () => processHistoricalData("1y"),
    // oxlint-disable-next-line
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
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Briefcase className="text-muted-foreground h-5 w-5" />
                Labor Force Composition
              </h3>
              <p className="text-muted-foreground text-sm">
                Workforce composition and national employment statistics.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    {(
                      ((labor?.totalWorkforce || 0) / (countryData?.currentPopulation || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <Eyebrow className="mt-1 block">Of Population</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    {(
                      ((labor?.employmentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <Eyebrow className="mt-1 block">Employed</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-destructive text-lg font-bold">
                    {(
                      ((labor?.unemploymentRate || 0) * (labor?.totalWorkforce || 0)) /
                      100
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <Eyebrow className="mt-1 block">Unemployed</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    ${(labor?.averageAnnualIncome || 0).toLocaleString()}
                  </div>
                  <Eyebrow className="mt-1 block">Avg. Income</Eyebrow>
                </div>
              </div>

              <div className="text-muted-foreground bg-muted/50 mt-6 flex items-start gap-3 rounded-xl p-4 text-xs">
                <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Workforce dynamics play a critical role in determining overall production
                  efficiency and industrial stability. High employment rates support higher consumer
                  demand and stability, while the average income influences domestic market
                  velocity.
                </p>
              </div>
            </FacetCardContent>
          </FacetCard>
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
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <FacetCard surface="solid" className="rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">Labor Force Trends</h3>
              <p className="text-muted-foreground text-sm">
                Historical employment and participation metrics
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="partGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {chartType === "area" ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="employmentRate"
                          stroke="var(--chart-3)"
                          fillOpacity={1}
                          fill="url(#empGrad)"
                          strokeWidth={2}
                          name="Employment Rate"
                        />
                        <Area
                          type="monotone"
                          dataKey="participationRate"
                          stroke="var(--chart-1)"
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
                          fill="var(--chart-3)"
                          name="Employment Rate"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="unemploymentRate"
                          fill="var(--destructive)"
                          name="Unemployment Rate"
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="employmentRate"
                          stroke="var(--chart-3)"
                          strokeWidth={2}
                          dot={false}
                          name="Employment Rate"
                        />
                        <Line
                          type="monotone"
                          dataKey="unemploymentRate"
                          stroke="var(--destructive)"
                          strokeWidth={2}
                          dot={false}
                          name="Unemployment Rate"
                        />
                        <Line
                          type="monotone"
                          dataKey="participationRate"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={false}
                          name="Participation Rate"
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
              <Eyebrow className="mb-1 block">Max Employment Rate</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {laborStats?.maxEmployment ? `${laborStats.maxEmployment.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Min Unemployment Rate</Eyebrow>
              <span className="text-destructive text-xl font-bold">
                {laborStats?.minUnemployment ? `${laborStats.minUnemployment.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Avg Participation</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {laborStats?.avgParticipation
                  ? `${laborStats.avgParticipation.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Data Points Analyzed</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {laborStats?.dataPoints || 0}
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
          <FacetCard surface="solid" className="flex-1 rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Globe className="text-muted-foreground h-5 w-5" />
                Benchmark Analysis
              </h3>
              <p className="text-muted-foreground text-sm">
                Comparison of national labor indicators against global benchmark rates.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="Your Country"
                      fill="var(--color-blue-500)"
                      radius={[4, 4, 0, 0]}
                    />
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
              <Eyebrow className="mb-1 block">Global Comparison</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {employmentRate >= globalAvgEmployment ? "Above Average" : "Below Average"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Employment: {employmentRate.toFixed(1)}% vs {globalAvgEmployment}% Avg
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Workforce Activity</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {(labor?.laborForceParticipationRate || 0) >= 60 ? "Strong" : "Low"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Active Participation Rate: {(labor?.laborForceParticipationRate || 0).toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Job Market Health</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {(labor?.unemploymentRate || 0) < 5
                  ? "Healthy"
                  : (labor?.unemploymentRate || 0) < 10
                    ? "Moderate"
                    : "Struggling"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
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
    const sectors: Record<string, number> = labor?.employmentBySector || {};

    const sectorData = Object.entries(sectors)
      .slice(0, 8)
      .map(([name, value]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: parseFloat(value.toFixed(1)),
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <MetricModalLayout variant="labor">
        <MetricModalLayout.MainArea>
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">Employment by Sector</h3>
              <p className="text-muted-foreground text-sm">
                Workforce distribution across key industrial sectors
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex-1 p-0">
              {sectorData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        width={100}
                        tick={{ fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          borderColor: "var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--color-blue-500)"
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
                Productivity Metrics
              </h3>
              <p className="text-muted-foreground text-xs">Workforce efficiency and output</p>
            </FacetCardHeader>
            <FacetCardContent className="space-y-4 p-0">
              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>GDP per Worker</Eyebrow>
                <div className="text-foreground mt-1 text-lg font-semibold">
                  $
                  {(
                    (countryData?.currentTotalGdp || 0) / (labor?.totalWorkforce || 1)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>Productivity Index</Eyebrow>
                <div className="mt-1 text-lg font-semibold text-emerald-500">
                  {labor?.skillsAndProductivity?.laborProductivityIndex?.toFixed(2) || "1.00"}
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <Eyebrow>Avg. Education</Eyebrow>
                <div className="text-foreground mt-1 text-lg font-semibold">
                  {labor?.skillsAndProductivity?.averageEducationYears?.toFixed(1) || "12.0"} Years
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
      title="Labor Force Analysis"
      description="Detailed workforce and employment metrics"
      icon={Users}
      iconColor="text-muted-foreground"
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
