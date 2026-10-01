"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { FacetTabs } from "~/components/ui/facet";
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
  BudgetSummary,
  RevenueSummary,
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
} from "./budget";

interface BudgetManagementDashboardProps {
  countryId?: string;
  governmentStructure?: GovernmentStructure;
  departments?: GovernmentDepartment[];
  budgetAllocations?: BudgetAllocation[];
  revenueSources?: RevenueSource[];
  onUpdateBudget?: (departmentId: string, allocation: Partial<BudgetAllocation>) => void;
  isReadOnly?: boolean;
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
  const { data: fetchedGov } = api.government.getFullByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId && !propStructure }
  );

  const governmentStructure = propStructure ?? fetchedGov;
  const departments: GovernmentDepartment[] =
    propDepts ?? (fetchedGov?.departments as GovernmentDepartment[] | undefined) ?? [];
  const budgetAllocations: BudgetAllocation[] =
    propAllocations ?? (fetchedGov?.budgetAllocations as BudgetAllocation[] | undefined) ?? [];
  const revenueSources: RevenueSource[] =
    propRevenue ?? (fetchedGov?.revenueSources as RevenueSource[] | undefined) ?? [];

  const [selectedView, setSelectedView] = useState<
    "overview" | "departments" | "revenue" | "analysis"
  >("overview");
  // The budget in effect is the latest year at or before the current IxTime year: after a
  // rollover the previous year's budget stays in effect until the new one is started.
  const currentYear = currentBudgetYear();
  const effectiveYear =
    latestBudgetYearUpTo(
      budgetAllocations.map((a: BudgetAllocation) => a.budgetYear),
      currentYear
    ) ?? currentYear;
  const needsNewYearBudget = effectiveYear < currentYear;
  const [chosenYear, setSelectedYear] = useState<number | null>(null);
  const selectedYear = chosenYear ?? effectiveYear;

  const notify = useNotify();
  const utils = api.useUtils();
  const startBudgetYear = api.government.startBudgetYear.useMutation({
    onSuccess: async (result) => {
      notify.success(`FY${result.toYear} budget started from FY${result.fromYear}`);
      setSelectedYear(result.toYear);
      await utils.government.getFullByCountryId.invalidate({ countryId: countryId ?? "" });
    },
    onError: (error) => notify.error(error.message),
  });
  const [overviewChartMode, setOverviewChartMode] = useState<"allocation" | "trend">("allocation");

  // Calculate budget summary
  const budgetSummary: BudgetSummary = useMemo(() => {
    const currentYearAllocations = budgetAllocations.filter(
      (a: BudgetAllocation) => a.budgetYear === selectedYear
    );
    const totalAllocated = currentYearAllocations.reduce(
      (sum: number, a: BudgetAllocation) => sum + (a.allocatedAmount ?? 0),
      0
    );
    const totalSpent = currentYearAllocations.reduce(
      (sum: number, a: BudgetAllocation) => sum + (a.spentAmount ?? 0),
      0
    );
    const totalAvailable = totalAllocated - totalSpent;
    const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    const topSpendingDepartments = currentYearAllocations
      .map((allocation: BudgetAllocation) => {
        const department = departments.find(
          (d: GovernmentDepartment) => d.id === allocation.departmentId
        );
        return department ? { department, allocation } : null;
      })
      .filter(
        (item): item is { department: GovernmentDepartment; allocation: BudgetAllocation } =>
          item !== null
      )
      .sort((a, b) => (b.allocation.allocatedAmount ?? 0) - (a.allocation.allocatedAmount ?? 0))
      .slice(0, 5);

    return {
      totalBudget: governmentStructure?.totalBudget ?? 0,
      totalAllocated,
      totalSpent,
      totalAvailable,
      utilizationRate,
      departmentCount: departments.length,
      topSpendingDepartments,
    };
  }, [budgetAllocations, departments, governmentStructure?.totalBudget, selectedYear]);

  // Calculate revenue summary
  const revenueSummary: RevenueSummary = useMemo(() => {
    const totalRevenue = revenueSources.reduce(
      (sum: number, r: RevenueSource) => sum + (r.revenueAmount ?? 0),
      0
    );
    const totalTaxRevenue = revenueSources
      .filter((r: RevenueSource) => r.category?.includes("Tax"))
      .reduce((sum: number, r: RevenueSource) => sum + (r.revenueAmount ?? 0), 0);
    const totalNonTaxRevenue = totalRevenue - totalTaxRevenue;

    const revenueCategories = [
      "Direct Tax",
      "Indirect Tax",
      "Non-Tax Revenue",
      "Fees and Fines",
      "Other",
    ] as const;
    const revenueBreakdown = revenueCategories
      .map((category) => {
        const amount = revenueSources
          .filter((r: RevenueSource) => r.category === category)
          .reduce((sum: number, r: RevenueSource) => sum + (r.revenueAmount ?? 0), 0);
        return {
          category: category as (typeof revenueCategories)[number],
          amount,
          percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.amount > 0);

    const topRevenueSources = [...revenueSources]
      .sort((a: RevenueSource, b: RevenueSource) => (b.revenueAmount ?? 0) - (a.revenueAmount ?? 0))
      .slice(0, 5);

    return {
      totalRevenue,
      totalTaxRevenue,
      totalNonTaxRevenue,
      revenueBreakdown,
      topRevenueSources,
    };
  }, [revenueSources]);

  const formatCurrency = (amount: number) => {
    return safeFormatCurrency(amount, governmentStructure?.budgetCurrency, false, "USD");
  };

  // Prepare chart data
  const departmentChartData = useMemo(() => {
    return budgetAllocations
      .filter((a: BudgetAllocation) => a.budgetYear === selectedYear)
      .map((allocation: BudgetAllocation) => {
        const department = departments.find(
          (d: GovernmentDepartment) => d.id === allocation.departmentId
        );
        return {
          name: department?.shortName || department?.name || "Unknown",
          allocated: allocation.allocatedAmount ?? 0,
          spent: allocation.spentAmount ?? 0,
          available: allocation.availableAmount ?? 0,
          percent: allocation.allocatedPercent ?? 0,
          color: department?.color || "var(--color-label-secondary)",
        };
      })
      .sort((a, b) => b.allocated - a.allocated);
  }, [budgetAllocations, departments, selectedYear]);

  const revenueChartData = useMemo(() => {
    return revenueSummary.revenueBreakdown.map((item, idx) => ({
      name: item.category,
      value: item.amount,
      percent: item.percent,
      color: REVENUE_CHART_COLORS[idx % REVENUE_CHART_COLORS.length] ?? "var(--color-amber-500)",
    }));
  }, [revenueSummary.revenueBreakdown]);

  const budgetTrendData = useMemo(() => {
    const baseBudget = governmentStructure?.totalBudget ?? 0;
    return [2020, 2021, 2022, 2023, 2024].map((year) => ({
      year: year.toString(),
      budget: baseBudget * (0.95 + (year % 3) * 0.03),
      spent: baseBudget * (0.85 + (year % 2) * 0.04),
      revenue: revenueSummary.totalRevenue * (0.9 + (year % 4) * 0.03),
    }));
  }, [governmentStructure?.totalBudget, revenueSummary.totalRevenue]);

  const budgetHealth = getBudgetHealthStatus(revenueSummary.totalRevenue, budgetSummary.totalSpent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-label text-title-2">
            {governmentStructure?.governmentName ?? "National"} Fiscal Budget
          </h2>
          <p className="text-label-secondary text-footnote mt-0.5">
            {toTitleCase(governmentStructure?.governmentType ?? "Democratic Republic")} •{" "}
            {selectedYear} {governmentStructure?.fiscalYear ?? "FY"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedYear)}
            onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
          >
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
          <Badge variant="outline" className={budgetHealth.color}>
            {budgetHealth.label}
          </Badge>
        </div>
      </div>

      {needsNewYearBudget && (
        <div
          role="status"
          className="rounded-control border-yellow/40 flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
        >
          <p className="text-label text-body">
            A new fiscal year has begun. Your FY{effectiveYear} budget stays in effect until you set
            the FY{currentYear} budget.
          </p>
          {countryId && !isReadOnly && !propAllocations && (
            <Button
              size="sm"
              onClick={() => startBudgetYear.mutate({ countryId })}
              disabled={startBudgetYear.isPending}
            >
              {startBudgetYear.isPending
                ? "Starting…"
                : `Start FY${currentYear} budget from FY${effectiveYear}`}
            </Button>
          )}
        </div>
      )}

      {/* Key Metrics Cards */}
      <BudgetKeyMetrics
        budgetSummary={budgetSummary}
        revenueSummary={revenueSummary}
        formatCurrency={formatCurrency}
      />

      {/* Main Content Tabs */}
      <div className="space-y-4">
        <FacetTabs
          size="sm"
          tone="mycountry"
          className="w-full"
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "departments", label: "Departments" },
            { id: "revenue", label: "Revenue" },
            { id: "analysis", label: "Analysis" },
          ]}
          activeTab={selectedView}
          onChange={(value) =>
            setSelectedView(value as "overview" | "departments" | "revenue" | "analysis")
          }
        />

        {selectedView === "overview" && (
          <BudgetOverviewCharts
            overviewChartMode={overviewChartMode}
            setOverviewChartMode={setOverviewChartMode}
            departmentChartData={departmentChartData}
            budgetTrendData={budgetTrendData}
            revenueChartData={revenueChartData}
            formatCurrency={formatCurrency}
          />
        )}

        {selectedView === "departments" && (
          <BudgetDepartmentList
            departments={budgetSummary.topSpendingDepartments}
            formatNumber={formatNumber}
          />
        )}

        {selectedView === "revenue" && (
          <BudgetRevenueAnalysis revenueSummary={revenueSummary} formatNumber={formatNumber} />
        )}

        {selectedView === "analysis" && (
          <BudgetHealthAnalysis
            budgetSummary={budgetSummary}
            revenueSummary={revenueSummary}
            budgetHealth={budgetHealth}
          />
        )}
      </div>
    </div>
  );
}
