import type {
  BudgetAllocation,
  BudgetSummary,
  GovernmentDepartment,
  RevenueCategory,
  RevenueSource,
  RevenueSummary,
} from "~/types/government";
import type { BudgetTrendItem, DepartmentChartItem } from "./budgetTypes";

const sumOf = <T>(items: T[], pick: (item: T) => number | null | undefined) =>
  items.reduce((total, item) => total + (pick(item) ?? 0), 0);

const REVENUE_CATEGORIES: RevenueCategory[] = [
  "Direct Tax",
  "Indirect Tax",
  "Non-Tax Revenue",
  "Fees and Fines",
  "Other",
];

export function summarizeBudget(
  allocations: BudgetAllocation[],
  departments: GovernmentDepartment[],
  totalBudget: number
): BudgetSummary {
  const totalAllocated = sumOf(allocations, (a) => a.allocatedAmount);
  const totalSpent = sumOf(allocations, (a) => a.spentAmount);
  const departmentAllocations = departments
    .map((department) => ({
      department,
      allocation: allocations.find((a) => a.departmentId === department.id) ?? null,
    }))
    .sort((a, b) => (b.allocation?.allocatedAmount ?? 0) - (a.allocation?.allocatedAmount ?? 0));

  return {
    totalBudget,
    totalAllocated,
    totalSpent,
    totalAvailable: totalAllocated - totalSpent,
    utilizationRate: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
    departmentCount: departments.length,
    departmentAllocations,
  };
}

export function summarizeRevenue(sources: RevenueSource[]): RevenueSummary {
  const totalRevenue = sumOf(sources, (r) => r.revenueAmount);
  const totalTaxRevenue = sumOf(
    sources.filter((r) => r.category?.includes("Tax")),
    (r) => r.revenueAmount
  );
  const revenueBreakdown = REVENUE_CATEGORIES.map((category) => {
    const amount = sumOf(
      sources.filter((r) => r.category === category),
      (r) => r.revenueAmount
    );
    return { category, amount, percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0 };
  }).filter((item) => item.amount > 0);

  return {
    totalRevenue,
    totalTaxRevenue,
    totalNonTaxRevenue: totalRevenue - totalTaxRevenue,
    revenueBreakdown,
    topRevenueSources: [...sources]
      .sort((a, b) => (b.revenueAmount ?? 0) - (a.revenueAmount ?? 0))
      .slice(0, 5),
  };
}

export function buildDepartmentChartData(
  allocations: BudgetAllocation[],
  departments: GovernmentDepartment[]
): DepartmentChartItem[] {
  return allocations
    .map((allocation) => {
      const department = departments.find((d) => d.id === allocation.departmentId);
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
}

/** Allocated and spent per recorded budget year, oldest first. Revenue has no history, so no revenue line. */
export function buildTrendData(allocations: BudgetAllocation[]): BudgetTrendItem[] {
  const years = [...new Set(allocations.map((a) => a.budgetYear))].sort((a, b) => a - b);
  return years.map((year) => {
    const inYear = allocations.filter((a) => a.budgetYear === year);
    return {
      year: String(year),
      budget: sumOf(inYear, (a) => a.allocatedAmount),
      spent: sumOf(inYear, (a) => a.spentAmount),
    };
  });
}
