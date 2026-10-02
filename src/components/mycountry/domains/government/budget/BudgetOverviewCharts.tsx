"use client";

import React from "react";
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
import type { DepartmentChartItem, RevenueChartItem, BudgetTrendItem } from "./budgetTypes";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

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
      <Card className="space-y-3 p-4">
        <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <h4 className="text-label text-headline">
            {overviewChartMode === "allocation"
              ? "Budget allocation by department"
              : "Budget vs revenue trend"}
          </h4>
          <SegmentedControl
            aria-label="Chart"
            size="sm"
            options={[
              { value: "allocation", label: "Allocation" },
              { value: "trend", label: "Trend" },
            ]}
            value={overviewChartMode}
            onValueChange={(id) => setOverviewChartMode(id as "allocation" | "trend")}
          />
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
                  className="text-label-secondary text-footnote"
                />
                <YAxis stroke="currentColor" className="text-label-secondary text-footnote" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="var(--color-amber-500)"
                  name="Budget"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="spent"
                  stroke="var(--color-label-secondary)"
                  name="Spending"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-emerald-500)"
                  name="Revenue"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Revenue Sources Chart */}
      <Card className="space-y-3 p-4">
        <div className="border-separator border-b pb-3">
          <h4 className="text-label text-headline">Revenue sources</h4>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="name"
                stroke="currentColor"
                className="text-label-secondary text-footnote"
              />
              <YAxis stroke="currentColor" className="text-label-secondary text-footnote" />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {revenueChartData.map((entry, index) => (
                  <Cell key={`revenue-cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
