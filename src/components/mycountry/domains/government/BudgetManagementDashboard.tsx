"use client";

import React, { useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatNumber, safeFormatCurrency, toTitleCase } from "~/lib/utils";
import { currentBudgetYear, latestBudgetYearUpTo } from "~/lib/government/budget-year";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { useBudgetEditing } from "~/hooks/useBudgetEditing";
import { useNationClock } from "~/hooks/useNationClock";
import { Skeleton } from "~/components/ui/skeleton";
import type {
  GovernmentStructure,
  GovernmentDepartment,
  BudgetAllocation,
  RevenueSource,
} from "~/types/government";
import { api } from "~/trpc/react";
import {
  REVENUE_CHART_COLORS,
  getBudgetHealthStatus,
  BudgetKeyMetrics,
  BudgetOverviewCharts,
  BudgetDepartmentList,
  BudgetRevenueAnalysis,
  BudgetHealthAnalysis,
  buildDepartmentChartData,
  buildTrendData,
  summarizeBudget,
  summarizeRevenue,
} from "./budget";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { CreateGovernmentStructureButton } from "./CreateGovernmentStructureButton";
import type { NationalRevenue } from "~/components/mycountry/shell/fiscal/nationalRevenue";

const VIEW_OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "departments", label: "Departments" },
  { value: "revenue", label: "Revenue" },
  { value: "analysis", label: "Analysis" },
] as const;
type BudgetView = (typeof VIEW_OPTIONS)[number]["value"];

interface BudgetManagementDashboardProps {
  countryId?: string;
  /** The nation's one revenue figure (`nationalRevenue`), the same the other Economy tabs show. */
  revenue: NationalRevenue;
  governmentStructure?: GovernmentStructure;
  departments?: GovernmentDepartment[];
  budgetAllocations?: BudgetAllocation[];
  revenueSources?: RevenueSource[];
  onUpdateBudget?: (departmentId: string, allocation: Partial<BudgetAllocation>) => void;
  isReadOnly?: boolean;
}

function YearSelect({
  value,
  currentYear,
  onChange,
}: {
  value: number;
  currentYear: number;
  onChange: (year: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v, 10))}>
      <SelectTrigger className="text-footnote h-9 w-24 tabular-nums" aria-label="Budget year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
          <SelectItem key={year} value={String(year)} className="tabular-nums">
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** `startFrom` is the country id when the viewer may start the new year's budget, else undefined. */
function NewYearBanner({
  currentYear,
  effectiveYear,
  startFrom,
  onStarted,
}: {
  currentYear: number;
  effectiveYear: number;
  startFrom?: string;
  onStarted: (year: number) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const startBudgetYear = api.government.startBudgetYear.useMutation({
    onSuccess: async (result) => {
      notify.success(`FY${result.toYear} budget started from FY${result.fromYear}`);
      onStarted(result.toYear);
      await utils.government.getFullByCountryId.invalidate({ countryId: startFrom ?? "" });
    },
    onError: (error) => notify.error(error.message),
  });
  return (
    <div
      role="status"
      className="rounded-control border-yellow/40 flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <p className="text-label text-body">
        A new fiscal year has begun. Your FY{effectiveYear} budget stays in effect until you set the
        FY{currentYear} budget.
      </p>
      {startFrom && (
        <Button
          size="sm"
          onClick={() => startBudgetYear.mutate({ countryId: startFrom })}
          disabled={startBudgetYear.isPending}
        >
          {startBudgetYear.isPending
            ? "Starting…"
            : `Start FY${currentYear} budget from FY${effectiveYear}`}
        </Button>
      )}
    </div>
  );
}

/** For a nation with no departments: the action that creates its form's government. */
function NoGovernmentBanner({ createFor }: { createFor?: string }) {
  return (
    <div
      role="status"
      className="rounded-control border-separator flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <p className="text-label text-body">
        This government has no departments yet. Create its structure to set a budget and appoint a
        cabinet.
      </p>
      {createFor && <CreateGovernmentStructureButton countryId={createFor} />}
    </div>
  );
}

/**
 * Props win; otherwise fall back to the country's fetched government. `ownerView` is true when the
 * fetched budget is the owner's (a visitor's read leaves `totalBudget` out), or when the fetch
 * found no structure for a country the viewer opened in their console.
 */
function useBudgetSources({
  countryId,
  propStructure,
  propDepts,
  propAllocations,
  propRevenue,
}: {
  countryId?: string;
  propStructure?: GovernmentStructure;
  propDepts?: GovernmentDepartment[];
  propAllocations?: BudgetAllocation[];
  propRevenue?: RevenueSource[];
}) {
  const { data: fetchedGov, isSuccess } = api.government.getFullByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId && !propStructure }
  );
  return {
    ownerView:
      !propStructure && isSuccess && (fetchedGov === null || "totalBudget" in (fetchedGov ?? {})),
    governmentStructure: propStructure ?? fetchedGov,
    departments: propDepts ?? (fetchedGov?.departments as GovernmentDepartment[] | undefined) ?? [],
    budgetAllocations:
      propAllocations ?? (fetchedGov?.budgetAllocations as BudgetAllocation[] | undefined) ?? [],
    revenueSources:
      propRevenue ?? (fetchedGov?.revenueSources as RevenueSource[] | undefined) ?? [],
  };
}

function BudgetTitle({
  structure,
  year,
}: {
  structure?: {
    governmentName?: string | null;
    governmentType?: string | null;
    fiscalYear?: string | null;
  } | null;
  year: number;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-label text-title-2">
        {structure?.governmentName ?? "National"} Fiscal Budget
      </h2>
      <p className="text-label-secondary text-footnote mt-0.5">
        {structure?.governmentType ? `${toTitleCase(structure.governmentType)} • ` : ""}
        {year} {structure?.fiscalYear ?? "FY"}
      </p>
    </div>
  );
}

