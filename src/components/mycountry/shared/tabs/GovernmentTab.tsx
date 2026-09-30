"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { formatCompactCurrency, formatExactCurrency } from "~/lib/utils";
import { toTitleCase } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Building, Crown } from "iconoir-react";
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
import type { MetricType } from "~/hooks/useMetricDetailsModal";
import { CabinetPanel } from "~/components/executive/politics/CabinetPanel";
import type {
  CountryWithEconomicData,
  MappedEconomyData,
} from "~/components/mycountry/shared/primitives/CountryDataProvider";
import type { extractCountryImageData } from "~/lib/media";
import type { MyCountryMetricView } from "~/hooks/useMyCountryMetrics";
import type { RouterOutputs } from "~/trpc/react";
import { GovernmentSpendingSection } from "./GovernmentSpendingSection";
import { GovernmentFiscalSection } from "./GovernmentFiscalSection";

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
  country: CountryWithEconomicData;
  economyData: MappedEconomyData;
  countryImageData: ReturnType<typeof extractCountryImageData>;
  governmentStructure: RouterOutputs["government"]["getByCountryId"];
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: MyCountryMetricView;
  setMetricViewAction: React.Dispatch<React.SetStateAction<MyCountryMetricView>>;
}) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>("structure");
  const [cabinetOpen, setCabinetOpen] = React.useState(false);
  const currency = country?.nationalIdentity?.currency || "USD";
  const { isPublicReadOnly } = useCountryData();

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <FacetCard depth={1} className="relative overflow-hidden rounded-2xl">
      {/* Background wash system (desaturated flag wash + radial dot mesh) */}
      <MetricCardGrid
        metrics={[]} // empty metrics to just render background
        theme="government"
        backgroundImage={{
          countryId: country.id,
          cardType: "government",
          showEditButton: !isPublicReadOnly,
          onEditClick: () => setImageUploadModalAction({ isOpen: true, cardType: "government" }),
          autoFallback: true,
          countryImageData: countryImageData ?? undefined,
          countryName: country.name,
        }}
        cardWrapper="card"
        className="pointer-events-none absolute inset-0 z-0"
      />

      <FacetCardContent className="relative z-10 space-y-4 pt-4 pb-4">
        {/* ── Compact Header ── */}
        <div className="border-border/10 flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-foreground text-sm font-semibold">Government & Fiscal</h3>
              <InlineHelpIcon
                title="Government & Fiscal"
                content="View your nation's leadership, official capital and currency metadata, and public budget allocation details. Click values to analyze spending or debt."
              />
            </div>
            <p className="text-muted-foreground/80 text-xs">
              Structure, spending, and fiscal policy for {country.name}
            </p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Building className="h-3.5 w-3.5" />
                <span>Open Editor</span>
              </Button>
            </Link>
          )}
        </div>

        {/* ── 3-Column Metric Toggle Grid ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-3">
              {/* Metric 1: Structure */}
              <button
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    structure: v.structure === "government" ? "state" : "government",
                  }))
                }
                className="border-border bg-card hover:bg-accent/50 focus-visible:ring-ring flex h-24 cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-[transform,background-color] duration-150 ease-out outline-none focus-visible:ring-2 active:scale-[0.98]"
              >
                <Eyebrow className="block">
                  {metricView.structure === "government" ? "Head of Government" : "Head of State"}
                </Eyebrow>
                <div className="flex items-center gap-1.5">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.structure}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground max-w-full truncate text-sm font-bold tracking-tight"
                    >
                      {metricView.structure === "government"
                        ? governmentStructure?.headOfGovernment || "Executive Leader"
                        : governmentStructure?.headOfState || "State Leader"}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground truncate text-xs font-medium">
                  {metricView.structure === "government"
                    ? "Executive office"
                    : toTitleCase(governmentStructure?.governmentType || "Ceremonial office")}
                </p>
              </button>

              {/* Metric 2: Budget */}
              <button
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    budget: v.budget === "percentage" ? "spending" : "percentage",
                  }))
                }
                className="border-border bg-card hover:bg-accent/50 focus-visible:ring-ring flex h-24 cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-[transform,background-color] duration-150 ease-out outline-none focus-visible:ring-2 active:scale-[0.98]"
              >
                <Eyebrow className="block">
                  {metricView.budget === "percentage" ? "Spending % of GDP" : "Total Spending"}
                </Eyebrow>
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("government-spending", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.budget}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground text-base font-bold tracking-tight hover:underline"
                    >
                      {metricView.budget === "percentage"
                        ? `${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`
                        : formatCompactCurrency(
                            economyData?.spending?.totalSpending ?? 0,
                            "N/A",
                            currency
                          )}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground truncate text-xs font-medium">
                  {metricView.budget === "percentage"
                    ? `Public sector share`
                    : `Annual expenditure`}
                </p>
              </button>

              {/* Metric 3: Fiscal */}
              <button
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    debt: v.debt === "ratio" ? "total" : "ratio",
                  }))
                }
                className="border-border bg-card hover:bg-accent/50 focus-visible:ring-ring flex h-24 cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-[transform,background-color] duration-150 ease-out outline-none focus-visible:ring-2 active:scale-[0.98]"
              >
                <Eyebrow className="block">
                  {metricView.debt === "ratio" ? "Debt to GDP Ratio" : "Total Public Debt"}
                </Eyebrow>
                <div
                  className="mt-0.5 flex items-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMetricModalAction("debt", country.id);
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.debt}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-foreground text-lg font-bold tracking-tight hover:underline"
                    >
                      {metricView.debt === "ratio"
                        ? `${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`
                        : formatCompactCurrency(
                            (economyData?.core.nominalGDP ?? 0) *
                              ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100),
                            "N/A",
                            currency
                          )}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {metricView.debt === "ratio"
                    ? (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60
                      ? "Healthy ratio (<60%)"
                      : "High debt ratio (>60%)"
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
        <div className="border-border/10 space-y-3 border-t pt-3">
          {/* Dossier Section 1: Structure */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("structure")}
                aria-expanded={expandedSection === "structure"}
                className={`focus-visible:ring-ring relative z-10 flex min-h-9 cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
                  expandedSection === "structure"
                    ? "text-foreground border-border bg-card"
                    : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
                }`}
              >
                <Crown
                  className={`h-3.5 w-3.5 ${expandedSection === "structure" ? "text-foreground" : "text-muted-foreground"}`}
                />
                <span>State Structure</span>
                <motion.div
                  animate={{ rotate: expandedSection === "structure" ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="ml-1"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>
            <motion.div
              initial={false}
              animate={{ height: expandedSection === "structure" ? "auto" : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.25 }}
              className={`bg-card relative overflow-hidden rounded-tr-xl rounded-b-xl transition-colors duration-200 ${
                expandedSection === "structure"
                  ? "border-border border"
                  : "border border-transparent"
              }`}
            >
              <TextureOverlay
                texture="paperGrain"
                opacity={0.06}
                className="pointer-events-none absolute inset-0 z-0"
              />
              <div className="relative z-10 space-y-4 p-4">
                <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-xl p-3 md:grid-cols-4">
                  <div className="min-w-0">
                    <Eyebrow className="block">Government Type</Eyebrow>
                    <p className="text-foreground mt-0.5 truncate text-xs font-semibold">
                      {toTitleCase(
                        governmentStructure?.governmentType ||
                          country.nationalIdentity?.governmentType ||
                          "N/A"
                      )}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-xs">Constitution base</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Capital City</Eyebrow>
                    <p className="text-foreground mt-0.5 truncate text-xs font-semibold">
                      {country.nationalIdentity?.capitalCity || "N/A"}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-xs">Seat of power</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Official Currency</Eyebrow>
                    <p className="text-foreground mt-0.5 truncate text-xs font-semibold">
                      {country.nationalIdentity?.currency || "N/A"}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-xs">Legal tender</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Branches</Eyebrow>
                    <p className="text-foreground mt-0.5 text-xs font-semibold">
                      {governmentStructure?.branches?.length || 3} Branches
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-xs">Separation of powers</p>
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
                      {
                        id: "hos",
                        name: "Head of State",
                        value: 0,
                        percentage: 100,
                        color: "amber",
                        description: governmentStructure?.headOfState || "State Leader",
                      },
                      {
                        id: "hog",
                        name: "Head of Government",
                        value: 0,
                        percentage: 100,
                        color: "blue",
                        description: governmentStructure?.headOfGovernment || "Executive Leader",
                      },
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
                      {
                        id: "leg",
                        name: "Legislature",
                        value: 0,
                        percentage: 100,
                        color: "indigo",
                        description: governmentStructure?.legislatureName || "Assembly",
                      },
                      {
                        id: "jud",
                        name: "Judiciary",
                        value: 0,
                        percentage: 100,
                        color: "cyan",
                        description: governmentStructure?.judicialName || "Supreme Court",
                      },
                      // Lore-first: append any branches beyond the standard three (e.g.
                      // Faneria's Audit + Fiscal "Quaternalist" branches) so non-tripartite
                      // governments show truthfully. See plans/mycountry-lore-alignment*.md
                      ...(governmentStructure?.branches ?? [])
                        .filter(
                          (b) =>
                            !["executive", "legislative", "judicial"].includes(String(b.branchType))
                        )
                        .map((b) => ({
                          id: `branch-${b.id}`,
                          name: b.name,
                          value: 0,
                          percentage: 100,
                          color: "emerald",
                          description: b.description || toTitleCase(b.branchType || "Branch"),
                        })),
                    ]}
                  />
                </div>

                {/* Cabinet staffing panel (collapsible) */}
                <div className="bg-muted/50 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCabinetOpen((v) => !v)}
                    aria-expanded={cabinetOpen}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-9 w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2"
                  >
                    <Crown
                      className={`h-3.5 w-3.5 ${cabinetOpen ? "text-foreground" : "text-muted-foreground"}`}
                    />
                    <span>Cabinet</span>
                    <motion.div
                      animate={{ rotate: cabinetOpen ? 90 : 0 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="ml-1"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {cabinetOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 pt-0">
                          <CabinetPanel countryId={country.id} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Dossier Section 2: Budget/Spending */}
          <GovernmentSpendingSection
            isExpanded={expandedSection === "spending"}
            onToggle={() => toggleSection("spending")}
            economyData={economyData}
            currency={currency}
          />

          {/* Dossier Section 3: Fiscal */}
          <GovernmentFiscalSection
            isExpanded={expandedSection === "fiscal"}
            onToggle={() => toggleSection("fiscal")}
            economyData={economyData}
            currency={currency}
          />
        </div>
      </FacetCardContent>
    </FacetCard>
  );
}
