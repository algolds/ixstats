"use client";

// src/components/admin/equipment/AnalyticsTab.tsx
// Military equipment analytics: summary cards, charts, and deprecation candidates table.

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Loader2, Shield, Activity, TrendingUp, AlertTriangle, Factory } from "lucide-react";

interface AnalyticsTabProps {
  usageStats: any;
  manufacturerStats: any;
  allEquipment: any;
  isLoading: boolean;
  error: any;
}

export function AnalyticsTab({
  usageStats,
  manufacturerStats,
  allEquipment,
  isLoading,
  error,
}: AnalyticsTabProps) {
  // useMemo must be called unconditionally before any early returns
  const manufacturerLookup = useMemo(
    () =>
      new Map<string, any>((manufacturerStats?.manufacturers ?? []).map((m: any) => [m.name, m])),
    [manufacturerStats?.manufacturers]
  );

  // Chart data transforms — memoized and hoisted above the early returns so they are
  // not recomputed on every filter/tab change (and to keep hook order stable). (audit F4)
  const topEquipmentChartData = useMemo(
    () =>
      (usageStats?.topEquipment ?? []).map((eq: any) => ({
        name: eq.name.length > 30 ? eq.name.substring(0, 30) + "..." : eq.name,
        fullName: eq.name,
        count: eq.usageCount,
        category: eq.category,
        manufacturer: eq.manufacturer ?? "Unknown",
      })),
    [usageStats?.topEquipment]
  );

  const categoryChartData = useMemo(
    () =>
      (usageStats?.byCategory ?? []).map((cat: any) => ({
        name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
        value: cat._count.id,
        usage: cat._sum.usageCount || 0,
      })),
    [usageStats?.byCategory]
  );

  const eraChartData = useMemo(
    () =>
      (usageStats?.byEra ?? []).map((era: any) => ({
        name: era.era.toUpperCase().replace("-", " "),
        value: era._count.id,
        usage: era._sum.usageCount || 0,
      })),
    [usageStats?.byEra]
  );

  const manufacturerChartData = useMemo(
    () =>
      (usageStats?.byManufacturer ?? []).slice(0, 10).map((mfr: any) => {
        const details = manufacturerLookup.get(mfr.manufacturerName);
        const displayName =
          mfr.manufacturerName.length > 25
            ? mfr.manufacturerName.substring(0, 25) + "..."
            : mfr.manufacturerName;

        return {
          name: displayName,
          fullName: mfr.manufacturerName,
          count: mfr.equipmentCount,
          usage: mfr.totalUsage,
          country: details?.country ?? "Unknown",
        };
      }),
    [usageStats?.byManufacturer, manufacturerLookup]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-muted-foreground text-sm">Loading military equipment analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
            <CardDescription className="text-red-500">{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!usageStats || !manufacturerStats || !allEquipment) {
    return null;
  }

  // Calculate summary statistics
  const totalEquipment = allEquipment.length;
  const activeEquipment = allEquipment.filter((eq: any) => eq.isActive).length;
  const totalManufacturers = manufacturerStats.totalManufacturers;
  const avgTechLevel =
    totalEquipment > 0
      ? allEquipment.reduce((sum: number, eq: any) => sum + (eq.technologyLevel ?? 0), 0) /
        totalEquipment
      : 0;

  // Technology level progression by era
  const eraOrder = ["wwi", "wwii", "cold-war", "modern", "future"];
  const techProgressionData = eraOrder
    .map((era) => {
      const eraEquipment = allEquipment.filter((eq: any) => eq.era === era);
      const avgTech =
        eraEquipment.length > 0
          ? eraEquipment.reduce((sum: number, eq: any) => sum + (eq.technologyLevel ?? 0), 0) /
            eraEquipment.length
          : 0;
      return {
        era: era.toUpperCase().replace("-", " "),
        avgTechLevel: Math.round(avgTech * 10) / 10,
        count: eraEquipment.length,
      };
    })
    .filter((item) => item.count > 0);

  // Deprecation candidates (usageCount < 5)
  const deprecationCandidates = allEquipment
    .filter((eq: any) => eq.isActive && eq.usageCount < 5)
    .sort((a: any, b: any) => a.usageCount - b.usageCount)
    .slice(0, 20);

  // Colors for charts (red theme)
  const COLORS = [
    "#ef4444",
    "#dc2626",
    "#f87171",
    "#fca5a5",
    "#fee2e2",
    "#b91c1c",
    "#991b1b",
    "#7f1d1d",
    "#fecaca",
    "#fb923c",
  ];

  // Chart configs
  const chartConfig = {
    count: { label: "Equipment Count", color: "#ef4444" },
    value: { label: "Total Items", color: "#dc2626" },
    usage: { label: "Usage Count", color: "#f87171" },
    avgTechLevel: { label: "Avg Tech Level", color: "#ef4444" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card-parent rounded-xl border border-white/10 p-6">
        <h2 className="text-2xl font-bold tracking-tight text-red-600">
          Military Equipment Analytics
        </h2>
        <p className="text-muted-foreground">
          Comprehensive usage analytics and statistics for military equipment catalog
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment Items</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalEquipment}</div>
            <p className="text-muted-foreground text-xs">Across all categories and eras</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Equipment</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeEquipment}</div>
            <p className="text-muted-foreground text-xs">Currently available for procurement</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Manufacturers</CardTitle>
            <Factory className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalManufacturers}</div>
            <p className="text-muted-foreground text-xs">Active equipment producers</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Tech Level</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{avgTechLevel.toFixed(1)}</div>
            <p className="text-muted-foreground text-xs">Across all equipment (1-10 scale)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 10 Most Used Equipment */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Top 10 Most Used Equipment</CardTitle>
            <CardDescription>Equipment with the highest procurement usage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={topEquipmentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment by Category */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment by Category</CardTitle>
            <CardDescription>Distribution across equipment categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) =>
                    `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment by Era */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment by Era</CardTitle>
            <CardDescription>Distribution across historical eras</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={eraChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) =>
                    `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {eraChartData.map((entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment Count by Manufacturer */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Equipment Count by Manufacturer (Top 10)</CardTitle>
            <CardDescription>
              Manufacturers with the most equipment items in catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={manufacturerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Technology Level Progression by Era */}
        <Card className="col-span-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Technology Level Progression by Era</CardTitle>
            <CardDescription>Average technology tier across historical eras</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={techProgressionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="era" />
                <YAxis domain={[0, 10]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="avgTechLevel"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: "#ef4444", r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Least Used Equipment Table (Deprecation Candidates) */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Least Used Equipment (Deprecation Candidates)
          </CardTitle>
          <CardDescription>
            Equipment with usage count less than 5 - consider reviewing for relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deprecationCandidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="px-4 py-2 text-left text-sm font-medium">Equipment Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Category</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Era</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Manufacturer</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">Tech Level</th>
                    <th className="px-4 py-2 text-right text-sm font-medium">Usage Count</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deprecationCandidates.map((equipment: any, index: number) => {
                    const manufacturerName = (equipment as any).manufacturer ?? "N/A";
                    const techLevel =
                      (equipment as any).technologyLevel ??
                      (equipment as any & { technologyTier?: number }).technologyTier ??
                      null;

                    return (
                      <tr key={equipment.id} className={index % 2 === 0 ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-3 text-sm font-medium">{equipment.name}</td>
                        <td className="px-4 py-3 text-sm">
                          {equipment.category.charAt(0).toUpperCase() + equipment.category.slice(1)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {equipment.era.toUpperCase().replace("-", " ")}
                        </td>
                        <td className="px-4 py-3 text-sm">{manufacturerName}</td>
                        <td className="px-4 py-3 text-center font-mono text-sm">
                          {techLevel ?? "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-orange-600">
                          {equipment.usageCount}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              equipment.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {equipment.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="mb-4 h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-green-600">All Equipment Well-Utilized</p>
              <p className="text-muted-foreground text-sm">No equipment with usage count below 5</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
