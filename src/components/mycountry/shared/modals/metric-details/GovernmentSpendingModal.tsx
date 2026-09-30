"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
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
import { cn } from "~/lib/utils/cn";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";

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
  "var(--color-blue-500)", // blue - education
  "var(--destructive)", // red - healthcare
  "var(--chart-3)", // green - defense
  "var(--color-amber-500)", // amber - social
  "var(--chart-5)", // indigo - infrastructure
  "var(--chart-2)", // cyan - other
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

    return filterAndSortHistory(historicalData, timeRange, (point, formattedDate, timestamp) => {
      const gdp = point.totalGdp || 0;
      const totalSpending = gdp * (currentSpendingPct / 100);
      const totalRevenue = gdp * (currentRevenuePct / 100);
      return {
        date: formattedDate,
        timestamp,
        totalSpending: totalSpending / 1e9,
        spendingGdpPercent: currentSpendingPct,
        budgetBalance: (totalRevenue - totalSpending) / 1e9,
      };
    });
  };

  const chartConfig = {
    totalSpending: { label: "Total Spending (B)", color: "var(--color-amber-500)" },
    spendingGdpPercent: { label: "% of GDP", color: "var(--color-blue-500)" },
    budgetBalance: { label: "Budget Balance (B)", color: "var(--chart-3)" },
  };

  // Derive stats for Sidebar
  const defaultProcessedData = useMemo(
    // oxlint-disable-next-line
    () => processHistoricalData("1y"),
    // oxlint-disable-next-line
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
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Landmark className="text-muted-foreground h-5 w-5" />
                Budget Summary
              </h3>
              <p className="text-muted-foreground text-sm">
                Government fiscal allocation and spending summary.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    ${((fiscal?.governmentRevenueTotal || 0) / 1e9).toFixed(1)}B
                  </div>
                  <Eyebrow className="mt-1 block">Tax Revenue</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-lg font-semibold text-emerald-500">
                    {(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%
                  </div>
                  <Eyebrow className="mt-1 block">Revenue % GDP</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-foreground text-lg font-semibold">
                    $
                    {(
                      (((fiscal?.totalDebtGDPRatio || 0) / 100) *
                        (countryData?.currentTotalGdp || 0)) /
                      1e9
                    ).toFixed(1)}
                    B
                  </div>
                  <Eyebrow className="mt-1 block">Public Debt</Eyebrow>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="text-destructive text-lg font-bold">
                    {(fiscal?.totalDebtGDPRatio || 0).toFixed(1)}%
                  </div>
                  <Eyebrow className="mt-1 block">Debt to GDP</Eyebrow>
                </div>
              </div>

              <div className="text-muted-foreground bg-muted/50 mt-6 flex items-start gap-3 rounded-xl p-4 text-xs">
                <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Budget dynamics balance societal infrastructure investments with revenue
                  collections. Stable surpluses build cash reserves, while persistent deficits
                  expand public debt limits and require careful interest rate servicing.
                </p>
              </div>
            </FacetCardContent>
          </FacetCard>
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
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard surface="solid" className="rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">
                Government Spending Trends
              </h3>
              <p className="text-muted-foreground text-sm">
                Historical budget and spending metrics
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amber-500)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-amber-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {chartType === "area" ? (
                      <Area
                        type="monotone"
                        dataKey="totalSpending"
                        stroke="var(--color-amber-500)"
                        fillOpacity={1}
                        fill="url(#spendGrad)"
                        strokeWidth={2}
                        name="Total Spending (B)"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="totalSpending"
                        fill="var(--color-amber-500)"
                        name="Total Spending (B)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="totalSpending"
                          stroke="var(--color-amber-500)"
                          strokeWidth={2}
                          dot={false}
                          name="Total Spending (B)"
                        />
                        <Line
                          type="monotone"
                          dataKey="spendingGdpPercent"
                          stroke="var(--color-blue-500)"
                          strokeWidth={2}
                          dot={false}
                          name="% of GDP"
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
              <Eyebrow className="mb-1 block">Peak Spending (B)</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {spendStats?.maxSpending ? `$${spendStats.maxSpending.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Avg Budget Balance</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {spendStats?.avgBalance ? `$${spendStats.avgBalance.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Data Points</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
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
          <FacetCard surface="solid" className="flex-1 rounded-xl p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Globe className="text-muted-foreground h-5 w-5" />
                Fiscal Health Benchmarks
              </h3>
              <p className="text-muted-foreground text-sm">
                Compare spending ratios against global baselines.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
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
                      fill="var(--color-amber-500)"
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
              <Eyebrow className="mb-1 block">Global Allocation</Eyebrow>
              <span className="text-foreground text-xl font-semibold">
                {spendingGdpPercent <= globalAvgSpending ? "Efficient" : "Above Avg"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Spending: {spendingGdpPercent.toFixed(1)}% vs {globalAvgSpending}% global avg
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Fiscal Stability</Eyebrow>
              <span className="text-xl font-semibold text-emerald-500">
                {debtToGdp < 60 ? "Healthy" : debtToGdp < 100 ? "Moderate" : "High"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Public Debt: {debtToGdp.toFixed(1)}% of GDP
              </span>
            </div>
            <div className="bg-muted/50 flex flex-1 flex-col justify-center rounded-xl p-4">
              <Eyebrow className="mb-1 block">Budget Status</Eyebrow>
              <span
                className={cn(
                  "text-xl font-bold",
                  budgetBalance >= 0 ? "text-emerald-500" : "text-destructive"
                )}
              >
                {budgetBalance >= 0 ? "Surplus" : "Deficit"}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
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
    const categories: Array<{ name: string; value: number; color: string }> =
      spendingCategories && spendingCategories.length > 0
        ? (spendingCategories as Array<{ category: string; percent?: number; gdpPercent?: number }>)
            .slice(0, 6)
            .map((cat, i) => ({
              name: cat.category,
              value: cat.percent || cat.gdpPercent || 0,
              color: SPENDING_COLORS[i % SPENDING_COLORS.length] ?? "var(--color-blue-500)",
            }))
        : [
            {
              name: "Education",
              value: spending?.education
                ? (spending.education / (spending?.totalSpending || 1)) * 100
                : 15,
              color: SPENDING_COLORS[0] ?? "var(--color-blue-500)",
            },
            {
              name: "Healthcare",
              value: spending?.healthcare
                ? (spending.healthcare / (spending?.totalSpending || 1)) * 100
                : 12,
              color: SPENDING_COLORS[1] ?? "var(--chart-3)",
            },
            {
              name: "Social Safety",
              value: spending?.socialSafety
                ? (spending.socialSafety / (spending?.totalSpending || 1)) * 100
                : 20,
              color: SPENDING_COLORS[3] ?? "var(--color-amber-500)",
            },
          ];

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-6"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base font-semibold">Spending by Category</h3>
              <p className="text-muted-foreground text-sm">
                Budget allocation across government sectors
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col items-center gap-6 p-0 md:flex-row">
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
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
              <div className="max-h-[220px] w-full flex-1 space-y-2 overflow-y-auto pr-1">
                {categories.map((category) => (
                  <div
                    key={category.name}
                    className="bg-muted/50 flex items-center justify-between rounded-xl p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-muted-foreground font-medium">{category.name}</span>
                    </div>
                    <span className="text-foreground font-semibold tabular-nums">
                      {category.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <FacetCard
            surface="solid"
            className="flex flex-1 flex-col justify-between rounded-xl p-4"
          >
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-foreground text-base text-sm font-semibold">Priority Spending</h3>
              <p className="text-muted-foreground text-xs">Key budget policies and priorities</p>
            </FacetCardHeader>
            <FacetCardContent className="flex-1 p-0">
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {/* The government API has no priority-policy field, so this card only has an empty state. */}
                <div className="py-8 text-center">
                  <p className="text-muted-foreground text-xs">No priority policies defined</p>
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
