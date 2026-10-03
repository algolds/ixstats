"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { formatCompactCurrency, formatExactCurrency } from "~/lib/utils";
import { toTitleCase } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Building, Crown } from "iconoir-react";
import { NavArrowRight as ChevronRight } from "iconoir-react";
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
import { Card, CardContent } from "~/components/ui/card";

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
    <Card className="rounded-card relative overflow-hidden">
      {/* Background wash system (desaturated flag wash + radial dot mesh) */}
      <MetricCardGrid
        metrics={[]} // empty metrics to just render background
        backgroundImage={{
          countryId: country.id,
          cardType: "government",
          showEditButton: !isPublicReadOnly,
          onEditClick: () => setImageUploadModalAction({ isOpen: true, cardType: "government" }),
          autoFallback: true,
          countryImageData: countryImageData ?? undefined,
          countryName: country.name,
        }}
        className="pointer-events-none absolute inset-0 z-0"
      />

      <CardContent className="relative z-10 space-y-4 pt-4 pb-4">
        {/* ── Compact Header ── */}
        <div className="border-separator flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-label text-headline">Government & fiscal</h3>
              <InlineHelpIcon
                title="Government & fiscal"
                content="View your nation's leadership, official capital and currency metadata, and public budget allocation details. Click values to analyze spending or debt."
              />
            </div>
            <p className="text-label-secondary text-footnote">
              Structure, spending, and fiscal policy for {country.name}
            </p>
          </div>
          {!isPublicReadOnly && (
            <Link href={createUrl("/mycountry/editor")}>
              <Button size="sm" variant="outline" className="text-footnote h-8 gap-2">
                <Building className="h-3.5 w-3.5" />
                <span>Open editor</span>
              </Button>
            </Link>
          )}
        </div>

        {/* ── 3-Column Metric Toggle Grid ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid grid-cols-3 gap-3">
              {/* Metric 1: Structure */}
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    structure: v.structure === "government" ? "state" : "government",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <Eyebrow className="block">
                  {metricView.structure === "government" ? "Head of Government" : "Head of State"}
                </Eyebrow>
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={metricView.structure}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="text-label text-headline max-w-full truncate"
                    >
                      {metricView.structure === "government"
                        ? governmentStructure?.headOfGovernment || "Not recorded"
                        : governmentStructure?.headOfState || "Not recorded"}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-label-secondary text-caption truncate">
                  {metricView.structure === "government"
                    ? "Executive office"
                    : toTitleCase(governmentStructure?.governmentType || "Ceremonial office")}
                </p>
              </Button>

              {/* Metric 2: Budget */}
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    budget: v.budget === "percentage" ? "spending" : "percentage",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <span className="text-stat-label text-label-secondary block">
                  {metricView.budget === "percentage" ? "Spending % of GDP" : "Total Spending"}
                </span>
                <div
                  className="flex items-center gap-2"
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
                      className="text-label text-title-3 hover:underline"
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
                <p className="text-label-secondary text-caption truncate">
                  {metricView.budget === "percentage"
                    ? `Public sector share`
                    : `Annual expenditure`}
                </p>
              </Button>

              {/* Metric 3: Fiscal */}
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() =>
                  setMetricViewAction((v: MyCountryMetricView) => ({
                    ...v,
                    debt: v.debt === "ratio" ? "total" : "ratio",
                  }))
                }
                className="h-auto flex-col justify-between gap-1 p-2 whitespace-normal"
              >
                <span className="text-stat-label text-label-secondary block">
                  {metricView.debt === "ratio" ? "Debt to GDP Ratio" : "Total Public Debt"}
                </span>
                <div
                  className="mt-0.5 flex items-center gap-2"
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
                      className="text-label text-title-3 hover:underline"
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
                <p className="text-label-secondary text-footnote mt-0.5 truncate">
                  {metricView.debt === "ratio"
                    ? (economyData?.fiscal?.totalDebtGDPRatio ?? 0) < 60
                      ? "Healthy ratio (<60%)"
                      : "High debt ratio (>60%)"
                    : "Outstanding public debt"}
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
          {/* Dossier Section 1: Structure */}
          <div className="flex flex-col">
            <div className="flex">
              <button
                onClick={() => toggleSection("structure")}
                aria-expanded={expandedSection === "structure"}
                className={`focus-visible:ring-tint rounded-t-row text-headline relative z-10 flex min-h-9 cursor-pointer items-center gap-2 border-x border-t px-4 py-2 transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
                  expandedSection === "structure"
                    ? "text-label border-separator bg-surface"
                    : "text-label-secondary hover:text-label border-transparent bg-transparent"
                }`}
              >
                <Crown
                  className={`h-3.5 w-3.5 ${expandedSection === "structure" ? "text-label" : "text-label-secondary"}`}
                />
                <span>State structure</span>
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
              className={`bg-surface rounded-tr-row rounded-b-row relative overflow-hidden transition-colors duration-200 ${
                expandedSection === "structure"
                  ? "border-separator border"
                  : "border border-transparent"
              }`}
            >
              <div className="relative z-10 space-y-4 p-4">
                <Card
                  variant="inset"
                  padding="none"
                  className="grid grid-cols-2 gap-4 p-3 md:grid-cols-4"
                >
                  <div className="min-w-0">
                    <Eyebrow className="block">Government type</Eyebrow>
                    <p className="text-label text-caption mt-0.5 truncate font-semibold">
                      {toTitleCase(
                        governmentStructure?.governmentType ||
                          country.nationalIdentity?.governmentType ||
                          "N/A"
                      )}
                    </p>
                    <p className="text-label-secondary text-footnote mt-0.5">Constitution base</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Capital city</Eyebrow>
                    <p className="text-label text-caption mt-0.5 truncate font-semibold">
                      {country.nationalIdentity?.capitalCity || "N/A"}
                    </p>
                    <p className="text-label-secondary text-footnote mt-0.5">Seat of power</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Official currency</Eyebrow>
                    <p className="text-label text-caption mt-0.5 truncate font-semibold">
                      {country.nationalIdentity?.currency || "N/A"}
                    </p>
                    <p className="text-label-secondary text-footnote mt-0.5">Legal tender</p>
                  </div>
                  <div className="min-w-0">
                    <Eyebrow className="block">Branches</Eyebrow>
                    <p className="text-label text-caption mt-0.5 font-semibold">
                      {governmentStructure?.branches?.length
                        ? `${governmentStructure.branches.length} Branches`
                        : "Not recorded"}
                    </p>
                    <p className="text-label-secondary text-footnote mt-0.5">
                      Separation of powers
                    </p>
                  </div>
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SectorBreakdownCard
                    title="Government leadership"
                    subtitle="Offices and officeholder names"
                    layout="list"
                    showProgressBars={false}
                    sectors={[
                      {
                        id: "hos",
                        name: "Head of State",
                        value: 0,
                        percentage: 100,
                        color: "amber",
                        description: governmentStructure?.headOfState || "Not recorded",
                      },
                      {
                        id: "hog",
                        name: "Head of Government",
                        value: 0,
                        percentage: 100,
                        color: "blue",
                        description: governmentStructure?.headOfGovernment || "Not recorded",
                      },
                    ]}
                  />
                  <SectorBreakdownCard
                    title="Legislative & judicial"
                    subtitle="Legislative chambers and high court"
                    layout="list"
                    showProgressBars={false}
                    sectors={[
                      {
                        id: "leg",
                        name: "Legislature",
                        value: 0,
                        percentage: 100,
                        color: "indigo",
                        description: governmentStructure?.legislatureName || "Not recorded",
                      },
                      {
                        id: "jud",
                        name: "Judiciary",
                        value: 0,
                        percentage: 100,
                        color: "cyan",
                        description: governmentStructure?.judicialName || "Not recorded",
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
                <div className="bg-fill-3 rounded-row">
                  <button
                    type="button"
                    onClick={() => setCabinetOpen((v) => !v)}
                    aria-expanded={cabinetOpen}
                    className="text-label-secondary hover:text-label focus-visible:ring-tint rounded-row text-headline flex min-h-9 w-full items-center gap-2 px-3 py-2 transition-colors outline-none focus-visible:ring-2"
                  >
                    <Crown
                      className={`h-3.5 w-3.5 ${cabinetOpen ? "text-label" : "text-label-secondary"}`}
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
      </CardContent>
    </Card>
  );
}
