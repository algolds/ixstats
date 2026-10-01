import type {
  GovernmentDepartment,
  BudgetAllocation,
  RevenueSource,
  BudgetSummary,
  RevenueSummary,
} from "~/types/government";

export interface BudgetHealthStatus {
  status: "surplus" | "balanced" | "moderate" | "deficit";
  /** Semantic status classes for an outline `<Badge>` (border + text colour). */
  color: string;
  label: string;
}

/**
 * Revenue categories are one measure, so every bar shares the MyCountry accent; the axis label
 * names the category. Kept as an array so callers can index it by category.
 */
export const REVENUE_CHART_COLORS = ["var(--color-amber-500)"];

export function getBudgetHealthStatus(
  totalRevenue: number,
  totalSpent: number
): BudgetHealthStatus {
  const deficit = totalRevenue - totalSpent;
  const deficitPercent = totalRevenue > 0 ? (deficit / totalRevenue) * 100 : 0;

  if (deficitPercent > 5) {
    return {
      status: "surplus",
      color: "border-green/30 text-green",
      label: "Surplus",
    };
  }
  if (deficitPercent > -3) {
    return {
      status: "balanced",
      color: "text-label-secondary",
      label: "Balanced",
    };
  }
  if (deficitPercent > -10) {
    return {
      status: "moderate",
      color: "border-yellow/30 text-yellow",
      label: "Moderate Deficit",
    };
  }
  return {
    status: "deficit",
    color: "border-destructive/30 text-destructive",
    label: "High Deficit",
  };
}

export interface DepartmentChartItem {
  name: string;
  allocated: number;
  spent: number;
  available: number;
  percent: number;
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
  spent: number;
  revenue: number;
}
