"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
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
import type {
  DepartmentChartItem,
  RevenueChartItem,
  BudgetTrendItem,
} from "./budgetTypes";

interface BudgetOverviewChartsProps {
  overviewChartMode: "allocation" | "trend";
  setOverviewChartMode: (mode: "allocation" | "trend") => void;
  departmentChartData: DepartmentChartItem[];
  budgetTrendData: BudgetTrendItem[];
  revenueChartData: RevenueChartItem[];
  formatCurrency: (amount: number) => string;
}

export function BudgetOverviewCharts({
  overviewChartMode,
  setOverviewChartMode,
  departmentChartData,
  budgetTrendData,
  revenueChartData,
  formatCurrency,
}: BudgetOverviewChartsProps) {
  return (
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
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                >
                  {departmentChartData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
  );
}
