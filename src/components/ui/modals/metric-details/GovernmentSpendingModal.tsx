"use client";

import React, { useMemo } from "react";
import {
  Building,
  Dollar as DollarSign,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  Reports as PieChart,
  Wallet,
  ScaleFrameEnlarge as Scale,
  Bank as Landmark,
  InfoCircle as Info,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { format, subMonths } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";

interface GovernmentSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "trends", label: "Trends", icon: LineChart },
  { id: "comparison", label: "Comparison", icon: Globe },
  { id: "breakdown", label: "Breakdown", icon: PieChart },
];

const SPENDING_COLORS = [
  "#3b82f6", // blue - education
  "#ef4444", // red - healthcare
  "#10b981", // green - defense
  "#fbbf24", // amber - social
  "#8b5cf6", // purple - infrastructure
  "#06b6d4", // cyan - other
];

export function GovernmentSpendingModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: GovernmentSpendingModalProps) {
  // Fetch country data + mapped economyData
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
    refetch,
  } = useCountryEconomicData(countryId, isOpen);

  // Fetch government structure
  const { data: governmentData, isLoading: govLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId && isOpen }
  );

  // Fetch historical data
  const { data: historicalData, isLoading: historicalLoading } =
    api.historical.getCountryHistory.useQuery({ countryId }, { enabled: !!countryId && isOpen });

  // Fetch global stats for comparison
  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: globalStats, isLoading: globalLoading } = api.countries.getGlobalStats.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const isLoading = countryLoading || govLoading || historicalLoading || globalLoading;

  // Process historical data for charts
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

    const spending = economyData?.spending;
    const fiscal = economyData?.fiscal;
    const currentSpendingPct =
      spending?.spendingGDPPercent || fiscal?.governmentBudgetGDPPercent || 30;
    const currentRevenuePct = fiscal?.taxRevenueGDPPercent || 25;

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
        const gdp = point.totalGdp || 0;
        const totalSpending = gdp * (currentSpendingPct / 100);
        const totalRevenue = gdp * (currentRevenuePct / 100);
        return {
          date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
          timestamp: point.ixTimeTimestamp,
          totalSpending: totalSpending / 1e9,
          spendingGdpPercent: currentSpendingPct,
          budgetBalance: (totalRevenue - totalSpending) / 1e9,
        };
      })
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const chartConfig = {
    totalSpending: { label: "Total Spending (B)", color: "#fbbf24" },
    spendingGdpPercent: { label: "% of GDP", color: "#3b82f6" },
    budgetBalance: { label: "Budget Balance (B)", color: "#10b981" },
  };

  // Derive stats for Sidebar
  const defaultProcessedData = useMemo(
    () => processHistoricalData("1y"),
    [historicalData, economyData]
  );
  const spendStats = useMemo(() => {
    if (!defaultProcessedData || defaultProcessedData.length === 0) return null;
    const spends = defaultProcessedData.map((p) => p.totalSpending);
    const balances = defaultProcessedData.map((p) => p.budgetBalance);

    return {
      maxSpending: Math.max(...spends),
      avgBalance: balances.reduce((acc, v) => acc + v, 0) / balances.length,
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
        <MetricModalLayout variant="economy">
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

    const fiscal = economyData?.fiscal;
    const spending = economyData?.spending;
    const totalBudget = governmentData?.totalBudget || spending?.totalSpending || 0;
    const gdp = countryData?.currentTotalGdp || 1;
    const spendingGdpPercent = spending?.spendingGDPPercent || (totalBudget / gdp) * 100;
    const budgetBalance = fiscal?.budgetDeficitSurplus || 0;

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-amber-500" />
                Budget Summary
              </CardTitle>
              <CardDescription>Government fiscal allocation and spending summary.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-blue-400">
                    ${((fiscal?.governmentRevenueTotal || 0) / 1e9).toFixed(1)}B
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Tax Revenue
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Revenue % GDP
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    $
                    {(
                      (((fiscal?.totalDebtGDPRatio || 0) / 100) *
                        (countryData?.currentTotalGdp || 0)) /
                      1e9
                    ).toFixed(1)}
                    B
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Public Debt
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-rose-450 text-lg font-bold">
                    {(fiscal?.totalDebtGDPRatio || 0).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Debt to GDP
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-lg border border-amber-500/10 bg-amber-500/5 p-4 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="leading-relaxed">
                  Budget dynamics balance societal infrastructure investments with revenue
                  collections. Stable surpluses build cash reserves, while persistent deficits
                  expand public debt limits and require careful interest rate servicing.
                </p>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Total Budget"
            value={totalBudget / 1e9}
            prefix="$"
            suffix="B"
            decimalPlaces={1}
            icon={Wallet}
            variant="economy"
          />
          <MetricModalLayout.StatCard
            label="Budget % GDP"
            value={spendingGdpPercent}
            suffix="%"
            decimalPlaces={1}
            icon={PieChart}
            variant="economy"
          />
          <MetricModalLayout.StatCard
            label="Budget Balance"
            value={budgetBalance / 1e9}
            prefix="$"
            suffix="B"
            decimalPlaces={1}
            icon={Scale}
            variant="economy"
          />
          <MetricModalLayout.StatCard
            label="Per Capita Spending"
            value={totalBudget / (countryData?.currentPopulation || 1)}
            prefix="$"
            decimalPlaces={0}
            icon={DollarSign}
            variant="economy"
          />
        </MetricModalLayout.Sidebar>
      </MetricModalLayout>
    );
  };

  const renderTrendsTab = (timeRange: TimeRange, chartType: ChartType) => {
    const processedData = processHistoricalData(timeRange);

    if (historicalLoading) {
      return (
        <MetricModalLayout variant="economy">
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
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Government Spending Trends</CardTitle>
              <CardDescription>Historical budget and spending metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
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
                        dataKey="totalSpending"
                        stroke="#fbbf24"
                        fillOpacity={1}
                        fill="url(#spendGrad)"
                        strokeWidth={2}
                        name="Total Spending (B)"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="totalSpending"
                        fill="#fbbf24"
                        name="Total Spending (B)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="totalSpending"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          dot={false}
                          name="Total Spending (B)"
                        />
                        <Line
                          type="monotone"
                          dataKey="spendingGdpPercent"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="% of GDP"
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
                Peak Spending (B)
              </span>
              <span className="text-xl font-bold text-amber-500">
                {spendStats?.maxSpending ? `$${spendStats.maxSpending.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Avg Budget Balance
              </span>
              <span className="text-xl font-bold text-green-400">
                {spendStats?.avgBalance ? `$${spendStats.avgBalance.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Data Points
              </span>
              <span className="text-xl font-bold text-purple-400">
                {spendStats?.dataPoints || 0}
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
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const fiscal = economyData?.fiscal;
    const spending = economyData?.spending;
    const spendingGdpPercent =
      spending?.spendingGDPPercent ||
      ((governmentData?.totalBudget || spending?.totalSpending || 0) /
        (countryData?.currentTotalGdp || 1)) *
        100;
    const globalAvgSpending = 35.0;
    const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
    const budgetBalance = fiscal?.budgetDeficitSurplus || 0;

    const compData = [
      {
        name: "Spending % GDP",
        "Your Country": spendingGdpPercent,
        "Global Avg": globalAvgSpending,
      },
      {
        name: "Tax Revenue % GDP",
        "Your Country": fiscal?.taxRevenueGDPPercent || 0,
        "Global Avg": 30.0,
      },
    ];

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex-1 border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-amber-500" />
                Fiscal Health Benchmarks
              </CardTitle>
              <CardDescription>Compare spending ratios against global baselines.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
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
                    <Bar dataKey="Your Country" fill="#fbbf24" radius={[4, 4, 0, 0]} />
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
                Global Allocation
              </span>
              <span className="text-xl font-bold text-amber-500">
                {spendingGdpPercent <= globalAvgSpending ? "Efficient" : "Above Avg"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Spending: {spendingGdpPercent.toFixed(1)}% vs {globalAvgSpending}% global avg
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Fiscal Stability
              </span>
              <span className="text-xl font-bold text-green-400">
                {debtToGdp < 60 ? "Healthy" : debtToGdp < 100 ? "Moderate" : "High"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Public Debt: {debtToGdp.toFixed(1)}% of GDP
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Budget Status
              </span>
              <span className="text-xl font-bold text-purple-400">
                {budgetBalance >= 0 ? "Surplus" : "Deficit"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Annual Balance: {(budgetBalance / 1e9).toFixed(1)}B
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
        <MetricModalLayout variant="economy">
          <MetricModalLayout.MainArea>
            <Skeleton className="h-[350px] w-full" />
          </MetricModalLayout.MainArea>
          <MetricModalLayout.Sidebar>
            <Skeleton className="h-full w-full" />
          </MetricModalLayout.Sidebar>
        </MetricModalLayout>
      );
    }

    const spending = economyData?.spending;
    const spendingCategories = spending?.spendingCategories;
    const categories =
      spendingCategories && spendingCategories.length > 0
        ? spendingCategories.slice(0, 6).map((cat: any, i: number) => ({
            name: cat.category,
            value: cat.percent || cat.gdpPercent || 0,
            color: SPENDING_COLORS[i % SPENDING_COLORS.length],
          }))
        : [
            {
              name: "Education",
              value: spending?.education
                ? (spending.education / (spending?.totalSpending || 1)) * 100
                : 15,
              color: SPENDING_COLORS[0],
            },
            {
              name: "Healthcare",
              value: spending?.healthcare
                ? (spending.healthcare / (spending?.totalSpending || 1)) * 100
                : 12,
              color: SPENDING_COLORS[1],
            },
            {
              name: "Social Safety",
              value: spending?.socialSafety
                ? (spending.socialSafety / (spending?.totalSpending || 1)) * 100
                : 20,
              color: SPENDING_COLORS[3],
            },
          ];

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Budget allocation across government sectors</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-6 p-0 md:flex-row">
              {/* Pie Chart */}
              <div className="flex h-44 w-44 shrink-0 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categories.map((entry: any, index: number) => (
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
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
              <div className="max-h-[220px] w-full flex-1 space-y-2 overflow-y-auto pr-1">
                {categories.map((category: any) => (
                  <div
                    key={category.name}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-muted-foreground font-medium">{category.name}</span>
                    </div>
                    <span className="font-semibold text-white">{category.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-4">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="text-sm font-semibold">Priority Spending</CardTitle>
              <CardDescription className="text-[10px]">
                Key budget policies and priorities
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {((governmentData as any)?.priorityPolicies?.length ?? 0) > 0 ? (
                  (((governmentData as any).priorityPolicies ?? []) as string[])
                    .slice(0, 6)
                    .map((policy: string, index: number) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/5 bg-white/5 p-2 text-center text-xs font-semibold text-amber-400"
                      >
                        {policy}
                      </div>
                    ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-xs">No priority policies defined</p>
                  </div>
                )}
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
      title="Government Spending Analysis"
      description="Budget allocation and fiscal metrics"
      icon={Building}
      iconColor="text-amber-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      variant="economy"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default GovernmentSpendingModal;
