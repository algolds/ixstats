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

const VIEW_OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "departments", label: "Departments" },
  { value: "revenue", label: "Revenue" },
  { value: "analysis", label: "Analysis" },
] as const;
type BudgetView = (typeof VIEW_OPTIONS)[number]["value"];

interface BudgetManagementDashboardProps {
  countryId?: string;
  governmentStructure?: GovernmentStructure;
  departments?: GovernmentDepartment[];
  budgetAllocations?: BudgetAllocation[];
  revenueSources?: RevenueSource[];
  onUpdateBudget?: (departmentId: string, allocation: Partial<BudgetAllocation>) => void;
  isReadOnly?: boolean;
}

function YearSelect({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v, 10))}>
      <SelectTrigger className="text-footnote h-9 w-24 tabular-nums" aria-label="Budget year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 5 }, (_, i) => currentBudgetYear() - i).map((year) => (
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

/** Props win; otherwise fall back to the country's fetched government. */
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
  const { data: fetchedGov } = api.government.getFullByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId && !propStructure }
  );
  return {
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

export function BudgetManagementDashboard({
  countryId,
  governmentStructure: propStructure,
  departments: propDepts,
  budgetAllocations: propAllocations,
  revenueSources: propRevenue,
  onUpdateBudget: _onUpdateBudget,
  isReadOnly = false,
}: BudgetManagementDashboardProps) {
  const { governmentStructure, departments, budgetAllocations, revenueSources } = useBudgetSources({
    countryId,
    propStructure,
    propDepts,
    propAllocations,
    propRevenue,
  });

  const [selectedView, setSelectedView] = useState<BudgetView>("overview");
  // The budget in effect is the latest year at or before the current IxTime year: after a
  // rollover the previous year's budget stays in effect until the new one is started.
  const currentYear = currentBudgetYear();
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
  const budgetSummary = summarizeBudget(
    yearAllocations,
    departments,
    governmentStructure?.totalBudget ?? 0
  );
  const revenueSummary = summarizeRevenue(revenueSources);

  const formatCurrency = (amount: number) =>
    safeFormatCurrency(amount, governmentStructure?.budgetCurrency, false, "USD");

  const departmentChartData = buildDepartmentChartData(yearAllocations, departments);
  const revenueChartData = revenueSummary.revenueBreakdown.map((item, idx) => ({
    name: item.category,
    value: item.amount,
    percent: item.percent,
    color: REVENUE_CHART_COLORS[idx % REVENUE_CHART_COLORS.length] ?? "var(--color-amber-500)",
  }));
  const budgetTrendData = buildTrendData(
    governmentStructure?.totalBudget ?? 0,
    revenueSummary.totalRevenue
  );

  const budgetHealth = getBudgetHealthStatus(revenueSummary.totalRevenue, budgetSummary.totalSpent);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BudgetTitle structure={governmentStructure} year={selectedYear} />
        <div className="flex items-center gap-3">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <Badge variant="outline" className={budgetHealth.color}>
            {budgetHealth.label}
          </Badge>
        </div>
      </div>

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
                departments={budgetSummary.topSpendingDepartments}
                formatNumber={formatNumber}
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
