import type {
  GovernmentDepartment,
  BudgetAllocation,
  RevenueSource,
  BudgetSummary,
  RevenueSummary,
} from "~/types/government";

export interface BudgetHealthStatus {
  status: "surplus" | "balanced" | "moderate" | "deficit";
  color: string;
  label: string;
}

export const REVENUE_CHART_COLORS = [
  "#34d399",
  "#38bdf8",
  "#fbbf24",
  "#c084fc",
  "#2dd4bf",
  "#f43f5e",
];

export function getBudgetHealthStatus(
  totalRevenue: number,
  totalSpent: number
): BudgetHealthStatus {
  const deficit = totalRevenue - totalSpent;
  const deficitPercent = totalRevenue > 0 ? (deficit / totalRevenue) * 100 : 0;

  if (deficitPercent > 5) {
    return {
      status: "surplus",
      color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono",
      label: "Surplus",
    };
  }
  if (deficitPercent > -3) {
    return {
      status: "balanced",
      color: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono",
      label: "Balanced",
    };
  }
  if (deficitPercent > -10) {
    return {
      status: "moderate",
      color: "bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono",
      label: "Moderate Deficit",
    };
  }
  return {
    status: "deficit",
    color: "bg-red-500/10 text-red-400 border border-red-500/30 font-mono",
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
