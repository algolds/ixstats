"use client";

import React from "react";
import {
  Building,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Globe,
  Info,
  PieChart,
  Wallet,
  Scale,
  Landmark,
} from "lucide-react";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths } from "date-fns";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
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
  "#22c55e", // green - defense
  "#f59e0b", // amber - social
  "#8b5cf6", // purple - infrastructure
  "#06b6d4", // cyan - other
];

/**
 * GovernmentSpendingModal - Government budget and spending analysis
 *
 * Displays:
 * - Overview: Total spending, budget balance, spending as % of GDP
 * - Trends: Historical spending with time range control
 * - Comparison: Global/regional benchmarking
 * - Breakdown: Spending by category (education, healthcare, defense, etc.)
 */
export function GovernmentSpendingModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: GovernmentSpendingModalProps) {
  // Fetch country economic data
  const {
    data: countryData,
    isLoading: countryLoading,
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId && isOpen }
  );

  // Fetch government structure
  const { data: governmentData, isLoading: govLoading } =
    api.government.getByCountryId.useQuery(
      { countryId },
      { enabled: !!countryId && isOpen }
    );

  // Fetch historical data
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery(
      { countryId },
      { enabled: !!countryId && isOpen }
    );

  // Fetch global stats for comparison
  const { data: globalStats, isLoading: globalLoading } =
    api.countries.getGlobalStats.useQuery(undefined, { enabled: isOpen });

  const isLoading = countryLoading || govLoading || historicalLoading || globalLoading;

  // Process historical data for charts
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

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
        totalSpending: (point.fiscal?.governmentSpending || 0) / 1e9,
        spendingGdpPercent: point.fiscal?.spendingGdpPercent || 0,
        budgetBalance: (point.fiscal?.budgetBalance || 0) / 1e9,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  };

  const chartConfig = {
    totalSpending: { label: "Total Spending (B)", color: "#7c3aed" },
    spendingGdpPercent: { label: "% of GDP", color: "#2563eb" },
    budgetBalance: { label: "Budget Balance (B)", color: "#16a34a" },
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

    const fiscal = countryData?.economyData?.fiscal;
    const spending = countryData?.economyData?.spending;
    const totalBudget = governmentData?.totalBudget || fiscal?.governmentSpending || 0;
    const gdp = countryData?.currentTotalGdp || 1;
    const spendingGdpPercent = (totalBudget / gdp) * 100;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Total Budget
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    $<NumberFlowDisplay
                      value={totalBudget / 1e9}
                      decimalPlaces={1}
                    />B
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    % of GDP
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    <NumberFlowDisplay
                      value={spendingGdpPercent}
                      decimalPlaces={1}
                    />%
                  </p>
                </div>
                <PieChart className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Budget Balance
                  </p>
                  <p className={`text-2xl font-bold ${(fiscal?.budgetBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(fiscal?.budgetBalance || 0) >= 0 ? '+' : ''}
                    $<NumberFlowDisplay
                      value={Math.abs(fiscal?.budgetBalance || 0) / 1e9}
                      decimalPlaces={1}
                    />B
                  </p>
                </div>
                <Scale className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Per Capita
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    $<NumberFlowDisplay
                      value={totalBudget / (countryData?.currentPopulation || 1)}
                      decimalPlaces={0}
                    />
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-purple-500" />
              Budget Summary
            </CardTitle>
            <CardDescription>
              Government fiscal position and spending overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  ${((fiscal?.taxRevenue || 0) / 1e9).toFixed(1)}B
                </div>
                <div className="text-muted-foreground text-sm">Tax Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {(fiscal?.taxRevenueGDPPercent || 0).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">Revenue % GDP</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  ${((fiscal?.publicDebt || 0) / 1e9).toFixed(1)}B
                </div>
                <div className="text-muted-foreground text-sm">Public Debt</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {(fiscal?.debtToGdpRatio || 0).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">Debt to GDP</div>
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
          <CardTitle>Government Spending Trends</CardTitle>
          <CardDescription>
            Historical budget and spending metrics
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
                    dataKey="totalSpending"
                    stroke="#7c3aed"
                    fill="#7c3aed"
                    fillOpacity={0.3}
                    name="Total Spending (B)"
                  />
                ) : chartType === "bar" ? (
                  <Bar dataKey="totalSpending" fill="#7c3aed" name="Total Spending (B)" />
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="totalSpending"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      name="Total Spending (B)"
                    />
                    <Line
                      type="monotone"
                      dataKey="spendingGdpPercent"
                      stroke="#2563eb"
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

    const fiscal = countryData?.economyData?.fiscal;
    const spendingGdpPercent = ((governmentData?.totalBudget || fiscal?.governmentSpending || 0) / (countryData?.currentTotalGdp || 1)) * 100;
    const globalAvgSpending = 35; // Placeholder

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
                <span className="text-sm">Spending % GDP</span>
                <Badge
                  variant={spendingGdpPercent <= globalAvgSpending ? "default" : "secondary"}
                >
                  {spendingGdpPercent <= globalAvgSpending ? "Efficient" : "Above Avg"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {spendingGdpPercent.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  vs {globalAvgSpending}% global average
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-green-500" />
              Fiscal Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Debt-to-GDP</span>
                <Badge
                  variant={
                    (fiscal?.debtToGdpRatio || 0) < 60
                      ? "default"
                      : (fiscal?.debtToGdpRatio || 0) < 100
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {(fiscal?.debtToGdpRatio || 0) < 60
                    ? "Healthy"
                    : (fiscal?.debtToGdpRatio || 0) < 100
                    ? "Moderate"
                    : "High"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {(fiscal?.debtToGdpRatio || 0).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Public debt ratio
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-amber-500" />
              Budget Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Balance</span>
                <Badge
                  variant={(fiscal?.budgetBalance || 0) >= 0 ? "default" : "destructive"}
                >
                  {(fiscal?.budgetBalance || 0) >= 0 ? "Surplus" : "Deficit"}
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${(fiscal?.budgetBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(fiscal?.budgetBalance || 0) >= 0 ? '+' : ''}{((fiscal?.budgetBalance || 0) / 1e9).toFixed(1)}B
                </div>
                <div className="text-sm text-muted-foreground">
                  Annual balance
                </div>
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

    const spending = countryData?.economyData?.spending;
    const categories = [
      { name: "Education", value: spending?.education || 15, color: SPENDING_COLORS[0] },
      { name: "Healthcare", value: spending?.healthcare || 12, color: SPENDING_COLORS[1] },
      { name: "Defense", value: spending?.defense || 10, color: SPENDING_COLORS[2] },
      { name: "Social Safety", value: spending?.socialSafety || 20, color: SPENDING_COLORS[3] },
      { name: "Infrastructure", value: spending?.infrastructure || 8, color: SPENDING_COLORS[4] },
      { name: "Other", value: spending?.other || 35, color: SPENDING_COLORS[5] },
    ];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Budget allocation across government sectors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Pie Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <span className="font-semibold">{category.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Spending</CardTitle>
            <CardDescription>Key budget priorities and allocations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {governmentData?.priorityPolicies?.slice(0, 6).map((policy: string, index: number) => (
                <div key={index} className="text-center p-3 rounded-lg bg-muted/30">
                  <Badge variant="outline" className="mb-2">{policy}</Badge>
                </div>
              )) || (
                <div className="col-span-3 text-center py-4">
                  <p className="text-muted-foreground">No priority policies defined</p>
                </div>
              )}
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
      title="Government Spending Analysis"
      description="Budget allocation and fiscal metrics"
      icon={Building}
      iconColor="text-purple-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default GovernmentSpendingModal;
