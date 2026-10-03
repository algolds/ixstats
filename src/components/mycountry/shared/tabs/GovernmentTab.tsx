"use client";

import React from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  type DataTabProps,
  type MetricProps,
  MetricToggleGrid,
  StatGrid,
  TabShell,
  ToggleMetric,
  toggleView,
  useAccordion,
} from "./tabParts";
import { formatCompactCurrency, formatPercent, toTitleCase } from "~/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Building, Crown, NavArrowRight as ChevronRight } from "iconoir-react";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { CabinetPanel } from "~/components/executive/politics/CabinetPanel";
import type { RouterOutputs } from "~/trpc/react";
import { GovernmentSpendingSection } from "./GovernmentSpendingSection";
import { GovernmentFiscalSection } from "./GovernmentFiscalSection";

type GovernmentStructure = RouterOutputs["government"]["getByCountryId"];

const STANDARD_BRANCHES = ["executive", "legislative", "judicial"];

/** A name/officeholder row for the leadership cards (no bar, so value and percentage are fixed). */
function officeRow(id: string, name: string, color: string, description: string) {
  return { id, name, value: 0, percentage: 100, color, description };
}

function CabinetDisclosure({ countryId }: { countryId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bg-fill-3 rounded-row">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-label-secondary hover:text-label focus-visible:ring-tint rounded-row text-headline flex min-h-9 w-full items-center gap-2 px-3 py-2 transition-colors outline-none focus-visible:ring-2"
      >
        <Crown className={`h-3.5 w-3.5 ${open ? "text-label" : "text-label-secondary"}`} />
        <span>Cabinet</span>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          className="ml-1"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0">
              <CabinetPanel countryId={countryId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadershipMetric({
  governmentStructure,
  metricView,
  setMetricViewAction,
}: Pick<MetricProps, "metricView" | "setMetricViewAction"> & {
  governmentStructure: GovernmentStructure;
}) {
  const isGovernment = metricView.structure === "government";
  const head = isGovernment
    ? governmentStructure?.headOfGovernment
    : governmentStructure?.headOfState;

  return (
    <ToggleMetric
      variant="button"
      eyebrow
      label={isGovernment ? "Head of Government" : "Head of State"}
      valueKey={metricView.structure}
      valueClassName="text-headline max-w-full truncate"
      value={head || "Not recorded"}
      detail={
        isGovernment
          ? "Executive office"
          : toTitleCase(governmentStructure?.governmentType || "Ceremonial office")
      }
      onToggle={() => toggleView(setMetricViewAction, "structure", "government", "state")}
    />
  );
}

function BudgetMetric({
  country,
  economyData,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: MetricProps) {
  const isPercentage = metricView.budget === "percentage";

  return (
    <ToggleMetric
      variant="button"
      label={isPercentage ? "Spending % of GDP" : "Total Spending"}
      valueKey={metricView.budget}
      value={
        isPercentage
          ? formatPercent(economyData?.spending?.spendingGDPPercent ?? 0)
          : formatCompactCurrency(economyData?.spending?.totalSpending ?? 0, "N/A", currency)
      }
      detail={isPercentage ? "Public sector share" : "Annual expenditure"}
      onToggle={() => toggleView(setMetricViewAction, "budget", "percentage", "spending")}
      onValueClick={() => openMetricModalAction("government-spending", country.id)}
    />
  );
}

function DebtMetric({
  country,
  economyData,
  currency,
  metricView,
  setMetricViewAction,
  openMetricModalAction,
}: MetricProps) {
  const debtRatio = economyData?.fiscal?.totalDebtGDPRatio ?? 0;
  const isRatio = metricView.debt === "ratio";

  return (
    <ToggleMetric
      variant="button"
      label={isRatio ? "Debt to GDP Ratio" : "Total Public Debt"}
      valueKey={metricView.debt}
      value={
        isRatio
          ? formatPercent(debtRatio)
          : formatCompactCurrency(
              (economyData?.core.nominalGDP ?? 0) * (debtRatio / 100),
              "N/A",
              currency
            )
      }
      detail={
        isRatio
          ? debtRatio < 60
            ? "Healthy ratio (<60%)"
            : "High debt ratio (>60%)"
          : "Outstanding public debt"
      }
      onToggle={() => toggleView(setMetricViewAction, "debt", "ratio", "total")}
      onValueClick={() => openMetricModalAction("debt", country.id)}
    />
  );
}

function GovernmentMetrics({
  governmentStructure,
  ...props
}: MetricProps & { governmentStructure: GovernmentStructure }) {
  return (
    <MetricToggleGrid variant="button">
      <LeadershipMetric
        governmentStructure={governmentStructure}
        metricView={props.metricView}
        setMetricViewAction={props.setMetricViewAction}
      />
      <BudgetMetric {...props} />
      <DebtMetric {...props} />
    </MetricToggleGrid>
  );
}

function StructureSection({
  country,
  governmentStructure,
  section,
}: {
  country: DataTabProps["country"];
  governmentStructure: GovernmentStructure;
  section: ReturnType<typeof useAccordion>;
}) {
  const identity = country.nationalIdentity;
  const branches = governmentStructure?.branches ?? [];

  return (
    <CollapsibleSection icon={Crown} title="State structure" {...section("structure")}>
      <StatGrid
        inset
        eyebrow
        valueClassName="text-caption truncate font-semibold"
        stats={[
          {
            label: "Government type",
            value: toTitleCase(
              governmentStructure?.governmentType || identity?.governmentType || "N/A"
            ),
            detail: "Constitution base",
          },
          {
            label: "Capital city",
            value: identity?.capitalCity || "N/A",
            detail: "Seat of power",
          },
          {
            label: "Official currency",
            value: identity?.currency || "N/A",
            detail: "Legal tender",
          },
          {
            label: "Branches",
            value: branches.length ? `${branches.length} Branches` : "Not recorded",
            detail: "Separation of powers",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectorBreakdownCard
          title="Government leadership"
          subtitle="Offices and officeholder names"
          layout="list"
          showProgressBars={false}
          sectors={[
            officeRow(
              "hos",
              "Head of State",
              "amber",
              governmentStructure?.headOfState || "Not recorded"
            ),
            officeRow(
              "hog",
              "Head of Government",
              "blue",
              governmentStructure?.headOfGovernment || "Not recorded"
            ),
          ]}
        />
        <SectorBreakdownCard
          title="Legislative & judicial"
          subtitle="Legislative chambers and high court"
          layout="list"
          showProgressBars={false}
          sectors={[
            officeRow(
              "leg",
              "Legislature",
              "indigo",
              governmentStructure?.legislatureName || "Not recorded"
            ),
            officeRow(
              "jud",
              "Judiciary",
              "cyan",
              governmentStructure?.judicialName || "Not recorded"
            ),
            // Lore-first: append any branches beyond the standard three (e.g.
            // Faneria's Audit + Fiscal "Quaternalist" branches) so non-tripartite
            // governments show truthfully. See plans/mycountry-lore-alignment*.md
            ...branches
              .filter((b) => !STANDARD_BRANCHES.includes(String(b.branchType)))
              .map((b) =>
                officeRow(
                  `branch-${b.id}`,
                  b.name,
                  "emerald",
                  b.description || toTitleCase(b.branchType || "Branch")
                )
              ),
          ]}
        />
      </div>

      <CabinetDisclosure countryId={country.id} />
    </CollapsibleSection>
  );
}

export function GovernmentTab({
  country,
  economyData,
  countryImageData,
  governmentStructure,
  setImageUploadModalAction,
  openMetricModalAction,
  metricView,
  setMetricViewAction,
}: DataTabProps & { governmentStructure: GovernmentStructure }) {
  const section = useAccordion("structure");
  const currency = country.nationalIdentity?.currency || "USD";

  return (
    <TabShell
      country={country}
      countryImageData={countryImageData}
      setImageUploadModalAction={setImageUploadModalAction}
      cardType="government"
      title="Government & fiscal"
      help="View your nation's leadership, official capital and currency metadata, and public budget allocation details. Click values to analyze spending or debt."
      subtitle={`Structure, spending, and fiscal policy for ${country.name}`}
      editorIcon={Building}
      metrics={
        <GovernmentMetrics
          country={country}
          economyData={economyData}
          governmentStructure={governmentStructure}
          currency={currency}
          metricView={metricView}
          setMetricViewAction={setMetricViewAction}
          openMetricModalAction={openMetricModalAction}
        />
      }
    >
      <StructureSection
        country={country}
        governmentStructure={governmentStructure}
        section={section}
      />
      <GovernmentSpendingSection
        {...section("spending")}
        economyData={economyData}
        currency={currency}
      />
      <GovernmentFiscalSection
        {...section("fiscal")}
        economyData={economyData}
        currency={currency}
      />
    </TabShell>
  );
}
