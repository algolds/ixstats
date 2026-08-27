// src/app/admin/diplomatic-options/_components/DiplomaticOptionsAnalyticsTab.tsx
// Diplomatic Options Usage & Popularity Analytics Tab
"use client";

import React from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { api } from "~/trpc/react";
import { StatsReport as BarChart3, Reports as PieChartIcon } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";

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

  if (usageError || !usageStats) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center backdrop-blur-md">
        <p className="text-xs text-red-400">Failed to load diplomatic options analytics.</p>
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

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

  return (
    <div className="space-y-5">
      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Options
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {usageStats.summary.totalOptions}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Options
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {usageStats.summary.activeOptions}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Usages
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {usageStats.summary.totalCurrentUsage}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Categories
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
            {Object.keys(usageStats.categoryStats).length}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <h3 className="text-foreground flex items-center gap-2 text-xs font-bold">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            Top 10 Most Selected Diplomatic Options
          </h3>
          <div className="h-72">
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={usageStats.topOptions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" stroke="currentColor" className="text-xs" />
                <YAxis
                  dataKey="value"
                  type="category"
                  width={140}
                  stroke="currentColor"
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="currentUsageCount" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <h3 className="text-foreground flex items-center gap-2 text-xs font-bold">
            <PieChartIcon className="h-4 w-4 text-purple-400" />
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
                  fill="#8884d8"
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
        </div>
      </div>
    </div>
  );
}

export default DiplomaticOptionsAnalyticsTab;
