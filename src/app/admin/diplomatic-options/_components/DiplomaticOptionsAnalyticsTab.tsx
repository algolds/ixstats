"use client";
// src/app/admin/diplomatic-options/_components/DiplomaticOptionsAnalyticsTab.tsx
// Diplomatic Options Usage & Popularity Analytics Tab

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { api } from "~/trpc/react";
import { StatsReport as BarChart3, Reports as PieChartIcon } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

export function DiplomaticOptionsAnalyticsTab() {
  const {
    data: usageStats,
    isLoading: loadingUsage,
    error: usageError,
  } = api.diplomaticCore.getOptionUsageStats.useQuery();

  if (loadingUsage) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="rounded-card h-80" />
          <Skeleton className="rounded-card h-80" />
        </div>
      </div>
    );
  }

  if (usageError || !usageStats) {
    return (
      <div className="rounded-card border-red/20 bg-red/5 border p-8 text-center">
        <p className="text-footnote text-red">Failed to load diplomatic options analytics.</p>
      </div>
    );
  }

  const categoryChartData = Object.entries(usageStats.categoryStats).map(([name, stat]) => ({
    name,
    count: stat.count,
    usage: stat.totalUsage,
  }));

  const _typeChartData = Object.entries(usageStats.typeStats).map(([type, stat]) => ({
    name: type
      .replace(/_/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    count: stat.count,
    usage: stat.totalUsage,
  }));

  const COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-indigo)",
  ];

  return (
    <div className="space-y-5">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total Options</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">
            {usageStats.summary.totalOptions}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Active Options</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {usageStats.summary.activeOptions}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total Usages</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">
            {usageStats.summary.totalCurrentUsage}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Categories</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">
            {Object.keys(usageStats.categoryStats).length}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h3 className="text-label text-caption flex items-center gap-2">
            <BarChart3 className="text-teal h-4 w-4" />
            Top 10 Most Selected Diplomatic Options
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={usageStats.topOptions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" stroke="currentColor" className="text-footnote" />
                <YAxis
                  dataKey="value"
                  type="category"
                  width={140}
                  stroke="currentColor"
                  className="text-footnote"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="currentUsageCount"
                  fill="var(--color-chart-6)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h3 className="text-label text-caption flex items-center gap-2">
            <PieChartIcon className="text-purple h-4 w-4" />
            Option Distribution by Category
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { name?: string; percent?: number }) =>
                    `${entry.name ?? ""} (${((entry.percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="var(--color-chart-1)"
                  dataKey="count"
                >
                  {categoryChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default DiplomaticOptionsAnalyticsTab;