/** The National budget, its years counted on the nation's realm clock (a skeleton until it is known). */
export function BudgetManagementDashboard(props: BudgetManagementDashboardProps) {
  const clock = useNationClock();
  if (!clock) return <Skeleton className="rounded-card h-96 w-full" aria-label="Loading budget" />;
  return <BudgetManagementBody {...props} currentYear={currentBudgetYear(clock.now())} />;
}

function BudgetManagementBody({
  currentYear,
  countryId,
  revenue,
  governmentStructure: propStructure,
  departments: propDepts,
  budgetAllocations: propAllocations,
  revenueSources: propRevenue,
  onUpdateBudget,
  isReadOnly = false,
}: BudgetManagementDashboardProps & { currentYear: number }) {
  const { ownerView, governmentStructure, departments, budgetAllocations, revenueSources } =
    useBudgetSources({
      countryId,
      propStructure,
      propDepts,
      propAllocations,
      propRevenue,
    });

  const [selectedView, setSelectedView] = useState<BudgetView>("overview");
  // The budget in effect is the latest year at or before the nation's current budget year: after
  // a rollover the previous year's budget stays in effect until the new one is started.
  const effectiveYear =
    latestBudgetYearUpTo(
      budgetAllocations.map((a) => a.budgetYear),
      currentYear
    ) ?? currentYear;
  const needsNewYearBudget = effectiveYear < currentYear;
  const [chosenYear, setSelectedYear] = useState<number | null>(null);
  const selectedYear = chosenYear ?? effectiveYear;

  const [overviewChartMode, setOverviewChartMode] = useState<"allocation" | "trend">("allocation");

  const yearAllocations = budgetAllocations.filter((a) => a.budgetYear === selectedYear);
  const totalBudget = governmentStructure?.totalBudget ?? 0;
  const budgetSummary = summarizeBudget(yearAllocations, departments, totalBudget);
  // Owner edits go to the budget in effect, so they are offered only while it is shown.
  const editableCountry =
    countryId && ownerView && !isReadOnly && !propAllocations ? countryId : undefined;
  const editing = useBudgetEditing(
    editableCountry && governmentStructure && selectedYear === effectiveYear
      ? editableCountry
      : undefined,
    totalBudget,
    onUpdateBudget
  );
  const { data: maintenance } = api.government.getPolicyMaintenance.useQuery(
    { countryId: editableCountry ?? "" },
    { enabled: !!editableCountry && !!governmentStructure }
  );
  const revenueSummary = summarizeRevenue(revenue, revenueSources);

  const formatCurrency = (amount: number) =>
    safeFormatCurrency(amount, governmentStructure?.budgetCurrency, false, "USD");

  const departmentChartData = buildDepartmentChartData(yearAllocations, departments);
  const revenueChartData = revenueSummary.revenueBreakdown.map((item, idx) => ({
    name: item.category,
    value: item.amount,
    percent: item.percent,
    color: REVENUE_CHART_COLORS[idx % REVENUE_CHART_COLORS.length] ?? "var(--color-amber-500)",
  }));
  const budgetTrendData = buildTrendData(budgetAllocations);

  const budgetHealth = getBudgetHealthStatus(
    revenueSummary.totalRevenue,
    budgetSummary.totalAllocated
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BudgetTitle structure={governmentStructure} year={selectedYear} />
        <div className="flex items-center gap-3">
          <YearSelect value={selectedYear} currentYear={currentYear} onChange={setSelectedYear} />
          <Badge variant="outline" className={budgetHealth.color}>
            {budgetHealth.label}
          </Badge>
        </div>
      </div>

      {ownerView && departments.length === 0 && <NoGovernmentBanner createFor={editableCountry} />}

      {needsNewYearBudget && (
        <NewYearBanner
          currentYear={currentYear}
          effectiveYear={effectiveYear}
          startFrom={countryId && !isReadOnly && !propAllocations ? countryId : undefined}
          onStarted={setSelectedYear}
        />
      )}

      <BudgetKeyMetrics
        budgetSummary={budgetSummary}
        revenueSummary={revenueSummary}
        maintenanceSpent={maintenance?.[selectedYear] ?? 0}
        formatCurrency={formatCurrency}
      />

      <div className="space-y-4">
        <SegmentedControl
          size="sm"
          className="w-full"
          options={VIEW_OPTIONS}
          value={selectedView}
          onValueChange={(value) => setSelectedView(value as BudgetView)}
          asTabs
        />

        {
          {
            overview: (
              <BudgetOverviewCharts
                overviewChartMode={overviewChartMode}
                setOverviewChartMode={setOverviewChartMode}
                departmentChartData={departmentChartData}
                budgetTrendData={budgetTrendData}
                revenueChartData={revenueChartData}
                formatCurrency={formatCurrency}
              />
            ),
            departments: (
              <BudgetDepartmentList
                departments={budgetSummary.departmentAllocations}
                year={selectedYear}
                formatNumber={formatNumber}
                editing={editing}
              />
            ),
            revenue: (
              <BudgetRevenueAnalysis revenueSummary={revenueSummary} formatNumber={formatNumber} />
            ),
            analysis: (
              <BudgetHealthAnalysis
                budgetSummary={budgetSummary}
                revenueSummary={revenueSummary}
                budgetHealth={budgetHealth}
              />
            ),
          }[selectedView]
        }
      </div>
    </div>
  );
}
