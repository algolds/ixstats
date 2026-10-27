export interface BudgetHealthStatus {
  status: "surplus" | "balanced" | "moderate" | "deficit" | "unknown";
  /** Semantic status classes for an outline `<Badge>` (border + text colour). */
  color: string;
  label: string;
}

/**
 * Revenue categories are one measure, so every bar shares the MyCountry accent; the axis label
 * names the category. Kept as an array so callers can index it by category.
 */
export const REVENUE_CHART_COLORS = ["var(--color-amber-500)"];

/** Revenue left after the allocations, as a percent of revenue; null without revenue. */
export function fiscalBalancePercent(totalRevenue: number, totalAllocated: number): number | null {
  return totalRevenue > 0 ? ((totalRevenue - totalAllocated) / totalRevenue) * 100 : null;
}

/**
 * Fiscal balance of the year's allocations against revenue. Nothing records spending yet, so the
 * allocations stand for it. Unknown when no revenue is recorded.
 */
export function getBudgetHealthStatus(
  totalRevenue: number,
  totalAllocated: number
): BudgetHealthStatus {
  const balancePercent = fiscalBalancePercent(totalRevenue, totalAllocated);
  if (balancePercent == null) {
    return { status: "unknown", color: "text-label-secondary", label: "No revenue recorded" };
  }

  if (balancePercent > 5) {
    return {
      status: "surplus",
      color: "border-green/30 text-green",
      label: "Surplus",
    };
  }
  if (balancePercent > -3) {
    return {
      status: "balanced",
      color: "text-label-secondary",
      label: "Balanced",
    };
  }
  if (balancePercent > -10) {
    return {
      status: "moderate",
      color: "border-yellow/30 text-yellow",
      label: "Moderate deficit",
    };
  }
  return {
    status: "deficit",
    color: "border-destructive/30 text-destructive",
    label: "High deficit",
  };
}

export interface DepartmentChartItem {
  name: string;
  /** Name and share of the total budget, e.g. "Education 18.0%". */
  label: string;
  allocated: number;
  color: string;
}

export interface RevenueChartItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

export interface BudgetTrendItem {
  year: string;
  budget: number;
}
