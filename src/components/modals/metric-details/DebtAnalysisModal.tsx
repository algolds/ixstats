"use client";

import React from "react";
import {
  Landmark,
  DollarSign,
  BarChart3,
  LineChart,
  Globe,
  Info,
  AlertTriangle,
  Scale,
  CreditCard,
  Percent,
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

interface DebtAnalysisModalProps {
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
 * DebtAnalysisModal - Public debt and fiscal sustainability analysis
 *
 * Displays:
 * - Overview: Total debt, debt-to-GDP ratio, debt per capita
 * - Trends: Historical debt metrics with time range control
 * - Comparison: Global/regional benchmarking
 * - Details: Debt composition, interest payments, sustainability metrics
 */
export function DebtAnalysisModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: DebtAnalysisModalProps) {
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
  // Derive debt from GDP using current debt-to-GDP ratio
  const processHistoricalData = (timeRange: TimeRange) => {
    if (!historicalData || historicalData.length === 0) return [];

    const fiscal = economyData?.fiscal;
    const currentDebtRatio = fiscal?.totalDebtGDPRatio || 50;
    const currentInterestRate = fiscal?.interestRates || 3.5;

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
      .map((point: any) => {
        const gdp = point.totalGdp || 0;
        const publicDebt = gdp * (currentDebtRatio / 100);
        const interestPayments = publicDebt * (currentInterestRate / 100);
        return {
          date: format(new Date(point.ixTimeTimestamp), "MMM yyyy"),
          timestamp: point.ixTimeTimestamp,
          publicDebt: publicDebt / 1e12,
          debtToGdp: currentDebtRatio,
          interestPayments: interestPayments / 1e9,
        };
      })
      .sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  };

  const chartConfig = {
    publicDebt: { label: "Public Debt (T)", color: "#dc2626" },
    debtToGdp: { label: "Debt-to-GDP %", color: "#f59e0b" },
    interestPayments: { label: "Interest (B)", color: "#7c3aed" },
  };

  const getDebtRiskLevel = (debtToGdp: number): { label: string; color: string; variant: "default" | "secondary" | "destructive" } => {
    if (debtToGdp < 40) return { label: "Low Risk", color: "text-green-600", variant: "default" };
    if (debtToGdp < 60) return { label: "Moderate", color: "text-yellow-600", variant: "secondary" };
    if (debtToGdp < 100) return { label: "Elevated", color: "text-orange-600", variant: "secondary" };
    return { label: "High Risk", color: "text-red-600", variant: "destructive" };
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

    const fiscal = economyData?.fiscal;
    const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
    const gdp = countryData?.currentTotalGdp || 0;
    const publicDebt = gdp * (debtToGdp / 100);
    const population = countryData?.currentPopulation || 1;
    const riskLevel = getDebtRiskLevel(debtToGdp);

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Public Debt
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    $<NumberFlowDisplay
                      value={publicDebt / 1e12}
                      decimalPlaces={2}
                    />T
                  </p>
                </div>
                <Landmark className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Debt-to-GDP
                  </p>
                  <p className={`text-2xl font-bold ${riskLevel.color}`}>
                    <NumberFlowDisplay
                      value={debtToGdp}
                      decimalPlaces={1}
                    />%
                  </p>
                </div>
                <Percent className="h-8 w-8 text-amber-500" />
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
                  <p className="text-2xl font-bold text-purple-600">
                    $<NumberFlowDisplay
                      value={publicDebt / population}
                      decimalPlaces={0}
                    />
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Risk Level
                  </p>
                  <Badge variant={riskLevel.variant} className="mt-1 text-lg">
                    {riskLevel.label}
                  </Badge>
                </div>
                <AlertTriangle className={`h-8 w-8 ${riskLevel.color}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debt Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-red-500" />
              Fiscal Position
            </CardTitle>
            <CardDescription>
              Debt sustainability and interest burden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                </div>
                <div className="text-muted-foreground text-sm">Annual Interest</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {((fiscal?.debtServiceCosts || 0) / (countryData?.currentTotalGdp || 1) * 100).toFixed(2)}%
                </div>
                <div className="text-muted-foreground text-sm">Interest/GDP</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {((fiscal?.debtServiceCosts || 0) / (fiscal?.governmentRevenueTotal || 1) * 100).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">Interest/Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-amber-600">
                  {riskLevel.label}
                </div>
                <div className="text-muted-foreground text-sm">Credit Assessment</div>
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
          <CardTitle>Debt Trends</CardTitle>
          <CardDescription>
            Historical public debt and debt-to-GDP ratio
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
                    dataKey="debtToGdp"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                    name="Debt-to-GDP %"
                  />
                ) : chartType === "bar" ? (
                  <Bar dataKey="publicDebt" fill="#dc2626" name="Public Debt (T)" />
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="publicDebt"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                      name="Public Debt (T)"
                    />
                    <Line
                      type="monotone"
                      dataKey="debtToGdp"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Debt-to-GDP %"
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

    const fiscal = economyData?.fiscal;
    const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
    const globalAvgDebt = 80; // Placeholder
    const riskLevel = getDebtRiskLevel(debtToGdp);

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
                <span className="text-sm">Debt-to-GDP</span>
                <Badge variant={debtToGdp < globalAvgDebt ? "default" : "destructive"}>
                  {debtToGdp < globalAvgDebt ? "Below Avg" : "Above Avg"}
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${riskLevel.color}`}>
                  {debtToGdp.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  vs {globalAvgDebt}% global average
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-green-500" />
              Creditworthiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Assessment</span>
                <Badge variant="outline">
                  {riskLevel.label}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {debtToGdp < 40 ? "AAA" : debtToGdp < 60 ? "AA" : debtToGdp < 80 ? "A" : debtToGdp < 100 ? "BBB" : "BB"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Estimated credit rating
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-amber-500" />
              Sustainability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Risk Assessment</span>
                <Badge variant={riskLevel.variant}>
                  {riskLevel.label}
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${riskLevel.color}`}>
                  {debtToGdp < 60 ? "Sustainable" : debtToGdp < 100 ? "Manageable" : "Critical"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Debt sustainability status
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

    const fiscal = economyData?.fiscal;
    const internalPct = fiscal?.internalDebtGDPPercent || 0;
    const externalPct = fiscal?.externalDebtGDPPercent || 0;
    const totalPct = internalPct + externalPct;
    const domesticShare = totalPct > 0 ? (internalPct / totalPct * 100) : 60;
    const externalShare = totalPct > 0 ? (externalPct / totalPct * 100) : 40;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Debt Composition</CardTitle>
            <CardDescription>Breakdown of public debt by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-blue-600">
                  {domesticShare.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Domestic Debt</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-purple-600">
                  {externalShare.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">External Debt</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-green-600">
                  25%
                </div>
                <div className="text-xs text-muted-foreground">Short-Term</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-lg font-semibold text-amber-600">
                  75%
                </div>
                <div className="text-xs text-muted-foreground">Long-Term</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debt Service</CardTitle>
            <CardDescription>Interest payments and debt servicing costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                </div>
                <div className="text-sm text-muted-foreground">
                  Annual Interest
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {(fiscal?.interestRates || 3.5).toFixed(2)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Average Interest Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  8.5 yrs
                </div>
                <div className="text-sm text-muted-foreground">
                  Average Maturity
                </div>
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
      title="Public Debt Analysis"
      description="Debt sustainability and fiscal health metrics"
      icon={Landmark}
      iconColor="text-red-500"
      tabs={TABS}
      isLoading={isLoading}
      onRefresh={() => refetch()}
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default DebtAnalysisModal;
