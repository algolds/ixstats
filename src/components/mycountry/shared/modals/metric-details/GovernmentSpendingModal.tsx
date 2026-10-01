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
  "var(--color-destructive)", // red - healthcare
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
          <FacetCard className="flex flex-1 flex-col justify-between p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Landmark className="text-label-secondary h-5 w-5" />
                Budget Summary
              </h3>
              <p className="text-label-secondary text-body">
                Government fiscal allocation and spending summary.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <FacetCard variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    ${((fiscal?.governmentRevenueTotal || 0) / 1e9).toFixed(1)}B
                  </div>
                  <Eyebrow className="mt-1 block">Tax Revenue</Eyebrow>
                </FacetCard>
                <FacetCard variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%
                  </div>
                  <Eyebrow className="mt-1 block">Revenue % GDP</Eyebrow>
                </FacetCard>
                <FacetCard variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    $
                    {(
                      (((fiscal?.totalDebtGDPRatio || 0) / 100) *
                        (countryData?.currentTotalGdp || 0)) /
                      1e9
                    ).toFixed(1)}
                    B
                  </div>
                  <Eyebrow className="mt-1 block">Public Debt</Eyebrow>
                </FacetCard>
                <FacetCard variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-destructive text-title-3">
                    {(fiscal?.totalDebtGDPRatio || 0).toFixed(1)}%
                  </div>
                  <Eyebrow className="mt-1 block">Debt to GDP</Eyebrow>
                </FacetCard>
              </div>

              <FacetCard
                variant="inset"
                padding="none"
                className="text-label-secondary text-footnote mt-6 flex items-start gap-3 p-4"
              >
                <Info className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  Budget dynamics balance societal infrastructure investments with revenue
                  collections. Stable surpluses build cash reserves, while persistent deficits
                  expand public debt limits and require careful interest rate servicing.
                </p>
              </FacetCard>
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
        <FacetCard>
          <FacetCardContent className="py-12 text-center">
            <LineChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No historical data available</p>
          </FacetCardContent>
        </FacetCard>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard className="p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Government Spending Trends</h3>
              <p className="text-label-secondary text-body">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="date" stroke="var(--color-label-secondary)" tickLine={false} />
                    <YAxis stroke="var(--color-label-secondary)" tickLine={false} />
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Peak Spending (B)</Eyebrow>
              <span className="text-label text-title-2">
                {spendStats?.maxSpending ? `$${spendStats.maxSpending.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Avg Budget Balance</Eyebrow>
              <span className="text-title-2 text-green">
                {spendStats?.avgBalance ? `$${spendStats.avgBalance.toFixed(1)}B` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Data Points</Eyebrow>
              <span className="text-label text-title-2">{spendStats?.dataPoints || 0}</span>
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
          <FacetCard className="flex-1 p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Globe className="text-label-secondary h-5 w-5" />
                Fiscal Health Benchmarks
              </h3>
              <p className="text-label-secondary text-body">
                Compare spending ratios against global baselines.
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
                    <XAxis dataKey="name" stroke="var(--color-label-secondary)" tickLine={false} />
                    <YAxis stroke="var(--color-label-secondary)" tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-elevated)",
                        color: "var(--color-label)",
                        borderColor: "var(--color-separator)",
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
                      fill="var(--color-label-secondary)"
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Global Allocation</Eyebrow>
              <span className="text-label text-title-2">
                {spendingGdpPercent <= globalAvgSpending ? "Efficient" : "Above Avg"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
                Spending: {spendingGdpPercent.toFixed(1)}% vs {globalAvgSpending}% global avg
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Fiscal Stability</Eyebrow>
              <span className="text-title-2 text-green">
                {debtToGdp < 60 ? "Healthy" : debtToGdp < 100 ? "Moderate" : "High"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
                Public Debt: {debtToGdp.toFixed(1)}% of GDP
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <Eyebrow className="mb-1 block">Budget Status</Eyebrow>
              <span
                className={cn(
                  "text-title-2",
                  budgetBalance >= 0 ? "text-green" : "text-destructive"
                )}
              >
                {budgetBalance >= 0 ? "Surplus" : "Deficit"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
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
        : [];

    // No recorded split (or a visitor: the allocation split is served to the owner only).
    if (categories.length === 0) {
      return (
        <FacetCard>
          <FacetCardContent className="py-12 text-center">
            <PieChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No spending breakdown available</p>
          </FacetCardContent>
        </FacetCard>
      );
    }

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <FacetCard className="flex flex-1 flex-col justify-between p-6">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Spending by Category</h3>
              <p className="text-label-secondary text-body">
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
                        background: "var(--color-surface-elevated)",
                        color: "var(--color-label)",
                        borderColor: "var(--color-separator)",
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
                    className="bg-fill-3 rounded-row text-footnote flex items-center justify-between p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-label-secondary font-medium">{category.name}</span>
                    </div>
                    <span className="text-label font-semibold tabular-nums">
                      {category.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </FacetCardContent>
          </FacetCard>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <FacetCard className="flex flex-1 flex-col justify-between p-4">
            <FacetCardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 text-headline">Priority Spending</h3>
              <p className="text-label-secondary text-footnote">
                Key budget policies and priorities
              </p>
            </FacetCardHeader>
            <FacetCardContent className="flex-1 p-0">
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {/* The government API has no priority-policy field, so this card only has an empty state. */}
                <div className="py-8 text-center">
                  <p className="text-label-secondary text-footnote">No priority policies defined</p>
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
      iconColor="text-yellow"
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
