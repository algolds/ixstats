"use client";

import React from "react";
import { formatExactCurrency } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { StatUp as TrendingUp, Suitcase as Briefcase, Group as Users, Dollar as DollarSign } from "iconoir-react";
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
import type { MetricType } from "~/hooks/useMetricDetailsModal";

export function LaborTab({
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
  const [expandedSection, setExpandedSection] = React.useState<string | null>("workforce");
  const currency = country?.nationalIdentity?.currency || "USD";
  const { isPublicReadOnly } = useCountryData();

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Card className="facet-surface facet-refraction bg-gradient-labor border-border relative overflow-hidden">
      {/* Background wash system (desaturated flag wash + radial dot mesh) */}
      <MetricCardGrid
        metrics={[]} // empty metrics to just render background
        theme="labor"
        backgroundImage={{
          countryId: country.id,
          cardType: "labor",
          showEditButton: !isPublicReadOnly,
          onEditClick: () => setImageUploadModalAction({ isOpen: true, cardType: "labor" }),
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
                Labor & Workforce
              </h3>
              <InlineHelpIcon
                title="Labor & Workforce"
                content="View national employment rates, labor participation, wages, and education levels. Click values to open historical charts and details."
              />
            </div>
            <p className="text-muted-foreground/80 text-[11px]">
              Employment, wages, and human capital for {country.name}
            </p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer gap-1.5 border-red-500/20 bg-red-500/5 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Open Editor</span>
              </Button>
            </Link>
          )}
        </div>

        {/* ── 3-Column Metric Toggle Grid ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-2">
              {/* Metric 1: Workforce */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    workforce: v.workforce === "participation" ? "count" : "participation",
                  }))
                }
                className="border-border-secondary/30 bg-bg-accent/5 hover:bg-bg-accent/10 cursor-pointer rounded-xl border p-3 text-left transition-[transform,opacity,border-color,background-color] duration-150 ease-out active:scale-[0.98] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.workforce === "participation"
                    ? "Participation Rate"
                    : "Total Workforce"}
                </p>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("labor-force", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.workforce}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground flex items-center text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.workforce === "participation"
                        ? `${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}%`
                        : (economyData?.labor?.totalWorkforce ?? 0).toLocaleString()}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {metricView.workforce === "participation"
                    ? "Active workforce share"
                    : `${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}% participation`}
                </p>
              </button>

              {/* Metric 2: Employment */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    employment: v.employment === "employed" ? "unemployed" : "employed",
                  }))
                }
                className="border-border-secondary/30 bg-bg-accent/5 hover:bg-bg-accent/10 cursor-pointer rounded-xl border p-3 text-left transition-[transform,opacity,border-color,background-color] duration-150 ease-out active:scale-[0.98] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.employment === "employed" ? "Employment Rate" : "Unemployment Rate"}
                </p>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction(
                      metricView.employment === "employed" ? "employment" : "unemployment",
                      country.id
                    );
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.employment}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.employment === "employed"
                        ? `${(economyData?.labor?.employmentRate ?? 0).toFixed(1)}%`
                        : `${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`}
                    </motion.p>
                  </AnimatePresence>
                  {(() => {
                    const unemp = economyData?.labor?.unemploymentRate ?? 0;
                    if (unemp < 4.0)
                      return (
                        <span className="text-[10px] font-semibold text-emerald-500">Low</span>
                      );
                    if (unemp > 8.0)
                      return <span className="text-[10px] font-semibold text-red-500">High</span>;
                    return <span className="text-[10px] font-semibold text-amber-500">Stable</span>;
                  })()}
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {metricView.employment === "employed"
                    ? `Active employment share`
                    : `Seeking employment`}
                </p>
              </button>

              {/* Metric 3: Compensation */}
              <button
                onClick={() =>
                  setMetricViewAction((v: any) => ({
                    ...v,
                    compensation: v.compensation === "minimum" ? "average" : "minimum",
                  }))
                }
                className="border-border-secondary/30 bg-bg-accent/5 hover:bg-bg-accent/10 cursor-pointer rounded-xl border p-3 text-left transition-[transform,opacity,border-color,background-color] duration-150 ease-out active:scale-[0.98] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              >
                <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-wide uppercase">
                  {metricView.compensation === "minimum" ? "Minimum Wage" : "Average Wage"}
                </p>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("labor-force", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.compensation}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.compensation === "minimum"
                        ? formatExactCurrency(economyData?.labor?.minimumWage ?? 0, currency)
                        : formatExactCurrency(
                            economyData?.labor?.averageAnnualIncome ?? 0,
                            currency
                          )}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {metricView.compensation === "minimum"
                    ? `Per year (mandatory)`
                    : `Average annual salary`}
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
          {/* Dossier Section 1: Workforce */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("workforce")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "workforce"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <Users
                  className={`h-3.5 w-3.5 ${expandedSection === "workforce" ? "text-red-500" : "text-muted-foreground/60"}`}
                />
                <span>Workforce Overview</span>
                <motion.div
                  animate={{ rotate: expandedSection === "workforce" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "workforce" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "workforce"
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
                      Labor Force
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {(economyData?.labor?.totalWorkforce ?? 0).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Active workforce</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Participation
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.laborForceParticipationRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Working-age share</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Employment
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.employmentRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Employed portion</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Unemployment
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.unemploymentRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Actively seeking</p>
                  </div>
                </div>

                <SectorBreakdownCard
                  title="Employment by Sector"
                  subtitle="Distribution of workforce across economic sectors"
                  layout="grid"
                  showTrends={true}
                  showSectorImages={true}
                  valueAsPeople={true}
                  cardWrapper="panel"
                  accent="red"
                  sectors={[
                    {
                      id: "agriculture",
                      name: "Agriculture",
                      value:
                        (economyData?.labor?.totalWorkforce ?? 0) *
                        ((economyData?.labor?.employmentBySector?.agriculture ?? 0) / 100),
                      percentage: economyData?.labor?.employmentBySector?.agriculture ?? 0,
                      color: "green",
                      trend: "stable",
                      description: "Farming, forestry, fishing",
                      imageKeyword: "labor_primary",
                    },
                    {
                      id: "industry",
                      name: "Industry",
                      value:
                        (economyData?.labor?.totalWorkforce ?? 0) *
                        ((economyData?.labor?.employmentBySector?.industry ?? 0) / 100),
                      percentage: economyData?.labor?.employmentBySector?.industry ?? 0,
                      color: "blue",
                      trend: "stable",
                      description: "Manufacturing, construction",
                      imageKeyword: "labor_secondary",
                    },
                    {
                      id: "services",
                      name: "Services",
                      value:
                        (economyData?.labor?.totalWorkforce ?? 0) *
                        ((economyData?.labor?.employmentBySector?.services ?? 0) / 100),
                      percentage: economyData?.labor?.employmentBySector?.services ?? 0,
                      color: "purple",
                      trend: "up",
                      trendValue: 1.5,
                      description: "Trade, finance, healthcare",
                      imageKeyword: "labor_tertiary",
                    },
                  ]}
                  totalValue={economyData?.labor?.totalWorkforce ?? 0}
                />
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 2: Compensation */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("compensation")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "compensation"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <DollarSign
                  className={`h-3.5 w-3.5 ${expandedSection === "compensation" ? "text-red-500" : "text-muted-foreground/60"}`}
                />
                <span>Compensation & Wages</span>
                <motion.div
                  animate={{ rotate: expandedSection === "compensation" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "compensation" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "compensation"
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
                      Average Annual Income
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {formatExactCurrency(economyData?.labor?.averageAnnualIncome ?? 0, currency)}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Mean earnings</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Minimum Wage
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {formatExactCurrency(economyData?.labor?.minimumWage ?? 0, currency)}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Per year</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Average Work Week
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {economyData?.labor?.averageWorkweekHours ?? 0}h
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Hours per week</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Productivity Index
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {(
                        economyData?.labor?.skillsAndProductivity?.laborProductivityIndex ?? 0
                      ).toFixed(0)}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Output efficiency</p>
                  </div>
                </div>

                <SectorBreakdownCard
                  title="Employment Types"
                  subtitle="Breakdown by employment arrangement"
                  layout="list"
                  showProgressBars={true}
                  cardWrapper="panel"
                  accent="red"
                  sectors={[
                    {
                      id: "fulltime",
                      name: "Full-Time",
                      value: economyData?.labor?.employmentByType?.fullTime ?? 0,
                      percentage: economyData?.labor?.employmentByType?.fullTime ?? 0,
                      color: "emerald",
                    },
                    {
                      id: "parttime",
                      name: "Part-Time",
                      value: economyData?.labor?.employmentByType?.partTime ?? 0,
                      percentage: economyData?.labor?.employmentByType?.partTime ?? 0,
                      color: "blue",
                    },
                    {
                      id: "selfemployed",
                      name: "Self-Employed",
                      value: economyData?.labor?.employmentByType?.selfEmployed ?? 0,
                      percentage: economyData?.labor?.employmentByType?.selfEmployed ?? 0,
                      color: "amber",
                    },
                    {
                      id: "temporary",
                      name: "Temporary",
                      value: economyData?.labor?.employmentByType?.temporary ?? 0,
                      percentage: economyData?.labor?.employmentByType?.temporary ?? 0,
                      color: "purple",
                    },
                    {
                      id: "informal",
                      name: "Informal",
                      value: economyData?.labor?.employmentByType?.informal ?? 0,
                      percentage: economyData?.labor?.employmentByType?.informal ?? 0,
                      color: "red",
                    },
                  ]}
                />
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 3: Human Capital */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("human-capital")}
                className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                  expandedSection === "human-capital"
                    ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <TrendingUp
                  className={`h-3.5 w-3.5 ${expandedSection === "human-capital" ? "text-red-500" : "text-muted-foreground/60"}`}
                />
                <span>Human Capital & Skills</span>
                <motion.div
                  animate={{ rotate: expandedSection === "human-capital" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "human-capital" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
                expandedSection === "human-capital"
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
                      Education Years
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.skillsAndProductivity?.averageEducationYears ?? 0).toFixed(1)} years`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      Schooling duration
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Tertiary Ed Rate
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.skillsAndProductivity?.tertiaryEducationRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      University graduates
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Vocational Rate
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.skillsAndProductivity?.vocationalTrainingRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      Technical certified
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                      Youth Unemp.
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-bold">
                      {`${(economyData?.labor?.skillsAndProductivity?.youthUnemploymentRate ?? 0).toFixed(1)}%`}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                      Age 15-24 unemployed
                    </p>
                  </div>
                </div>

                <SectorBreakdownCard
                  title="Skills & Capital Metrics"
                  subtitle="National human capital and education stats"
                  layout="list"
                  showProgressBars={true}
                  cardWrapper="panel"
                  accent="red"
                  sectors={[
                    {
                      id: "literacy",
                      name: "Adult Literacy Rate",
                      value: 0,
                      percentage: economyData?.labor?.skillsAndProductivity?.literacyRate ?? 95,
                      color: "emerald",
                    },
                    {
                      id: "stem",
                      name: "STEM Graduate Share",
                      value: 0,
                      percentage:
                        economyData?.labor?.skillsAndProductivity?.stemGraduatesPercent ?? 24,
                      color: "blue",
                    },
                    {
                      id: "brain-drain",
                      name: "Brain Drain Index",
                      value: 0,
                      percentage: economyData?.labor?.skillsAndProductivity?.brainDrainIndex ?? 32,
                      color: "purple",
                    },
                    {
                      id: "digital",
                      name: "Digital Literacy Rate",
                      value: 0,
                      percentage:
                        economyData?.labor?.skillsAndProductivity?.digitalLiteracyPercent ?? 78,
                      color: "cyan",
                    },
                  ]}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
