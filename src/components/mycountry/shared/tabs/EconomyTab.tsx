"use client";

import React from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  type DataTabProps,
  GrowthBadge,
  type MetricProps,
  MetricToggleGrid,
  TabShell,
  ToggleMetric,
  toggleView,
  useAccordion,
} from "./tabParts";
import { formatCompactCurrency, formatExactCurrency, formatPercent } from "~/lib/utils";
import { StatUp as TrendingUp, Building } from "iconoir-react";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";
import { tradeFigures } from "~/lib/economy/trade-figures";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { EconomyTradeSection } from "./EconomyTradeSection";
import { EmptyState } from "~/components/ui/empty-state";

const SECTOR_COLORS = ["green", "blue", "purple", "cyan", "amber", "indigo"];

function GdpMetric({
  country,
  economyData,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: MetricProps) {
  const gdpPerCapita = formatExactCurrency(economyData?.core.gdpPerCapita ?? 0, currency);
  const compactGdp = formatCompactCurrency(economyData?.core.nominalGDP ?? 0, "N/A", currency);
  const isPerCapita = metricView.economyGdp === "perCapita";

  return (
    <ToggleMetric
      variant="button"
      label={isPerCapita ? "GDP per Capita" : "Total GDP"}
      valueKey={metricView.economyGdp}
      value={isPerCapita ? gdpPerCapita : compactGdp}
      aside={
        <GrowthBadge
          value={smartNormalizeGrowthRate(
            country.realGDPGrowthRate || country.adjustedGdpGrowth,
            0
          )}
        />
      }
      detail={
        isPerCapita
          ? `${country.economicTier ? `${country.economicTier} · ` : ""}${compactGdp} total`
          : `Per capita: ${gdpPerCapita}`
      }
      onToggle={() => toggleView(setMetricViewAction, "economyGdp", "perCapita", "total")}
      onValueClick={() =>
        openMetricModalAction(isPerCapita ? "gdp-per-capita" : "total-gdp", country.id)
      }
    />
  );
}

function FiscalMetric({
  country,
  economyData,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: MetricProps) {
  const budgetBalance = economyData?.fiscal?.budgetDeficitSurplus ?? 0;
  const isBalance = metricView.fiscal === "balance";

  return (
    <ToggleMetric
      variant="button"
      label={isBalance ? "Budget Balance" : "Tax Revenue"}
      valueKey={metricView.fiscal}
      value={
        isBalance
          ? formatCompactCurrency(budgetBalance, "N/A", currency)
          : formatPercent(economyData?.fiscal?.taxRevenueGDPPercent ?? 0)
      }
      detail={
        isBalance
          ? budgetBalance >= 0
            ? "Fiscal Surplus"
            : "Fiscal Deficit"
          : "Tax revenue % of GDP"
      }
      onToggle={() => toggleView(setMetricViewAction, "fiscal", "balance", "revenue")}
      onValueClick={() => openMetricModalAction("government-spending", country.id)}
    />
  );
}

function TradeMetric({
  country,
  economyData,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: MetricProps) {
  const trade = tradeFigures(economyData?.core);
  const isImports = metricView.trade === "imports";
  const amount = isImports ? trade.imports : trade.exports;

  return (
    <ToggleMetric
      variant="button"
      label={isImports ? "Total Imports" : "Total Exports"}
      valueKey={metricView.trade}
      value={
        amount == null ? (
          <span role="img" aria-label="Not recorded">
            —
          </span>
        ) : (
          formatCompactCurrency(amount, "N/A", currency)
        )
      }
      detail={
        trade.balance == null
          ? "Net balance not recorded"
          : `Net balance: ${trade.balance >= 0 ? "Surplus" : "Deficit"}`
      }
      onToggle={() => toggleView(setMetricViewAction, "trade", "imports", "exports")}
      onValueClick={() => openMetricModalAction("total-gdp", country.id)}
    />
  );
}

function EconomyMetrics(props: MetricProps) {
  return (
    <MetricToggleGrid variant="button">
      <GdpMetric {...props} />
      <FiscalMetric {...props} />
      <TradeMetric {...props} />
    </MetricToggleGrid>
  );
}

export function EconomyTab({
  country,
  economyData,
  countryImageData,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: DataTabProps) {
  const section = useAccordion("sectors");
  const currency = country?.nationalIdentity?.currency || "USD";
  const sectors = parseSectorBreakdown(economyData?.core.sectorBreakdown);
  const gdp = economyData?.core.nominalGDP ?? 0;

  return (
    <TabShell
      country={country}
      countryImageData={countryImageData}
      setImageUploadModalAction={setImageUploadModalAction}
      cardType="economic_indicators"
      title="Economic overview"
      help="View key economic indicators, sectors, trade balances, and business environments. Toggles allow you to view detailed stats per capita or in totals."
      subtitle={`GDP, trade, and sector analysis for ${country.name}`}
      editorIcon={TrendingUp}
      metrics={
        <EconomyMetrics
          country={country}
          economyData={economyData}
          currency={currency}
          metricView={metricView}
          setMetricViewAction={setMetricViewAction}
          openMetricModalAction={openMetricModalAction}
        />
      }
    >
      <CollapsibleSection icon={Building} title="Sectors & distribution" {...section("sectors")}>
        {sectors.length > 0 ? (
          <SectorBreakdownCard
            title="Economic structure"
            subtitle="Recorded share of GDP by sector"
            layout="grid"
            showTrends={false}
            sectors={sectors.map((sector, i) => ({
              id: sector.name,
              name: sector.name,
              value: (gdp * sector.share) / 100,
              percentage: sector.share,
              color: SECTOR_COLORS[i % SECTOR_COLORS.length]!,
            }))}
            totalValue={gdp}
          />
        ) : (
          <EmptyState
            compact
            title="No sector breakdown recorded"
            message="This nation has not recorded how its GDP splits across sectors."
          />
        )}
      </CollapsibleSection>

      <EconomyTradeSection {...section("trade")} economyData={economyData} currency={currency} />
    </TabShell>
  );
}
