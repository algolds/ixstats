"use client";

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
import { BaseMetricDetailsModal } from "./BaseMetricDetailsModal";
import type { MetricModalTab } from "./types";
import { MetricModalLayout } from "./MetricModalLayout";

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

const RISK_LEVELS = [
  { below: 40, label: "Low risk", color: "text-green" },
  { below: 60, label: "Moderate", color: "text-yellow" },
  { below: 100, label: "Elevated", color: "text-yellow" },
  { below: Infinity, label: "High risk", color: "text-destructive" },
];

type EconomicData = ReturnType<typeof useCountryEconomicData>;
type DebtViewProps = Pick<EconomicData, "countryData"> & {
  fiscal: NonNullable<EconomicData["economyData"]>["fiscal"] | undefined;
};

function DebtOverview({ fiscal, countryData }: DebtViewProps) {
  const debtToGdp = fiscal?.totalDebtGDPRatio || 0;
  const interest = fiscal?.debtServiceCosts || 0;
  const gdp = countryData?.currentTotalGdp || 0;
  const publicDebt = gdp * (debtToGdp / 100);
  const population = countryData?.currentPopulation || 1;
  const riskLevel = RISK_LEVELS.find((level) => debtToGdp < level.below) ?? RISK_LEVELS[0]!;

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          icon={Scale}
          title="Fiscal position"
          subtitle="Debt sustainability and interest burden indicators."
          contentClassName="flex flex-1 flex-col justify-center"
        >
          <MetricModalLayout.TileGrid>
            <MetricModalLayout.Tile
              value={`$${(interest / 1e9).toFixed(1)}B`}
              label="Annual interest"
            />
            <MetricModalLayout.Tile
              value={`${((interest / (gdp || 1)) * 100).toFixed(2)}%`}
              label="Interest/GDP"
            />
            <MetricModalLayout.Tile
              tone="text-green"
              value={`${((interest / (fiscal?.governmentRevenueTotal || 1)) * 100).toFixed(1)}%`}
              label="Interest/Rev"
            />
            <MetricModalLayout.Tile
              tone={riskLevel.color}
              value={riskLevel.label}
              label="Assessment"
              labelStyle="eyebrow"
            />
          </MetricModalLayout.TileGrid>

          <MetricModalLayout.Note icon={Info}>
            National public debt indicates cumulative fiscal deficits. Highly elevated Debt-to-GDP
            ratios place pressure on currency stability and crowd out private investment through
            interest service fees, while low debt reserves can limit stimulus capability during
            crises.
          </MetricModalLayout.Note>
        </MetricModalLayout.Panel>
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
        <MetricModalLayout.Classification
          label="Risk classification"
          value={riskLevel.label}
          tone={riskLevel.color}
          icon={AlertTriangle}
          description="Calculated rating based on macroeconomic capacity parameters."
        />
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

function DebtDetails({ fiscal }: Pick<DebtViewProps, "fiscal">) {
  const internalPct = fiscal?.internalDebtGDPPercent || 0;
  const externalPct = fiscal?.externalDebtGDPPercent || 0;
  const totalPct = internalPct + externalPct;
  const share = (pct: number) => (totalPct > 0 ? `${((pct / totalPct) * 100).toFixed(0)}%` : "—");

  return (
    <MetricModalLayout variant="economy">
      <MetricModalLayout.MainArea>
        <MetricModalLayout.Panel
          title="Debt composition"
          subtitle="Breakdown of public debt by category"
        >
          <MetricModalLayout.TileGrid columns="grid-cols-2">
            <MetricModalLayout.Tile
              value={share(internalPct)}
              label="Domestic debt"
              labelStyle="footnote"
            />
            <MetricModalLayout.Tile
              value={share(externalPct)}
              label="External debt"
              labelStyle="footnote"
            />
          </MetricModalLayout.TileGrid>

          <MetricModalLayout.Note>
            Domestic debt is typically denominated in national currency and held by local
            institutions, presenting lower external default risk. External debt relies on global
            capital markets and exposes the nation to foreign exchange and trade vulnerability.
          </MetricModalLayout.Note>
        </MetricModalLayout.Panel>
      </MetricModalLayout.MainArea>

      <MetricModalLayout.Sidebar>
        <MetricModalLayout.SidePanel
          title="Debt servicing"
          subtitle="Annual interest costs and rates"
        >
          <MetricModalLayout.Metric
            label="Annual interest"
            tone="text-destructive"
            value={`$${((fiscal?.debtServiceCosts || 0) / 1e9).toFixed(1)}B`}
          />
          <MetricModalLayout.Metric
            label="Average interest rate"
            value={fiscal?.interestRates ? `${fiscal.interestRates.toFixed(2)}%` : "—"}
          />
        </MetricModalLayout.SidePanel>
      </MetricModalLayout.Sidebar>
    </MetricModalLayout>
  );
}

export function DebtAnalysisModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: DebtAnalysisModalProps) {
  const {
    countryData,
    economyData,
    isLoading: countryLoading,
  } = useCountryEconomicData(countryId, isOpen);
  const fiscal = economyData?.fiscal;

  const tabs = {
    overview: <DebtOverview fiscal={fiscal} countryData={countryData} />,
    details: <DebtDetails fiscal={fiscal} />,
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
      {(tab) =>
        countryLoading ? (
          <MetricModalLayout.Loading
            variant="economy"
            mainHeight={tab === "overview" ? 300 : 350}
            sidebarCards={tab === "overview" ? 4 : 0}
          />
        ) : (
          (tabs[tab as keyof typeof tabs] ?? null)
        )
      }
    </BaseMetricDetailsModal>
  );
}
