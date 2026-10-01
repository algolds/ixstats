"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { formatCompactCurrency, formatExactCurrency } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { StatUp as TrendingUp, StatDown as TrendingDown, Building } from "iconoir-react";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import {
  SectorBreakdownCard,
  MetricCardGrid,
  useCountryData,
} from "~/components/mycountry/shared/primitives";
import type { CardImageType } from "~/lib/cards/image-presets";
import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";
import type {
  CountryWithEconomicData,
  MappedEconomyData,
} from "~/components/mycountry/shared/primitives/CountryDataProvider";
import type { extractCountryImageData } from "~/lib/media";
import type { MyCountryMetricView } from "~/hooks/useMyCountryMetrics";
import type { MetricType } from "~/hooks/useMetricDetailsModal";
import { EconomyTradeSection } from "./EconomyTradeSection";
import { EconomyBusinessSection } from "./EconomyBusinessSection";

export function EconomyTab({
  country,
  economyData,
  countryImageData,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: {
  country: CountryWithEconomicData;
  economyData: MappedEconomyData;
  countryImageData: ReturnType<typeof extractCountryImageData>;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: MyCountryMetricView;
  setMetricViewAction: React.Dispatch<React.SetStateAction<MyCountryMetricView>>;
}) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>("sectors");
  const currency = country?.nationalIdentity?.currency || "USD";
  const { isPublicReadOnly } = useCountryData();

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <FacetCard className="rounded-card relative overflow-hidden">
      {/* Background wash system (desaturated flag wash + radial dot mesh) */}
      <MetricCardGrid
        metrics={[]} // empty metrics to just render background
        theme="economy"
        backgroundImage={{
          countryId: country.id,
          cardType: "economic_indicators",
          showEditButton: !isPublicReadOnly,
          onEditClick: () =>
            setImageUploadModalAction({ isOpen: true, cardType: "economic_indicators" }),
          autoFallback: true,
          countryImageData: countryImageData ?? undefined,
          countryName: country.name,
        }}
        cardWrapper="card"
        className="pointer-events-none absolute inset-0 z-0"
      />

      <FacetCardContent className="relative z-10 space-y-4 pt-4 pb-4">
        {/* ── Compact Header ── */}
        <div className="border-separator flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-label text-headline">Economic Overview</h3>
              <InlineHelpIcon
                title="Economic Overview"
                content="View key economic indicators, sectors, trade balances, and business environments. Toggles allow you to view detailed stats per capita or in totals."
              />
            </div>
            <p className="text-label-secondary text-footnote">
              GDP, trade, and sector analysis for {country.name}
            </p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button size="sm" variant="outline" className="text-footnote h-8 gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Open Editor</span>
              </Button>
            </Link>
          )}
        </div>

        {/* ── 3-Column Metric Toggle Grid ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-3">
              {/* Metric 1: GDP */}
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    economyGdp: v.economyGdp === "perCapita" ? "total" : "perCapita",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <Eyebrow className="block">
                  {metricView.economyGdp === "perCapita" ? "GDP per Capita" : "Total GDP"}
                </Eyebrow>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction(
                      metricView.economyGdp === "perCapita" ? "gdp-per-capita" : "total-gdp",
                      country.id
                    );
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.economyGdp}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-label text-title-3 flex items-center hover:underline"
                    >
                      {metricView.economyGdp === "perCapita"
                        ? formatExactCurrency(economyData?.core.gdpPerCapita ?? 0, currency)
                        : formatCompactCurrency(economyData?.core.nominalGDP ?? 0, "N/A", currency)}
                    </motion.p>
                  </AnimatePresence>
                  {(() => {
                    const gdpGrowth = smartNormalizeGrowthRate(
                      country.realGDPGrowthRate || country.adjustedGdpGrowth,
                      0
                    );
                    if (gdpGrowth > 0)
                      return (
                        <span className="text-caption text-green flex items-center gap-0.5 font-semibold">
                          <TrendingUp className="inline h-3 w-3" /> +{gdpGrowth.toFixed(1)}%
                        </span>
                      );
                    if (gdpGrowth < 0)
                      return (
                        <span className="text-destructive text-caption flex items-center gap-0.5 font-semibold">
                          <TrendingDown className="inline h-3 w-3" /> {gdpGrowth.toFixed(1)}%
                        </span>
                      );
                    return <span className="text-label-secondary text-footnote">0.0%</span>;
                  })()}
                </div>
                <p className="text-label-secondary text-caption truncate">
                  {metricView.economyGdp === "perCapita"
                    ? `${country.economicTier || "Developing"} · ${formatCompactCurrency(economyData?.core.nominalGDP ?? 0, "N/A", currency)} total`
                    : `Per capita: ${formatExactCurrency(economyData?.core.gdpPerCapita ?? 0, currency)}`}
                </p>
              </Button>

              {/* Metric 2: Fiscal */}
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    fiscal: v.fiscal === "balance" ? "revenue" : "balance",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <Eyebrow className="block">
                  {metricView.fiscal === "balance" ? "Budget Balance" : "Tax Revenue"}
                </Eyebrow>
                <div
                  className="mt-0.5 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("government-spending", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.fiscal}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-label text-title-3 hover:underline"
                    >
                      {metricView.fiscal === "balance"
                        ? formatCompactCurrency(
                            economyData?.fiscal?.budgetDeficitSurplus ?? 0,
                            "N/A",
                            currency
                          )
                        : `${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-label-secondary text-footnote mt-0.5 truncate">
                  {metricView.fiscal === "balance"
                    ? (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0
                      ? "Fiscal Surplus"
                      : "Fiscal Deficit"
                    : `Tax revenue % of GDP`}
                </p>
              </Button>

              {/* Metric 3: Trade */}
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    trade: v.trade === "imports" ? "exports" : "imports",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <Eyebrow className="block">
                  {metricView.trade === "imports" ? "Total Imports" : "Total Exports"}
                </Eyebrow>
                <div
                  className="mt-0.5 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("total-gdp", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.trade}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-label text-title-3 hover:underline"
                    >
                      {metricView.trade === "imports"
                        ? formatCompactCurrency(
                            (economyData?.core.nominalGDP ?? 0) * 0.32,
                            "N/A",
                            currency
                          )
                        : formatCompactCurrency(
                            (economyData?.core.nominalGDP ?? 0) * 0.35,
                            "N/A",
                            currency
                          )}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-label-secondary text-footnote mt-0.5 truncate">
                  Net Balance: +3.0% (Surplus)
                </p>
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-footnote">
            Click metric value to view history, click headers to toggle views
          </TooltipContent>
        </Tooltip>

        {/* ── Sub-Tabs Content (Folder Dossier Accordion Stack) ── */}
        <div className="border-separator space-y-3 border-t pt-3">
          {/* Dossier Section 1: Sectors */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("sectors")}
                aria-expanded={expandedSection === "sectors"}
                className={`focus-visible:ring-tint rounded-t-row text-headline relative z-10 flex min-h-9 cursor-pointer items-center gap-2 border-x border-t px-4 py-2 transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
                  expandedSection === "sectors"
                    ? "text-label border-separator bg-surface"
                    : "text-label-secondary hover:text-label border-transparent bg-transparent"
                }`}
              >
                <Building
                  className={`h-3.5 w-3.5 ${expandedSection === "sectors" ? "text-label" : "text-label-secondary"}`}
                />
                <span>Sectors & Distribution</span>
                <motion.div
                  animate={{ rotate: expandedSection === "sectors" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "sectors" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.25 }}
              className={`bg-surface rounded-tr-row rounded-b-row relative overflow-hidden transition-colors duration-200 ${
                expandedSection === "sectors"
                  ? "border-separator border"
                  : "border border-transparent"
              }`}
            >
              <TextureOverlay
                texture="paperGrain"
                opacity={0.06}
                className="pointer-events-none absolute inset-0 z-0"
              />
              <div className="relative z-10 space-y-4 p-4">
                <SectorBreakdownCard
                  title="Economic Structure"
                  subtitle="GDP distribution across major economic sectors"
                  layout="grid"
                  showTrends={true}
                  showSectorImages={true}
                  cardWrapper="panel"
                  accent="emerald"
                  sectors={[
                    {
                      id: "primary",
                      name: "Primary Sector",
                      value: (economyData?.core.nominalGDP ?? 0) * 0.05,
                      percentage: 5.0,
                      color: "green",
                      trend: "stable",
                      description: "Agriculture, Mining",
                      imageKeyword: "economy_primary",
                    },
                    {
                      id: "secondary",
                      name: "Secondary Sector",
                      value: (economyData?.core.nominalGDP ?? 0) * 0.25,
                      percentage: 25.0,
                      color: "blue",
                      trend: "up",
                      trendValue: 1.2,
                      description: "Manufacturing",
                      imageKeyword: "economy_secondary",
                    },
                    {
                      id: "tertiary",
                      name: "Tertiary Sector",
                      value: (economyData?.core.nominalGDP ?? 0) * 0.55,
                      percentage: 55.0,
                      color: "purple",
                      trend: "up",
                      trendValue: 2.1,
                      description: "Services",
                      imageKeyword: "economy_tertiary",
                    },
                    {
                      id: "quaternary",
                      name: "Quaternary Sector",
                      value: (economyData?.core.nominalGDP ?? 0) * 0.15,
                      percentage: 15.0,
                      color: "cyan",
                      trend: "up",
                      trendValue: 3.5,
                      description: "Knowledge, Tech",
                      imageKeyword: "economy_quaternary",
                    },
                  ]}
                  totalValue={economyData?.core.nominalGDP ?? 0}
                />
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 2: Trade */}
          <EconomyTradeSection
            isExpanded={expandedSection === "trade"}
            onToggle={() => toggleSection("trade")}
            economyData={economyData}
            currency={currency}
          />

          {/* Dossier Section 3: Business & Innovation */}
          <EconomyBusinessSection
            isExpanded={expandedSection === "business"}
            onToggle={() => toggleSection("business")}
          />
        </div>
      </FacetCardContent>
    </FacetCard>
  );
}
