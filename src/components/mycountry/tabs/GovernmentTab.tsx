"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building,
  DollarSign,
  Crown,
} from "lucide-react";
import { ChevronRight } from "lucide-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import {
  SectorBreakdownCard,
  MetricCardGrid,
  type CardImageType,
  InlineWiki,
} from "../primitives";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

export function GovernmentTab({
  country,
  economyData,
  countryImageData,
  governmentStructure,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: {
  country: any;
  economyData: any;
  countryImageData: any;
  governmentStructure: any;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: any;
  setMetricViewAction: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>("structure");

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Card className="glass-surface glass-refraction border-border overflow-hidden relative">
      {/* Background wash system (desaturated flag wash + radial dot mesh) */}
      <MetricCardGrid
        metrics={[]} // empty metrics to just render background
        theme="government"
        backgroundImage={{
          countryId: country.id,
          cardType: "government",
          showEditButton: true,
          onEditClick: () =>
            setImageUploadModalAction({ isOpen: true, cardType: "government" }),
          autoFallback: true,
          countryImageData: countryImageData ?? undefined,
          countryName: country.name,
        }}
        cardWrapper="card"
        className="absolute inset-0 z-0 pointer-events-none"
      />

      <CardContent className="space-y-4 pt-4 pb-4 relative z-10">
        {/* ── Compact Header ── */}
        <div className="flex items-center justify-between border-b border-border/10 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-foreground text-sm font-bold tracking-wide uppercase">Government & Fiscal</h3>
              <InlineHelpIcon
                title="Government & Fiscal"
                content="View your nation's leadership, official capital and currency metadata, and public budget allocation details. Click values to analyze spending or debt."
              />
            </div>
            <p className="text-muted-foreground/80 text-[11px]">Structure, spending, and fiscal policy for {country.name}</p>
          </div>
          <Link href={createUrl("/mycountry/editor")}>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 cursor-pointer h-7"
            >
              <Building className="h-3.5 w-3.5" />
              <span>Open Editor</span>
            </Button>
          </Link>
        </div>

        {/* ── 3-Column Metric Toggle Grid ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-2">
              {/* Metric 1: Structure */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    structure: v.structure === "government" ? "state" : "government",
                  }))
                }
                className="rounded-xl bg-white/40 p-3 text-left transition-all hover:bg-white/60 active:scale-[0.98] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] cursor-pointer"
              >
                <p className="text-muted-foreground/70 text-[10px] font-medium tracking-wider uppercase">
                  {metricView.structure === "government" ? "Head of Government" : "Head of State"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.structure}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-foreground text-sm font-bold tracking-tight truncate max-w-full"
                    >
                      {metricView.structure === "government"
                        ? (governmentStructure?.headOfGovernment || "Executive Leader")
                        : (governmentStructure?.headOfState || "State Leader")}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px] truncate">
                  {metricView.structure === "government"
                    ? "Executive office"
                    : (governmentStructure?.governmentType || "Ceremonial office")}
                </p>
              </button>

              {/* Metric 2: Budget */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    budget: v.budget === "percentage" ? "spending" : "percentage",
                  }))
                }
                className="rounded-xl bg-white/40 p-3 text-left transition-all hover:bg-white/60 active:scale-[0.98] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] cursor-pointer"
              >
                <p className="text-muted-foreground/70 text-[10px] font-medium tracking-wider uppercase">
                  {metricView.budget === "percentage" ? "Spending % of GDP" : "Total Spending"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5" onClick={(e) => {
                  e.stopPropagation();
                  openMetricModalAction("government-spending", country.id);
                }}>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.budget}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.budget === "percentage"
                        ? `${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`
                        : (economyData?.spending?.totalSpending ?? 0).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px] truncate">
                  {metricView.budget === "percentage"
                    ? `Public sector share`
                    : `Annual expenditure`}
                </p>
              </button>

              {/* Metric 3: Fiscal */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    debt: v.debt === "ratio" ? "total" : "ratio",
                  }))
                }
                className="rounded-xl bg-white/40 p-3 text-left transition-all hover:bg-white/60 active:scale-[0.98] dark:bg-white/[0.04] dark:hover:bg-white/[0.07] cursor-pointer"
              >
                <p className="text-muted-foreground/70 text-[10px] font-medium tracking-wider uppercase">
                  {metricView.debt === "ratio" ? "Debt to GDP Ratio" : "Total Public Debt"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5" onClick={(e) => {
                  e.stopPropagation();
                  openMetricModalAction("debt", country.id);
                }}>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.debt}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.debt === "ratio"
                        ? `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`
                        : ((economyData?.core.nominalGDP ?? 0) * ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100)).toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 1,
                          })}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[11px] truncate">
                  {metricView.debt === "ratio"
                    ? (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60 ? "Healthy ratio (<60%)" : "High debt ratio (>60%)"
                    : "Outstanding public debt"}
                </p>
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Click metric value to view history, click headers to toggle views
          </TooltipContent>
        </Tooltip>

        {/* ── Sub-Tabs Content (Folder Dossier Accordion Stack) ── */}
        <div className="border-t border-border/10 pt-3 space-y-3">
          {/* Dossier Section 1: Structure */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("structure")}
                className={`relative z-10 px-4 py-2 text-xs font-bold tracking-wider uppercase rounded-t-xl border-t border-x transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  expandedSection === "structure"
                    ? "bg-white/10 dark:bg-white/[0.04] border-white/10 text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Crown className={`h-3.5 w-3.5 ${expandedSection === "structure" ? "text-violet-500" : "text-muted-foreground/60"}`} />
                <span>State Structure</span>
                <motion.div
                  animate={{ rotate: expandedSection === "structure" ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "structure" ? "auto" : 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className={`overflow-hidden relative rounded-b-xl rounded-tr-xl bg-white/10 dark:bg-white/[0.03] backdrop-blur-xs transition-colors duration-200 ${
                expandedSection === "structure" ? "border border-white/10" : "border border-transparent"
              }`}
            >
              <TextureOverlay texture="paperGrain" opacity={0.06} className="absolute inset-0 z-0 pointer-events-none" />
              <div className="p-4 space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl bg-white/10 dark:bg-white/[0.02] border border-border/10 p-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Government Type</p>
                    <p className="text-foreground text-xs font-semibold mt-0.5 truncate">
                      {governmentStructure?.governmentType || country.nationalIdentity?.governmentType || "N/A"}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Constitution base</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Capital City</p>
                    <p className="text-foreground text-xs font-semibold mt-0.5 truncate">
                      {country.nationalIdentity?.capitalCity || "N/A"}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Seat of power</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Official Currency</p>
                    <p className="text-foreground text-xs font-semibold mt-0.5 truncate">
                      {country.nationalIdentity?.currency || "N/A"}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Legal tender</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Branches</p>
                    <p className="text-foreground text-xs font-semibold mt-0.5">3 Branches</p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Separation of powers</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SectorBreakdownCard
                    title="Government Leadership"
                    subtitle="Offices and officeholder names"
                    layout="list"
                    showProgressBars={false}
                    cardWrapper="panel"
                    accent="amber"
                    sectors={[
                      { id: "hos", name: "Head of State", value: 0, percentage: 100, color: "amber", description: governmentStructure?.headOfState || "State Leader" },
                      { id: "hog", name: "Head of Government", value: 0, percentage: 100, color: "blue", description: governmentStructure?.headOfGovernment || "Executive Leader" },
                    ]}
                  />
                  <SectorBreakdownCard
                    title="Legislative & Judicial"
                    subtitle="Legislative chambers and high court"
                    layout="list"
                    showProgressBars={false}
                    cardWrapper="panel"
                    accent="amber"
                    sectors={[
                      { id: "leg", name: governmentStructure?.legislatureType || "Legislature", value: 0, percentage: 100, color: "purple", description: governmentStructure?.legislatureName || "Assembly" },
                      { id: "jud", name: "Judiciary", value: 0, percentage: 100, color: "cyan", description: governmentStructure?.judicialName || "Supreme Court" },
                    ]}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 2: Budget/Spending */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("spending")}
                className={`relative z-10 px-4 py-2 text-xs font-bold tracking-wider uppercase rounded-t-xl border-t border-x transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  expandedSection === "spending"
                    ? "bg-white/10 dark:bg-white/[0.04] border-white/10 text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <DollarSign className={`h-3.5 w-3.5 ${expandedSection === "spending" ? "text-violet-500" : "text-muted-foreground/60"}`} />
                <span>Public Budget</span>
                <motion.div
                  animate={{ rotate: expandedSection === "spending" ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "spending" ? "auto" : 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className={`overflow-hidden relative rounded-b-xl rounded-tr-xl bg-white/10 dark:bg-white/[0.03] backdrop-blur-xs transition-colors duration-200 ${
                expandedSection === "spending" ? "border border-white/10" : "border border-transparent"
              }`}
            >
              <TextureOverlay texture="paperGrain" opacity={0.06} className="absolute inset-0 z-0 pointer-events-none" />
              <div className="p-4 space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl bg-white/10 dark:bg-white/[0.02] border border-border/10 p-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Total Spending</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {(economyData?.spending?.totalSpending ?? 0).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                      })}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Annual expenditure</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Spending % GDP</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {`${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">GDP share percentage</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Spending per Capita</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {(economyData?.spending?.spendingPerCapita ?? 0).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Per citizen share</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Budget Balance</p>
                    <p className={(() => {
                      const balance = economyData?.spending?.deficitSurplus ?? 0;
                      return balance >= 0 ? "text-emerald-500 text-sm font-bold mt-0.5" : "text-red-500 text-sm font-bold mt-0.5";
                    })()}>
                      {(economyData?.spending?.deficitSurplus ?? 0).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                      })}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">
                      {(economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit"}
                    </p>
                  </div>
                </div>

                <SectorBreakdownCard
                  title="Spending by Category"
                  subtitle="Budget allocation across government functions"
                  layout="list"
                  showProgressBars={true}
                  cardWrapper="panel"
                  accent="amber"
                  sectors={[
                    {
                      id: "education",
                      name: "Education",
                      value: economyData?.spending?.education ?? 0,
                      percentage:
                        ((economyData?.spending?.education ?? 0) /
                          (economyData?.spending?.totalSpending || 1)) *
                        100,
                      color: "blue",
                    },
                    {
                      id: "healthcare",
                      name: "Healthcare",
                      value: economyData?.spending?.healthcare ?? 0,
                      percentage:
                        ((economyData?.spending?.healthcare ?? 0) /
                          (economyData?.spending?.totalSpending || 1)) *
                        100,
                      color: "emerald",
                    },
                    {
                      id: "welfare",
                      name: "Social Welfare",
                      value: economyData?.spending?.socialWelfare ?? 0,
                      percentage:
                        ((economyData?.spending?.socialWelfare ?? 0) /
                          (economyData?.spending?.totalSpending || 1)) *
                        100,
                      color: "purple",
                    },
                    {
                      id: "defense",
                      name: "Military & Defense",
                      value: economyData?.spending?.defense ?? 0,
                      percentage:
                        ((economyData?.spending?.defense ?? 0) /
                          (economyData?.spending?.totalSpending || 1)) *
                        100,
                      color: "red",
                    },
                    {
                      id: "infrastructure",
                      name: "Infrastructure",
                      value: economyData?.spending?.infrastructure ?? 0,
                      percentage:
                        ((economyData?.spending?.infrastructure ?? 0) /
                          (economyData?.spending?.totalSpending || 1)) *
                        100,
                      color: "amber",
                    },
                  ]}
                />
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 3: Fiscal */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("fiscal")}
                className={`relative z-10 px-4 py-2 text-xs font-bold tracking-wider uppercase rounded-t-xl border-t border-x transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  expandedSection === "fiscal"
                    ? "bg-white/10 dark:bg-white/[0.04] border-white/10 text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building className={`h-3.5 w-3.5 ${expandedSection === "fiscal" ? "text-violet-500" : "text-muted-foreground/60"}`} />
                <span>Fiscal Policy</span>
                <motion.div
                  animate={{ rotate: expandedSection === "fiscal" ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "fiscal" ? "auto" : 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className={`overflow-hidden relative rounded-b-xl rounded-tr-xl bg-white/10 dark:bg-white/[0.03] backdrop-blur-xs transition-colors duration-200 ${
                expandedSection === "fiscal" ? "border border-white/10" : "border border-transparent"
              }`}
            >
              <TextureOverlay texture="paperGrain" opacity={0.06} className="absolute inset-0 z-0 pointer-events-none" />
              <div className="p-4 space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl bg-white/10 dark:bg-white/[0.02] border border-border/10 p-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Tax Revenue % GDP</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {`${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Tax burden ratio</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Total Debt</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {((economyData?.core.nominalGDP ?? 0) * ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100)).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                      })}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Outstanding national debt</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Debt to GDP Ratio</p>
                    <p className="text-foreground text-sm font-bold mt-0.5">
                      {`${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Relative to economic size</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] uppercase tracking-wider font-semibold">Sovereign Rating</p>
                    <p className="text-emerald-500 text-sm font-bold mt-0.5">AAA</p>
                    <p className="text-muted-foreground/80 text-[10px] mt-0.5">Credit worthiness rating</p>
                  </div>
                </div>

                <SectorBreakdownCard
                  title="Fiscal Conditions & Policy"
                  subtitle="National fiscal policy indicators"
                  layout="list"
                  showProgressBars={true}
                  cardWrapper="panel"
                  accent="amber"
                  sectors={[
                    { id: "tax-compliance", name: "Tax Compliance Rate", value: 0, percentage: economyData?.fiscal?.taxComplianceRate ?? 88, color: "emerald" },
                    { id: "inflation", name: "Annual Inflation Rate", value: 0, percentage: economyData?.fiscal?.inflationRate ?? 2.4, color: "blue" },
                    { id: "interest", name: "Central Bank Interest Rate", value: 0, percentage: economyData?.fiscal?.interestRate ?? 4.25, color: "purple" },
                    { id: "reserves", name: "Foreign Exchange Reserves % GDP", value: 0, percentage: economyData?.fiscal?.reservesGDPPercent ?? 18, color: "cyan" },
                  ]}
                />
              </div>
            </motion.div>
          </div>
        </div>

        <InlineWiki context="government" accent="amber" maxSections={1} />
      </CardContent>
    </Card>
  );
}
