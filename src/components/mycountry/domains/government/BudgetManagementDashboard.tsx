"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { safeFormatCurrency, toTitleCase } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
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
  formatBudgetMetricNumber,
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
  // oxlint-disable-next-line eslint/no-unused-vars
  onUpdateBudget: _onUpdateBudget,
  // oxlint-disable-next-line eslint/no-unused-vars
  isReadOnly: _isReadOnly = false,
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
  const [selectedYear, setSelectedYear] = useState(
    new Date(IxTime.getCurrentIxTime()).getFullYear()
  );
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
      .filter((item): item is { department: GovernmentDepartment; allocation: BudgetAllocation } => item !== null)
      .sort(
        (a, b) => (b.allocation.allocatedAmount ?? 0) - (a.allocation.allocatedAmount ?? 0)
      )
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
          color: department?.color || "#6b7280",
        };
      })
      .sort((a, b) => b.allocated - a.allocated);
  }, [budgetAllocations, departments, selectedYear]);

  const revenueChartData = useMemo(() => {
    return revenueSummary.revenueBreakdown.map((item, idx) => ({
      name: item.category,
      value: item.amount,
      percent: item.percent,
      color: REVENUE_CHART_COLORS[idx % REVENUE_CHART_COLORS.length] ?? "#34d399",
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

  const budgetHealth = getBudgetHealthStatus(
    revenueSummary.totalRevenue,
    budgetSummary.totalSpent
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {governmentStructure?.governmentName ?? "National"} Fiscal Budget
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {toTitleCase(governmentStructure?.governmentType ?? "Democratic Republic")} •{" "}
            {selectedYear} {governmentStructure?.fiscalYear ?? "FY"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="border-border/40 bg-card/60 text-foreground hover:border-border/60 cursor-pointer rounded-xl border px-3 py-1.5 font-mono text-xs font-semibold backdrop-blur-xl transition-all outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const currentIxYear = new Date(IxTime.getCurrentIxTime()).getFullYear();
              return currentIxYear - i;
            }).map((year) => (
              <option
                key={year}
                value={year}
                className="bg-popover text-popover-foreground font-mono"
              >
                {year}
              </option>
            ))}
          </select>
          <Badge
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${budgetHealth.color}`}
          >
            {budgetHealth.label}
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <BudgetKeyMetrics
        budgetSummary={budgetSummary}
        revenueSummary={revenueSummary}
        formatCurrency={formatCurrency}
      />

      {/* Main Content Tabs */}
      <Tabs
        value={selectedView}
        onValueChange={(value) =>
          setSelectedView(value as "overview" | "departments" | "revenue" | "analysis")
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <TabsList className="bg-card/60 border-border/40 grid w-full grid-cols-4 gap-1 rounded-2xl border p-1 shadow-inner backdrop-blur-xl">
            <TabsTrigger
              value="overview"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400"
            >
              Departments
            </TabsTrigger>
            <TabsTrigger
              value="revenue"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400"
            >
              Revenue
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400"
            >
              Analysis
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <BudgetOverviewCharts
            overviewChartMode={overviewChartMode}
            setOverviewChartMode={setOverviewChartMode}
            departmentChartData={departmentChartData}
            budgetTrendData={budgetTrendData}
            revenueChartData={revenueChartData}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-3">
          <BudgetDepartmentList
            departments={budgetSummary.topSpendingDepartments}
            formatNumber={formatBudgetMetricNumber}
          />
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <BudgetRevenueAnalysis
            revenueSummary={revenueSummary}
            formatNumber={formatBudgetMetricNumber}
          />
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <BudgetHealthAnalysis
            budgetSummary={budgetSummary}
            revenueSummary={revenueSummary}
            budgetHealth={budgetHealth}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
