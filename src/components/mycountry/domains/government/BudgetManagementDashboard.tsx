"use client";

import React, { useState, useMemo } from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
// oxlint-disable-next-line eslint/no-unused-vars
import { safeFormatCurrency, formatCurrency, toTitleCase, cn } from "~/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Dollar as DollarSign, StatUp as TrendingUp, StatsReport as BarChart3, Archery as Target } from "iconoir-react";
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
  onUpdateBudget,
  // oxlint-disable-next-line eslint/no-unused-vars
  isReadOnly = false,
}: BudgetManagementDashboardProps) {
  const { data: fetchedGov } = api.government.getFullByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId && !propStructure }
  );

  const governmentStructure = propStructure ?? fetchedGov;
  const departments = propDepts ?? (fetchedGov?.departments as any) ?? [];
  const budgetAllocations = propAllocations ?? (fetchedGov?.budgetAllocations as any) ?? [];
  const revenueSources = propRevenue ?? (fetchedGov?.revenueSources as any) ?? [];

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
      .map((allocation: BudgetAllocation) => ({
        department: departments.find(
          (d: GovernmentDepartment) => d.id === allocation.departmentId
        )!,
        allocation,
      }))
      .filter((item: any) => item.department)
      .sort(
        (a: any, b: any) =>
          (b.allocation?.allocatedAmount ?? 0) - (a.allocation?.allocatedAmount ?? 0)
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
          category: category as any,
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

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Prepare chart data
  const departmentChartData = budgetAllocations
    .filter((a: BudgetAllocation) => a.budgetYear === selectedYear)
    .map((allocation: BudgetAllocation) => {
      const department = departments.find(
        (d: GovernmentDepartment) => d.id === allocation.departmentId
      );
      return {
        name: department?.shortName || department?.name || "Unknown",
        allocated: allocation.allocatedAmount,
        spent: allocation.spentAmount,
        available: allocation.availableAmount,
        percent: allocation.allocatedPercent,
        color: department?.color || "#6b7280",
      };
    })
    .sort((a: any, b: any) => b.allocated - a.allocated);

  const REVENUE_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#c084fc", "#2dd4bf", "#f43f5e"];

  const revenueChartData = revenueSummary.revenueBreakdown.map((item, idx) => ({
    name: item.category,
    value: item.amount,
    percent: item.percent,
    color: REVENUE_COLORS[idx % REVENUE_COLORS.length],
  }));

  const budgetTrendData = [2020, 2021, 2022, 2023, 2024].map((year) => ({
    year: year.toString(),
    budget: (governmentStructure?.totalBudget ?? 0) * (0.95 + Math.random() * 0.1), // Mock trend data
    spent: (governmentStructure?.totalBudget ?? 0) * (0.85 + Math.random() * 0.1),
    revenue: revenueSummary.totalRevenue * (0.9 + Math.random() * 0.2),
  }));

  const getBudgetHealthStatus = () => {
    const deficit = revenueSummary.totalRevenue - budgetSummary.totalSpent;
    const deficitPercent =
      revenueSummary.totalRevenue > 0 ? (deficit / revenueSummary.totalRevenue) * 100 : 0;

    if (deficitPercent > 5)
      return {
        status: "surplus",
        color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono",
        label: "Surplus",
      };
    if (deficitPercent > -3)
      return {
        status: "balanced",
        color: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono",
        label: "Balanced",
      };
    if (deficitPercent > -10)
      return {
        status: "moderate",
        color: "bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono",
        label: "Moderate Deficit",
      };
    return {
      status: "deficit",
      color: "bg-red-500/10 text-red-400 border border-red-500/30 font-mono",
      label: "High Deficit",
    };
  };

  const budgetHealth = getBudgetHealthStatus();

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
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Total Budget
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400 tabular-nums">
                {formatNumber(budgetSummary.totalBudget)}
              </p>
            </div>
            <DollarSign className="h-6 w-6 shrink-0 text-emerald-400" />
          </div>
          <div className="mt-2">
            <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {formatCurrency(budgetSummary.totalBudget)}
            </p>
          </div>
        </div>

        <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Allocated
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400 tabular-nums">
                {formatNumber(budgetSummary.totalAllocated)}
              </p>
            </div>
            <Target className="h-6 w-6 shrink-0 text-cyan-400" />
          </div>
          <div className="mt-2">
            <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {budgetSummary.totalBudget > 0
                ? ((budgetSummary.totalAllocated / budgetSummary.totalBudget) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </div>
        </div>

        <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Utilized
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-400 tabular-nums">
                {formatNumber(budgetSummary.totalSpent)}
              </p>
            </div>
            <TrendingUp className="h-6 w-6 shrink-0 text-amber-400" />
          </div>
          <div className="mt-2">
            <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {budgetSummary.utilizationRate.toFixed(1)}% utilization
            </p>
          </div>
        </div>

        <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Revenue
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400 tabular-nums">
                {formatNumber(revenueSummary.totalRevenue)}
              </p>
            </div>
            <BarChart3 className="h-6 w-6 shrink-0 text-purple-400" />
          </div>
          <div className="mt-2">
            <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {revenueSummary.totalTaxRevenue > 0
                ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1)
                : 0}
              % tax
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs — Apple Segmented Control */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <div className="mb-4 flex items-center justify-between">
          <TabsList className="bg-card/60 border-border/40 grid w-full grid-cols-4 gap-1 rounded-2xl border p-1 shadow-inner backdrop-blur-xl">
            <TabsTrigger
              value="overview"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/25 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/25 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400"
            >
              Departments
            </TabsTrigger>
            <TabsTrigger
              value="revenue"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/25 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400"
            >
              Revenue
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="rounded-xl text-xs font-extrabold data-[state=active]:border data-[state=active]:border-emerald-500/40 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/25 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400"
            >
              Analysis
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Togglable Budget Allocation vs Historical Trend Chart */}
            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 flex items-center justify-between border-b pb-2">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  {overviewChartMode === "allocation"
                    ? "Budget Allocation by Department"
                    : "Budget vs Revenue Historical Trend"}
                </h4>
                <div className="bg-muted/20 border-border/30 flex items-center gap-1 rounded-lg border p-0.5">
                  <button
                    type="button"
                    onClick={() => setOverviewChartMode("allocation")}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-bold transition-all select-none",
                      overviewChartMode === "allocation"
                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Allocation
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewChartMode("trend")}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-bold transition-all select-none",
                      overviewChartMode === "trend"
                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Trend
                  </button>
                </div>
              </div>

              <div className="h-72">
                {overviewChartMode === "allocation" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentChartData.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="allocated"
                        label={({ name, percent }) =>
                          `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`
                        }
                      >
                        {departmentChartData.slice(0, 8).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={budgetTrendData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="year"
                        stroke="currentColor"
                        className="text-muted-foreground text-[10px]"
                      />
                      <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="budget"
                        stroke="#38bdf8"
                        name="Budget"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="spent"
                        stroke="#f43f5e"
                        name="Spending"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#34d399"
                        name="Revenue"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </FacetCard>

            {/* Revenue Sources Chart */}
            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 border-b pb-2">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Revenue Sources
                </h4>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      className="text-muted-foreground text-[10px]"
                    />
                    <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {revenueChartData.map((entry, index) => (
                        <Cell key={`revenue-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FacetCard>
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {budgetSummary.topSpendingDepartments.map(({ department, allocation }) => (
              <FacetCard
                key={department.id}
                depth={1}
                className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3.5 w-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: department.color }}
                    />
                    <div>
                      <h3 className="text-foreground text-sm font-semibold">{department.name}</h3>
                      <p className="text-muted-foreground text-xs">
                        {department.category} • {department.ministerTitle}:{" "}
                        {department.minister || "Vacant"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                      {formatNumber(allocation.allocatedAmount)}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {allocation.allocatedPercent.toFixed(1)}% of budget
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Budget Utilization</span>
                    <span className="text-foreground font-mono font-semibold tabular-nums">
                      {allocation.allocatedAmount > 0
                        ? ((allocation.spentAmount / allocation.allocatedAmount) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      allocation.allocatedAmount > 0
                        ? (allocation.spentAmount / allocation.allocatedAmount) * 100
                        : 0
                    }
                    className="h-1.5"
                  />
                  <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                    <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Allocated
                      </p>
                      <p className="text-foreground mt-0.5 font-mono font-semibold tabular-nums">
                        {formatNumber(allocation.allocatedAmount)}
                      </p>
                    </div>
                    <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Spent
                      </p>
                      <p className="mt-0.5 font-mono font-semibold text-amber-400 tabular-nums">
                        {formatNumber(allocation.spentAmount)}
                      </p>
                    </div>
                    <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Remaining
                      </p>
                      <p className="mt-0.5 font-mono font-semibold text-cyan-400 tabular-nums">
                        {formatNumber(allocation.availableAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </FacetCard>
            ))}
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 border-b pb-2">
                <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  Tax vs Non-Tax Revenue
                </h4>
              </div>
              <div className="space-y-3">
                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-foreground text-xs font-semibold">Tax Revenue</p>
                    <p className="text-muted-foreground text-[11px]">Direct & Indirect Taxes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                      {formatNumber(revenueSummary.totalTaxRevenue)}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {revenueSummary.totalRevenue > 0
                        ? (
                            (revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>

                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="text-foreground text-xs font-semibold">Non-Tax Revenue</p>
                    <p className="text-muted-foreground text-[11px]">Fees, Fines & Other Sources</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base font-bold text-cyan-400 tabular-nums">
                      {formatNumber(revenueSummary.totalNonTaxRevenue)}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {revenueSummary.totalRevenue > 0
                        ? (
                            (revenueSummary.totalNonTaxRevenue / revenueSummary.totalRevenue) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </FacetCard>

            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 border-b pb-2">
                <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  Top Revenue Sources
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                {revenueSummary.topRevenueSources.map((source, index) => (
                  <div
                    key={source.id}
                    className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-[10px] font-semibold text-emerald-400 tabular-nums">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-foreground text-xs font-semibold">{source.name}</p>
                        <p className="text-muted-foreground text-[10px]">{source.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
                        {formatNumber(source.revenueAmount)}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                        {source.revenuePercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </FacetCard>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 border-b pb-2">
                <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  Budget Health Indicators
                </h4>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
                  <span className="text-muted-foreground font-semibold">Fiscal Balance</span>
                  <Badge
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${budgetHealth.color}`}
                  >
                    {budgetHealth.label}
                  </Badge>
                </div>

                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
                  <span className="text-muted-foreground font-semibold">Budget Utilization</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${budgetSummary.utilizationRate > 90 ? "text-emerald-400" : budgetSummary.utilizationRate > 70 ? "text-amber-400" : "text-red-400"}`}
                  >
                    {budgetSummary.utilizationRate.toFixed(1)}%
                  </span>
                </div>

                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
                  <span className="text-muted-foreground font-semibold">Revenue Adequacy</span>
                  <span
                    className={`font-semibold ${revenueSummary.totalRevenue > budgetSummary.totalAllocated ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {revenueSummary.totalRevenue > budgetSummary.totalAllocated
                      ? "Adequate"
                      : "Insufficient"}
                  </span>
                </div>

                <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
                  <span className="text-muted-foreground font-semibold">Departments</span>
                  <span className="text-foreground font-mono font-semibold tabular-nums">
                    {budgetSummary.departmentCount} Active
                  </span>
                </div>
              </div>
            </FacetCard>

            <FacetCard
              depth={1}
              className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="border-border/20 border-b pb-2">
                <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  Budget Efficiency Score
                </h4>
              </div>
              <div className="space-y-4 text-center">
                <div className="font-mono text-4xl font-bold tracking-tight text-emerald-400 tabular-nums">
                  {Math.min(
                    100,
                    Math.round(
                      (budgetSummary.utilizationRate +
                        (revenueSummary.totalRevenue > budgetSummary.totalSpent ? 20 : -20) +
                        (budgetSummary.departmentCount > 5 ? 10 : 0)) *
                        0.8
                    )
                  )}
                </div>
                <p className="text-muted-foreground text-xs font-semibold">
                  Overall Administrative Efficiency Score
                </p>
                <div className="space-y-2 text-left text-xs">
                  <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
                    <span className="text-muted-foreground font-medium">Utilization Rate</span>
                    <span className="text-foreground font-mono font-bold">
                      {budgetSummary.utilizationRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
                    <span className="text-muted-foreground font-medium">Fiscal Health</span>
                    <span className="font-bold text-emerald-400">{budgetHealth.label}</span>
                  </div>
                  <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
                    <span className="text-muted-foreground font-medium">Department Coverage</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {budgetSummary.departmentCount} depts
                    </span>
                  </div>
                </div>
              </div>
            </FacetCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
