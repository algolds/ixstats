"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
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
import { cn } from "~/lib/utils/cn";
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
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import type { TimeRange, ChartType } from "./types";
import { filterAndSortHistory } from "./hooks/useMetricHistoryFilter";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  // oxlint-disable-next-line eslint/no-unused-vars
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

    return filterAndSortHistory(historicalData, timeRange, (point, formattedDate, timestamp) => {
      const gdp = point.totalGdp || 0;
      const publicDebt = gdp * (currentDebtRatio / 100);
      const interestPayments = publicDebt * (currentInterestRate / 100);
      return {
        date: formattedDate,
        timestamp,
        publicDebt: publicDebt / 1e12,
        debtToGdp: currentDebtRatio,
        interestPayments: interestPayments / 1e9,
      };
    });
  };

  const chartConfig = {
    publicDebt: { label: "Public Debt (T)", color: "var(--color-amber-500)" },
    debtToGdp: { label: "Debt-to-GDP %", color: "var(--color-amber-500)" },
    interestPayments: { label: "Interest (B)", color: "var(--color-destructive)" },
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
        label: "Low risk",
        color: "text-green",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "default",
      };
    if (debtToGdp < 60)
      return {
        label: "Moderate",
        color: "text-yellow",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "secondary",
      };
    if (debtToGdp < 100)
      return {
        label: "Elevated",
        color: "text-yellow",
        bg: "bg-fill-3",
        border: "border-separator",
        variant: "secondary",
      };
    return {
      label: "High risk",
      color: "text-destructive",
      bg: "bg-fill-3",
      border: "border-separator",
      variant: "destructive",
    };
  };

  const defaultProcessedData = useMemo(
    // oxlint-disable-next-line
    () => processHistoricalData("1y"),
    // oxlint-disable-next-line
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
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Scale className="text-label-secondary h-5 w-5" />
                Fiscal position
              </h3>
              <p className="text-label-secondary text-body">
                Debt sustainability and interest burden indicators.
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Annual interest
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">
                    {(
                      ((fiscal?.debtServiceCosts || 0) / (countryData?.currentTotalGdp || 1)) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Interest/GDP
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">
                    {(
                      ((fiscal?.debtServiceCosts || 0) / (fiscal?.governmentRevenueTotal || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <span className="text-stat-label text-label-secondary mt-1 block">
                    Interest/Rev
                  </span>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className={cn("text-title-3", riskLevel.color)}>{riskLevel.label}</div>
                  <Eyebrow className="mt-1 block">Assessment</Eyebrow>
                </Card>
              </div>

              <Card
                variant="inset"
                padding="none"
                className="text-label-secondary text-footnote mt-6 flex items-start gap-3 p-4"
              >
                <Info className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-relaxed">
                  National public debt indicates cumulative fiscal deficits. Highly elevated
                  Debt-to-GDP ratios place pressure on currency stability and crowd out private
                  investment through interest service fees, while low debt reserves can limit
                  stimulus capability during crises.
                </p>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <MetricModalLayout.StatCard
            label="Public debt"
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
            label="Debt per capita"
            value={publicDebt / population}
            prefix="$"
            decimalPlaces={0}
            icon={DollarSign}
            variant="economy"
          />

          <div
            className={`rounded-row relative flex min-h-[100px] flex-1 flex-col justify-between overflow-hidden border p-4 ${riskLevel.bg} ${riskLevel.border}`}
          >
            <div>
              <span className="text-stat-label text-label-secondary block">
                Risk classification
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-title-3 ${riskLevel.color}`}>{riskLevel.label}</span>
              </div>
            </div>
            <p className="text-label-secondary text-footnote mt-4 flex items-center gap-2 leading-relaxed">
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
        <Card>
          <CardContent className="py-12 text-center">
            <LineChart className="text-label-secondary mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-label-secondary">No historical data available</p>
          </CardContent>
        </Card>
      );
    }

    const ChartComponent =
      chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : RechartsLineChart;

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Debt trends</h3>
              <p className="text-label-secondary text-body">
                Historical public debt and debt-to-GDP ratio
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartComponent data={processedData}>
                    <defs>
                      <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
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
                        dataKey="debtToGdp"
                        stroke="var(--color-amber-500)"
                        fillOpacity={1}
                        fill="url(#debtGrad)"
                        strokeWidth={2}
                        name="Debt-to-GDP %"
                      />
                    ) : chartType === "bar" ? (
                      <Bar
                        dataKey="publicDebt"
                        fill="var(--color-amber-500)"
                        name="Public Debt (T)"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="publicDebt"
                          stroke="var(--color-amber-500)"
                          strokeWidth={2}
                          dot={false}
                          name="Public Debt (T)"
                        />
                        <Line
                          type="monotone"
                          dataKey="debtToGdp"
                          stroke="var(--color-amber-500)"
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Peak debt-to-GDP
              </span>
              <span className="text-label text-title-2">
                {debtStats?.maxRatio ? `${debtStats.maxRatio.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Minimum public debt
              </span>
              <span className="text-title-2 text-green">
                {debtStats?.minDebt ? `$${debtStats.minDebt.toFixed(3)} T` : "N/A"}
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">Data points</span>
              <span className="text-label text-title-2">{debtStats?.dataPoints || 0}</span>
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
    // oxlint-disable-next-line eslint/no-unused-vars
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
          <Card className="flex-1 p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 flex items-center gap-2">
                <Globe className="text-label-secondary h-5 w-5" />
                Global fiscal benchmark
              </h3>
              <p className="text-label-secondary text-body">
                Compare public debt accumulation levels against global baselines.
              </p>
            </CardHeader>
            <CardContent className="p-0">
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
                      dataKey="Global Average"
                      fill="var(--color-label-secondary)"
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
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                vs Global Average
              </span>
              <span className="text-label text-title-2">
                {debtToGdp < globalAvgDebt ? "Below Average" : "Above Average"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
                Ratio: {debtToGdp.toFixed(1)}% vs {globalAvgDebt}% global avg
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Estimated rating
              </span>
              <span className="text-title-2 text-green flex items-center gap-2">
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
              <span className="text-label-secondary text-footnote mt-1">
                Creditworthiness index estimate
              </span>
            </div>
            <div className="bg-fill-3 rounded-row flex flex-1 flex-col justify-center p-4">
              <span className="text-stat-label text-label-secondary mb-1 block">
                Sustainability status
              </span>
              <span
                className={cn(
                  "text-title-2",
                  debtToGdp < 60
                    ? "text-green"
                    : debtToGdp < 100
                      ? "text-yellow"
                      : "text-destructive"
                )}
              >
                {debtToGdp < 60 ? "Sustainable" : debtToGdp < 100 ? "Manageable" : "Critical"}
              </span>
              <span className="text-label-secondary text-footnote mt-1">
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
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Debt composition</h3>
              <p className="text-label-secondary text-body">Breakdown of public debt by category</p>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{domesticShare.toFixed(0)}%</div>
                  <div className="text-label-secondary text-footnote mt-1">Domestic debt</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{externalShare.toFixed(0)}%</div>
                  <div className="text-label-secondary text-footnote mt-1">External debt</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-title-3 text-green">25%</div>
                  <div className="text-label-secondary text-footnote mt-1">Short-Term</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">75%</div>
                  <div className="text-label-secondary text-footnote mt-1">Long-Term</div>
                </Card>
              </div>

              <Card
                variant="inset"
                padding="none"
                className="text-label-secondary text-footnote mt-6 p-4"
              >
                <p className="leading-relaxed">
                  Domestic debt is typically denominated in national currency and held by local
                  institutions, presenting lower external default risk. External debt relies on
                  global capital markets and exposes the nation to foreign exchange and trade
                  vulnerability.
                </p>
              </Card>
            </CardContent>
          </Card>
        </MetricModalLayout.MainArea>

        <MetricModalLayout.Sidebar>
          <Card className="flex flex-1 flex-col justify-between p-4">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3 text-headline">Debt servicing</h3>
              <p className="text-label-secondary text-footnote">
                Annual interest costs and durations
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Annual interest</span>
                <div className="text-destructive text-title-3 mt-1">
                  ${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Average interest rate</span>
                <div className="text-label text-title-3 mt-1">
                  {(fiscal?.interestRates || 3.5).toFixed(2)}%
                </div>
              </Card>

              <Card variant="inset" padding="none" className="p-3">
                <span className="text-stat-label text-label-secondary">Average maturity</span>
                <div className="text-label text-title-3 mt-1">8.5 Years</div>
              </Card>
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
      title="Public debt analysis"
      description="Debt sustainability and fiscal health metrics"
      icon={Landmark}
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

export default DebtAnalysisModal;
