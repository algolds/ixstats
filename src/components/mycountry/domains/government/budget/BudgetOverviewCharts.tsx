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
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { DepartmentChartItem, RevenueChartItem, BudgetTrendItem } from "./budgetTypes";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";
import { FACET_AXIS_TICK, FacetChartTooltip } from "~/components/ui/chart";

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
              : "Budget by year"}
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
          {overviewChartMode === "allocation" && departmentChartData.length === 0 ? (
            <p className="text-label-secondary text-footnote flex h-full items-center justify-center text-center">
              No department has an allocation this year. Set each department's share under
              Departments.
            </p>
          ) : overviewChartMode === "trend" && budgetTrendData.length < 2 ? (
            <p className="text-label-secondary text-footnote flex h-full items-center justify-center text-center">
              The trend appears once budgets are recorded for two or more years.
            </p>
          ) : overviewChartMode === "allocation" ? (
            <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="none"
                      dataKey="allocated"
                      nameKey="name"
                    >
                      {departmentChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <FacetChartTooltip
                          hideLabel
                          valueFormatter={(value) => formatCurrency(value)}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="divide-separator/60 max-h-full w-full flex-1 divide-y overflow-y-auto pr-1">
                {departmentChartData.map((entry) => {
                  const pct = entry.label.slice(entry.name.length).trim();
                  return (
                    <li
                      key={entry.name}
                      className="text-footnote flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-label truncate">{entry.name}</span>
                      </span>
                      <span className="text-label-secondary shrink-0 tabular-nums">
                        <span className="text-label font-medium">{pct}</span> ·{" "}
                        {formatCurrency(entry.allocated)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={budgetTrendData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--color-separator)"
                />
                <XAxis
                  dataKey="year"
                  axisLine={false}
                  tickLine={false}
                  tick={FACET_AXIS_TICK}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={FACET_AXIS_TICK}
                  width={72}
                  tickFormatter={(value: number) => formatCurrency(value)}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-separator)", strokeWidth: 1 }}
                  content={
                    <FacetChartTooltip valueFormatter={(value) => formatCurrency(value)} />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="var(--color-chart-1)"
                  name="Allocated"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-chart-1)", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="border-separator border-b pb-3">
          <h4 className="text-label text-headline">Revenue sources</h4>
        </div>
        <div className="h-72">
          {revenueChartData.length === 0 ? (
            <p className="text-label-secondary text-footnote flex h-full items-center justify-center text-center">
              No revenue sources are recorded for this government yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--color-separator)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={FACET_AXIS_TICK}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={FACET_AXIS_TICK}
                  width={72}
                  tickFormatter={(value: number) => formatCurrency(value)}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-fill-4)" }}
                  content={
                    <FacetChartTooltip valueFormatter={(value) => formatCurrency(value)} />
                  }
                />
                <Bar dataKey="value" name="Revenue" radius={[6, 6, 0, 0]}>
                  {revenueChartData.map((entry, index) => (
                    <Cell key={`revenue-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
