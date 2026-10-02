"use client";
// src/app/admin/diplomatic-scenarios/_components/DiplomaticScenariosAnalyticsTab.tsx
// Diplomatic Scenarios Usage & Completion Analytics Tab

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { api } from "~/trpc/react";
import { StatsReport as BarChart3, Reports as PieChartIcon } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

export function DiplomaticScenariosAnalyticsTab() {
  const {
    data: usageStats,
    isLoading: loadingUsage,
    error: usageError,
  } = api.diplomaticScenarios.getScenarioUsageStats.useQuery();

  const {
    data: completionStats,
    isLoading: loadingCompletion,
    error: completionError,
  } = api.diplomaticScenarios.getCompletionRates.useQuery({ timeRange: "month" });

  const isLoading = loadingUsage || loadingCompletion;
  const error = usageError || completionError;

  if (isLoading) {
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

  if (error || !usageStats || !completionStats) {
    return (
      <div className="rounded-card border-red/20 bg-red/5 border p-8 text-center">
        <p className="text-footnote text-red">Failed to load diplomatic scenarios analytics.</p>
      </div>
    );
  }

  const topScenariosData = usageStats.byType
    .sort((a, b) => b._count.id - a._count.id)
    .slice(0, 10)
    .map((item) => ({
      name: item.type
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      count: item._count.id,
      avgImpact: item._avg?.culturalImpact ?? 0,
      avgRisk: item._avg?.diplomaticRisk ?? 0,
    }));

  const statusChartData = usageStats.byStatus.map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    count: item._count.id,
  }));

  const COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-indigo)",
    "var(--color-chart-2)",
    "var(--color-chart-6)",
  ];

  return (
    <div className="space-y-5">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total Generations</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{usageStats.totalGenerations}</p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Active Scenarios</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">{completionStats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Completion Rate</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">{usageStats.completionRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Scenario Types</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">{usageStats.byType.length}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h3 className="text-label text-caption flex items-center gap-2">
            <BarChart3 className="text-teal h-4 w-4" />
            Top Generated Scenarios by Type
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={topScenariosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" stroke="currentColor" className="text-footnote" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  stroke="currentColor"
                  className="text-footnote"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h3 className="text-label text-caption flex items-center gap-2">
            <PieChartIcon className="text-purple h-4 w-4" />
            Distribution by Scenario Status
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <PieChart>
                <Pie
                  data={statusChartData}
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
                  {statusChartData.map((_entry, index: number) => (
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

export default DiplomaticScenariosAnalyticsTab;
