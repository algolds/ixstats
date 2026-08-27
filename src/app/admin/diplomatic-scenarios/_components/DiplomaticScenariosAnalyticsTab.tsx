// src/app/admin/diplomatic-scenarios/_components/DiplomaticScenariosAnalyticsTab.tsx
// Diplomatic Scenarios Usage & Completion Analytics Tab
"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { api } from "~/trpc/react";
import { StatsReport as BarChart3, Reports as PieChartIcon } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";

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
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !usageStats || !completionStats) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center backdrop-blur-md">
        <p className="text-xs text-red-400">Failed to load diplomatic scenarios analytics.</p>
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
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#6366f1",
    "#f97316",
    "#14b8a6",
  ];

  return (
    <div className="space-y-5">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Generations
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {usageStats.totalGenerations}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Scenarios
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {completionStats.active}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Completion Rate
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {usageStats.completionRate}%
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Scenario Types
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
            {usageStats.byType.length}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <h3 className="text-foreground flex items-center gap-2 text-xs font-bold">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            Top Generated Scenarios by Type
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={topScenariosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" stroke="currentColor" className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  stroke="currentColor"
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <h3 className="text-foreground flex items-center gap-2 text-xs font-bold">
            <PieChartIcon className="h-4 w-4 text-purple-400" />
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
                  fill="#8884d8"
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
        </div>
      </div>
    </div>
  );
}

export default DiplomaticScenariosAnalyticsTab;
