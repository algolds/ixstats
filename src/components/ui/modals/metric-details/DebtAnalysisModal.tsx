"use client";

import React, { useMemo } from "react";
import {
  Bank as Landmark,
  Dollar as DollarSign,
  StatsReport as BarChart3,
  GraphUp as LineChart,
  Globe,
  InfoCircle as Info,
  WarningTriangle as AlertTriangle,
  ScaleFrameEnlarge as Scale,
  CreditCard,
  Percentage as Percent,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { api } from "~/trpc/react";
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
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
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

    const fiscal = economyData?.fiscal;
    const currentDebtRatio = fiscal?.totalDebtGDPRatio || 50;
    const currentInterestRate = fiscal?.interestRates || 3.5;

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
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const chartConfig = {
    publicDebt: { label: "Public Debt (T)", color: "#fbbf24" },
    debtToGdp: { label: "Debt-to-GDP %", color: "#f59e0b" },
    interestPayments: { label: "Interest (B)", color: "#ef4444" },
  };

  const getDebtRiskLevel = (
    debtToGdp: number
  ): {
    label: string;
    color: string;
    bg: string;
    border: string;
    variant: "default" | "secondary" | "destructive";
  } => {
    if (debtToGdp < 40)
      return {
        label: "Low Risk",
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
        variant: "default",
      };
    if (debtToGdp < 60)
      return {
        label: "Moderate",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        variant: "secondary",
      };
    if (debtToGdp < 100)
      return {
        label: "Elevated",
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        variant: "secondary",
      };
    return {
      label: "High Risk",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      variant: "destructive",
    };
  };

  const defaultProcessedData = useMemo(
    () => processHistoricalData("1y"),
    [historicalData, economyData]
  );
  const debtStats = useMemo(() => {
    if (!defaultProcessedData || defaultProcessedData.length === 0) return null;
    const ratios = defaultProcessedData.map((p) => p.debtToGdp);
    const debts = defaultProcessedData.map((p) => p.publicDebt);

    return {
      maxRatio: Math.max(...ratios),
      minDebt: Math.min(...debts),
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
    const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
    const gdp = countryData?.currentTotalGdp || 0;
    const publicDebt = gdp * (debtToGdp / 100);
    const population = countryData?.currentPopulation || 1;
    const riskLevel = getDebtRiskLevel(debtToGdp);

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-500" />
                Fiscal Position
              </CardTitle>
              <CardDescription>Debt sustainability and interest burden indicators.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-amber-400">
                    ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Annual Interest
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-cyan-400">
                    {(
                      ((fiscal?.debtServiceCosts || 0) / (countryData?.currentTotalGdp || 1)) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Interest/GDP
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {(
                      ((fiscal?.debtServiceCosts || 0) / (fiscal?.governmentRevenueTotal || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Interest/Rev
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-bold text-purple-400">{riskLevel.label}</div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">
                    Assessment
                  </div>
                </div>
              </div>

              <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-lg border border-amber-500/10 bg-amber-500/5 p-4 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="leading-relaxed">
                  National public debt indicates cumulative fiscal deficits. Highly elevated
                  Debt-to-GDP ratios place pressure on currency stability and crowd out private
                  investment through interest service fees, while low debt reserves can limit
                  stimulus capability during crises.
                </p>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Public Debt"
            value={publicDebt / 1e12}
            prefix="$"
            suffix=" T"
            decimalPlaces={2}
            icon={Landmark}
            variant="economy"
          />
          <MetricModalLayout.StatCard
            label="Debt-to-GDP"
            value={debtToGdp}
            suffix="%"
            decimalPlaces={1}
            icon={Percent}
            variant="economy"
          />
          <MetricModalLayout.StatCard
            label="Debt per Capita"
            value={publicDebt / population}
            prefix="$"
            decimalPlaces={0}
            icon={DollarSign}
            variant="economy"
          />

          <div
            className={`facet-refraction relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden rounded-xl border p-4 ${riskLevel.bg} ${riskLevel.border}`}
          >
            <div>
              <span className="text-muted-foreground block text-[10px] font-medium tracking-wider uppercase">
                Risk Classification
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-lg font-bold tracking-tight ${riskLevel.color}`}>
                  {riskLevel.label}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-4 flex items-center gap-1.5 text-[10.5px] leading-relaxed">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Calculated rating based on macroeconomic capacity parameters.
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
              <CardTitle>Debt Trends</CardTitle>
              <CardDescription>Historical public debt and debt-to-GDP ratio</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
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
                        dataKey="debtToGdp"
                        stroke="#fbbf24"
                        fillOpacity={1}
                        fill="url(#debtGrad)"
                        strokeWidth={2}
                        name="Debt-to-GDP %"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="publicDebt"
                        fill="#fbbf24"
                        name="Public Debt (T)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="publicDebt"
                          stroke="#fbbf24"
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
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <div className="flex flex-1 flex-col gap-4">
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Peak Debt-to-GDP
              </span>
              <span className="text-xl font-bold text-amber-500">
                {debtStats?.maxRatio ? `${debtStats.maxRatio.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Minimum Public Debt
              </span>
              <span className="text-xl font-bold text-green-400">
                {debtStats?.minDebt ? `$${debtStats.minDebt.toFixed(3)} T` : "N/A"}
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Data Points
              </span>
              <span className="text-xl font-bold text-purple-400">
                {debtStats?.dataPoints || 0}
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
    const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
    const globalAvgDebt = 80.0;
    const riskLevel = getDebtRiskLevel(debtToGdp);

    const compData = [
      {
        name: "Debt-to-GDP",
        "Your Country": debtToGdp,
        "Global Average": globalAvgDebt,
      },
    ];

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex-1 border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-amber-500" />
                Global Fiscal Benchmark
              </CardTitle>
              <CardDescription>
                Compare public debt accumulation levels against global baselines.
              </CardDescription>
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
                      dataKey="Global Average"
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
                vs Global Average
              </span>
              <span className="text-xl font-bold text-amber-500">
                {debtToGdp < globalAvgDebt ? "Below Average" : "Above Average"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Ratio: {debtToGdp.toFixed(1)}% vs {globalAvgDebt}% global avg
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Estimated Rating
              </span>
              <span className="flex items-center gap-1.5 text-xl font-bold text-green-400">
                <CreditCard className="h-4 w-4" />
                {debtToGdp < 40
                  ? "AAA"
                  : debtToGdp < 60
                    ? "AA"
                    : debtToGdp < 80
                      ? "A"
                      : debtToGdp < 100
                        ? "BBB"
                        : "BB"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Creditworthiness index estimate
              </span>
            </div>
            <div className="facet-refraction flex flex-1 flex-col justify-center rounded-xl border border-white/5 bg-white/5 p-4">
              <span className="text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase">
                Sustainability Status
              </span>
              <span className="text-xl font-bold text-purple-400">
                {debtToGdp < 60 ? "Sustainable" : debtToGdp < 100 ? "Manageable" : "Critical"}
              </span>
              <span className="text-muted-foreground mt-1 text-[10px]">
                Risk assessment index status
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
    const internalPct = fiscal?.internalDebtGDPPercent || 0;
    const externalPct = fiscal?.externalDebtGDPPercent || 0;
    const totalPct = internalPct + externalPct;
    const domesticShare = totalPct > 0 ? (internalPct / totalPct) * 100 : 60;
    const externalShare = totalPct > 0 ? (externalPct / totalPct) * 100 : 40;

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-6">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Debt Composition</CardTitle>
              <CardDescription>Breakdown of public debt by category</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-blue-400">
                    {domesticShare.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">Domestic Debt</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-purple-400">
                    {externalShare.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">External Debt</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-green-400">25%</div>
                  <div className="text-muted-foreground mt-1 text-xs">Short-Term</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-amber-400">75%</div>
                  <div className="text-muted-foreground mt-1 text-xs">Long-Term</div>
                </div>
              </div>

              <div className="text-muted-foreground mt-6 rounded-lg border border-amber-500/10 bg-amber-500/5 p-4 text-xs">
                <p className="leading-relaxed">
                  Domestic debt is typically denominated in national currency and held by local
                  institutions, presenting lower external default risk. External debt relies on
                  global capital markets and exposes the nation to foreign exchange and trade
                  vulnerability.
                </p>
              </div>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="facet-refraction flex flex-1 flex-col justify-between border-white/5 p-4">
            <CardHeader className="mb-4 p-0">
              <CardTitle className="text-sm font-semibold">Debt Servicing</CardTitle>
              <CardDescription className="text-[10px]">
                Annual interest costs and durations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Annual Interest
                </span>
                <div className="mt-1 text-lg font-bold text-rose-400">
                  ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Average Interest Rate
                </span>
                <div className="text-amber-450 mt-1 text-lg font-bold">
                  {(fiscal?.interestRates || 3.5).toFixed(2)}%
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Average Maturity
                </span>
                <div className="mt-1 text-lg font-bold font-semibold text-purple-400">
                  8.5 Years
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
      title="Public Debt Analysis"
      description="Debt sustainability and fiscal health metrics"
      icon={Landmark}
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

export default DebtAnalysisModal;
