"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import {
  Bank as Landmark,
  Dollar as DollarSign,
  StatsReport as BarChart3,
  InfoCircle as Info,
  WarningTriangle as AlertTriangle,
  ScaleFrameEnlarge as Scale,
  Percentage as Percent,
} from "iconoir-react";
import { useCountryEconomicData } from "~/hooks/useCountryEconomicData";
import { cn } from "~/lib/utils/cn";
import { BaseMetricDetailsModal, type MetricModalTab } from "./BaseMetricDetailsModal";
import { MetricModalLayout } from "./MetricModalLayout";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface DebtAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName?: string;
}

const TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
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
  } = useCountryEconomicData(countryId, isOpen);

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

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "details":
        return renderDetailsTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={300} sidebarCards={4} />;
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

  const renderDetailsTab = () => {
    if (countryLoading) {
      return <MetricModalLayout.Loading variant="economy" mainHeight={350} sidebarCards={0} />;
    }

    const fiscal = economyData?.fiscal;
    const internalPct = fiscal?.internalDebtGDPPercent || 0;
    const externalPct = fiscal?.externalDebtGDPPercent || 0;
    const totalPct = internalPct + externalPct;
    const domesticShare = totalPct > 0 ? `${((internalPct / totalPct) * 100).toFixed(0)}%` : "—";
    const externalShare = totalPct > 0 ? `${((externalPct / totalPct) * 100).toFixed(0)}%` : "—";
    const interestRate = fiscal?.interestRates ? `${fiscal.interestRates.toFixed(2)}%` : "—";

    return (
      <MetricModalLayout variant="economy">
        <MetricModalLayout.MainArea>
          <Card className="flex flex-1 flex-col justify-between p-6">
            <CardHeader className="mb-4 p-0">
              <h3 className="text-label text-title-3">Debt composition</h3>
              <p className="text-label-secondary text-body">Breakdown of public debt by category</p>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="grid grid-cols-2 gap-4">
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{domesticShare}</div>
                  <div className="text-label-secondary text-footnote mt-1">Domestic debt</div>
                </Card>
                <Card variant="inset" padding="none" className="p-4 text-center">
                  <div className="text-label text-title-3">{externalShare}</div>
                  <div className="text-label-secondary text-footnote mt-1">External debt</div>
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
              <p className="text-label-secondary text-footnote">Annual interest costs and rates</p>
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
                <div className="text-label text-title-3 mt-1">{interestRate}</div>
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
      isLoading={countryLoading}
      variant="economy"
    >
      {renderTabContent}
    </BaseMetricDetailsModal>
  );
}

export default DebtAnalysisModal;
