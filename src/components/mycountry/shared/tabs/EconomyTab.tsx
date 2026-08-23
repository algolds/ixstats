"use client";

import React from "react";
import { formatCompactCurrency, formatExactCurrency } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { StatUp as TrendingUp, StatDown as TrendingDown, Suitcase as Briefcase, Building, Globe } from "iconoir-react";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { SectorBreakdownCard, MetricCardGrid, useCountryData } from "~/components/mycountry/shared/primitives";
import type { CardImageType } from "~/lib/cards/image-presets";
import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

export function EconomyTab({
  country,
  economyData,
  countryImageData,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: {
  country: any;
  economyData: any;
  countryImageData: any;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: any;
  setMetricViewAction: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>("sectors");
  const currency = country?.nationalIdentity?.currency || "USD";
  const { isPublicReadOnly } = useCountryData();

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Card className="facet-surface facet-refraction bg-gradient-economy border-border relative overflow-hidden">
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

      <CardContent className="relative z-10 space-y-4 pt-4 pb-4">
        {/* ── Compact Header ── */}
        <div className="border-border/10 flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-foreground text-sm font-bold tracking-wide uppercase">
                Economic Overview
              </h3>
              <InlineHelpIcon
                title="Economic Overview"
                content="View key economic indicators, sectors, trade balances, and business environments. Toggles allow you to view detailed stats per capita or in totals."
              />
            </div>
            <p className="text-muted-foreground/80 text-[11px]">
              GDP, trade, and sector analysis for {country.name}
            </p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
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
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    economyGdp: v.economyGdp === "perCapita" ? "total" : "perCapita",
                  }))
                }
                className="flex h-24 cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <p className="text-muted-foreground/80 text-[9px] font-extrabold tracking-wider uppercase">
                  {metricView.economyGdp === "perCapita" ? "GDP per Capita" : "Total GDP"}
                </p>
                <div
                  className="flex items-center gap-1.5"
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
                      className="text-foreground flex items-center text-base font-bold tracking-tight hover:underline"
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
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-500">
                          <TrendingUp className="inline h-3 w-3" /> +{gdpGrowth.toFixed(1)}%
                        </span>
                      );
                    if (gdpGrowth < 0)
                      return (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
                          <TrendingDown className="inline h-3 w-3" /> {gdpGrowth.toFixed(1)}%
                        </span>
                      );
                    return <span className="text-muted-foreground text-[10px]">0.0%</span>;
                  })()}
                </div>
                <p className="text-muted-foreground truncate text-[10px] font-medium">
                  {metricView.economyGdp === "perCapita"
                    ? `${country.economicTier || "Developing"} · ${formatCompactCurrency(economyData?.core.nominalGDP ?? 0, "N/A", currency)} total`
                    : `Per capita: ${formatExactCurrency(economyData?.core.gdpPerCapita ?? 0, currency)}`}
                </p>
              </button>

              {/* Metric 2: Fiscal */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    fiscal: v.fiscal === "balance" ? "revenue" : "balance",
                  }))
                }
                className="flex h-24 cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.fiscal === "balance" ? "Budget Balance" : "Tax Revenue"}
                </p>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
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
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
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
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {metricView.fiscal === "balance"
                    ? (economyData?.fiscal?.budgetDeficitSurplus ?? 0) >= 0
                      ? "Fiscal Surplus"
                      : "Fiscal Deficit"
                    : `Tax revenue % of GDP`}
                </p>
              </button>

              {/* Metric 3: Trade */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    trade: v.trade === "imports" ? "exports" : "imports",
                  }))
                }
                className="flex h-24 cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <p className="text-muted-foreground/80 text-[9px] font-extrabold tracking-wider uppercase">
                  {metricView.trade === "imports" ? "Total Imports" : "Total Exports"}
                </p>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
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
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
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
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  Net Balance: +3.0% (Surplus)
                </p>
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Click metric value to view history, click headers to toggle views
          </TooltipContent>
        </Tooltip>

        {/* ── Sub-Tabs Content (Folder Dossier Accordion Stack) ── */}
        <div className="border-border/10 space-y-3 border-t pt-3">
          {/* Dossier Section 1: Sectors */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("sectors")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "sectors"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <Building
                  className={`h-3.5 w-3.5 ${expandedSection === "sectors" ? "text-emerald-500" : "text-muted-foreground/60"}`}
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
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "sectors"
                  ? "border border-white/10"
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
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("trade")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "trade"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <Globe
                  className={`h-3.5 w-3.5 ${expandedSection === "trade" ? "text-emerald-500" : "text-muted-foreground/60"}`}
                />
                <span>Trade Flows & Balance</span>
                <motion.div
                  animate={{ rotate: expandedSection === "trade" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "trade" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "trade" ? "border border-white/10" : "border border-transparent"
              }`}
            >
              <TextureOverlay
                texture="paperGrain"
                opacity={0.06}
                className="pointer-events-none absolute inset-0 z-0"
              />
              <div className="relative z-10 space-y-4 p-4">
                <div className="border-border/10 grid grid-cols-3 gap-4 rounded-xl border bg-white/10 p-3 dark:bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Total Exports
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {formatCompactCurrency(
                        (economyData?.core.nominalGDP ?? 0) * 0.35,
                        "N/A",
                        currency
                      )}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">35.0% of GDP</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Total Imports
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {formatCompactCurrency(
                        (economyData?.core.nominalGDP ?? 0) * 0.32,
                        "N/A",
                        currency
                      )}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">32.0% of GDP</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Trade Balance
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-500">
                      {formatCompactCurrency(
                        (economyData?.core.nominalGDP ?? 0) * 0.03,
                        "N/A",
                        currency
                      )}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Surplus (+3.0%)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SectorBreakdownCard
                    title="Export Composition"
                    subtitle="Distribution of goods and services exported"
                    layout="list"
                    showProgressBars={true}
                    cardWrapper="panel"
                    accent="emerald"
                    currency={currency}
                    sectors={[
                      {
                        id: "manufactured",
                        name: "Manufactured Goods",
                        value: 0,
                        percentage: 45,
                        color: "blue",
                        trend: "up",
                        trendValue: 1.5,
                      },
                      {
                        id: "tech",
                        name: "Technology Products",
                        value: 0,
                        percentage: 25,
                        color: "cyan",
                        trend: "up",
                        trendValue: 3.2,
                      },
                      {
                        id: "services",
                        name: "Services",
                        value: 0,
                        percentage: 15,
                        color: "purple",
                        trend: "stable",
                      },
                      {
                        id: "agri",
                        name: "Agricultural Products",
                        value: 0,
                        percentage: 10,
                        color: "green",
                        trend: "down",
                        trendValue: -0.8,
                      },
                      {
                        id: "raw",
                        name: "Raw Materials",
                        value: 0,
                        percentage: 5,
                        color: "amber",
                        trend: "stable",
                      },
                    ]}
                  />
                  <SectorBreakdownCard
                    title="Import Composition"
                    subtitle="Distribution of goods and services imported"
                    layout="list"
                    showProgressBars={true}
                    cardWrapper="panel"
                    accent="emerald"
                    currency={currency}
                    sectors={[
                      {
                        id: "energy",
                        name: "Energy & Fuels",
                        value: (economyData?.core.nominalGDP ?? 0) * 0.32 * 0.3,
                        percentage: 30,
                        color: "red",
                        trend: "down",
                        trendValue: -2.1,
                      },
                      {
                        id: "manufactured",
                        name: "Manufactured Goods",
                        value: 0,
                        percentage: 25,
                        color: "blue",
                        trend: "stable",
                      },
                      {
                        id: "tech",
                        name: "Technology Products",
                        value: 0,
                        percentage: 20,
                        color: "cyan",
                        trend: "up",
                        trendValue: 1.8,
                      },
                      {
                        id: "raw",
                        name: "Raw Materials",
                        value: 0,
                        percentage: 15,
                        color: "amber",
                        trend: "stable",
                      },
                      {
                        id: "food",
                        name: "Food & Agricultural",
                        value: 0,
                        percentage: 10,
                        color: "green",
                        trend: "up",
                        trendValue: 0.5,
                      },
                    ]}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 3: Business & Innovation */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("business")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "business"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <Briefcase
                  className={`h-3.5 w-3.5 ${expandedSection === "business" ? "text-emerald-500" : "text-muted-foreground/60"}`}
                />
                <span>Business & Innovation Climate</span>
                <motion.div
                  animate={{ rotate: expandedSection === "business" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "business" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "business"
                  ? "border border-white/10"
                  : "border border-transparent"
              }`}
            >
              <TextureOverlay
                texture="paperGrain"
                opacity={0.06}
                className="pointer-events-none absolute inset-0 z-0"
              />
              <div className="relative z-10 space-y-4 p-4">
                <div className="border-border/10 grid grid-cols-2 gap-4 rounded-xl border bg-white/10 p-3 md:grid-cols-4 dark:bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Doing Business
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">Rank #45</p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      Out of 190 countries
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Startup Formation
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">12.5</p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      Per 1,000 citizens
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      R&D Investment
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">2.8%</p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Share of GDP</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      FDI Inflow
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">2.5%</p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Of nominal GDP</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SectorBreakdownCard
                    title="Regulatory Environment"
                    subtitle="Key regulatory and startup ease metrics"
                    layout="list"
                    showProgressBars={true}
                    cardWrapper="panel"
                    accent="emerald"
                    sectors={[
                      {
                        id: "time",
                        name: "Time to Start (days)",
                        value: 0,
                        percentage: 92,
                        color: "green",
                        description: "8 days",
                      },
                      {
                        id: "cost",
                        name: "Cost to Start (% income)",
                        value: 0,
                        percentage: 97.5,
                        color: "blue",
                        description: "2.5%",
                      },
                      {
                        id: "regulatory",
                        name: "Regulatory Quality",
                        value: 0,
                        percentage: 72,
                        color: "purple",
                        trend: "up",
                        trendValue: 2.3,
                      },
                      {
                        id: "finance",
                        name: "Access to Finance",
                        value: 0,
                        percentage: 68,
                        color: "amber",
                        trend: "up",
                        trendValue: 1.5,
                      },
                    ]}
                  />
                  <SectorBreakdownCard
                    title="Business Size Composition"
                    subtitle="Distribution of business by personnel size"
                    layout="list"
                    showProgressBars={true}
                    cardWrapper="panel"
                    accent="emerald"
                    sectors={[
                      {
                        id: "small",
                        name: "Small Businesses (0-50)",
                        value: 0,
                        percentage: 85,
                        color: "green",
                      },
                      {
                        id: "medium",
                        name: "Medium Businesses (50-250)",
                        value: 0,
                        percentage: 12,
                        color: "blue",
                      },
                      {
                        id: "large",
                        name: "Large Businesses (250+)",
                        value: 0,
                        percentage: 3,
                        color: "purple",
                      },
                      {
                        id: "entrepreneurship",
                        name: "Entrepreneurship Rate",
                        value: 0,
                        percentage: 15.2,
                        color: "amber",
                        trend: "up",
                        trendValue: 0.8,
                      },
                    ]}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
