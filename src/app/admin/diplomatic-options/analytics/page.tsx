"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "~/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Tooltip,
} from "recharts";
import { api } from "~/trpc/react";
import { Loader2, TrendingUp, TrendingDown, BarChart3, PieChartIcon, Activity } from "lucide-react";

/**
 * Diplomatic Options Analytics Dashboard
 *
 * Admin-only dashboard providing comprehensive analytics on diplomatic option usage:
 * - Top 10 most popular options (bar chart)
 * - Least used options for deprecation candidates (table)
 * - Category distribution (pie chart)
 * - Usage trends over time (line chart)
 * - Summary statistics
 */
export default function DiplomaticOptionsAnalyticsPage() {
  const { data: stats, isLoading, error } = api.diplomatic.getOptionUsageStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground text-sm">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
            <CardDescription className="text-red-500">{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Prepare chart data
  const topOptionsChartData = stats.topOptions.map((opt) => ({
    name: opt.value.length > 30 ? opt.value.substring(0, 30) + "..." : opt.value,
    fullName: opt.value,
    count: opt.currentUsageCount,
    type: opt.type,
    category: opt.category || "Uncategorized",
  }));

  const categoryChartData = Object.entries(stats.categoryStats).map(([category, data]) => ({
    name: category,
    value: data.totalUsage,
    count: data.count,
  }));

  const typeChartData = Object.entries(stats.typeStats).map(([type, data]) => ({
    name: type
      .replace("_", " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    value: data.totalUsage,
    count: data.count,
  }));

  // Colors for charts
  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#6366f1",
    "#f97316",
    "#14b8a6",
    "#ef4444",
    "#a855f7",
  ];

  // Chart configs for Recharts
  const chartConfig = {
    count: { label: "Usage Count", color: "#3b82f6" },
    value: { label: "Total Usage", color: "#8b5cf6" },
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Diplomatic Options Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive usage analytics for diplomatic options across all embassies
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Options</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalOptions}</div>
            <p className="text-muted-foreground text-xs">
              {stats.summary.activeOptions} active, {stats.summary.inactiveOptions} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Options</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.activeOptions}</div>
            <p className="text-muted-foreground text-xs">Currently available for selection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.summary.totalCurrentUsage}</div>
            <p className="text-muted-foreground text-xs">Active selections across all embassies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Usage/Option</CardTitle>
            <PieChartIcon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.summary.totalCurrentUsage / stats.summary.activeOptions).toFixed(1)}
            </div>
            <p className="text-muted-foreground text-xs">Average selections per active option</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 10 Most Popular Options */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Top 10 Most Popular Options</CardTitle>
            <CardDescription>Options with the highest usage across all embassies</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={topOptionsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Category</CardTitle>
            <CardDescription>Distribution of option usage across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Type</CardTitle>
            <CardDescription>Distribution across option types</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={typeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trends Over Time */}
      {stats.usageTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends (Last 30 Days)</CardTitle>
            <CardDescription>Daily option selection activity</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={stats.usageTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Least Used Options Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-500" />
            Least Used Options (Deprecation Candidates)
          </CardTitle>
          <CardDescription>
            Options with the lowest usage - consider reviewing for relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left text-sm font-medium">Option</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">Usage Count</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.leastUsedOptions.map((option, index) => (
                  <tr key={option.id} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                    <td className="px-4 py-3 text-sm">{option.value}</td>
                    <td className="px-4 py-3 text-sm">
                      {option.type
                        .replace("_", " ")
                        .split(" ")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")}
                    </td>
                    <td className="px-4 py-3 text-sm">{option.category || "Uncategorized"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {option.currentUsageCount}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          option.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {option.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
