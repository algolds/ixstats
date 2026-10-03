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
import {
  SystemRestart as Loader2,
  Shield,
  Activity,
  StatUp as TrendingUp,
  WarningTriangle as AlertTriangle,
  Industry as Factory,
} from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

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
          <Loader2 className="text-red h-8 w-8 animate-spin" />
          <p className="text-label-secondary text-body">Loading military equipment analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="border-red/30 bg-red/10 flex w-full max-w-md flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Error Loading Analytics</CardTitle>
            <CardDescription className="text-red">{error.message}</CardDescription>
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

  // Categorical series colours (Facet chart-1…8)
  const COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-chart-6)",
    "var(--color-chart-7)",
    "var(--color-chart-8)",
  ];

  // Chart configs
  const chartConfig = {
    count: { label: "Equipment Count", color: "var(--color-chart-8)" },
    value: { label: "Total Items", color: "var(--color-chart-1)" },
    usage: { label: "Usage Count", color: "var(--color-chart-2)" },
    avgTechLevel: { label: "Avg Tech Level", color: "var(--color-chart-8)" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface rounded-row border-separator border p-6">
        <h2 className="text-title-1 text-red">Military Equipment Analytics</h2>
        <p className="text-label-secondary">
          Comprehensive usage analytics and statistics for military equipment catalog
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red/30 bg-red/10 flex flex-col gap-6 py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Total Equipment Items</CardTitle>
            <Shield className="text-label-secondary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-title-1 text-red">{totalEquipment}</div>
            <p className="text-label-secondary text-footnote">Across all categories and eras</p>
          </CardContent>
        </Card>

        <Card className="border-red/30 bg-red/10 flex flex-col gap-6 py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Active Equipment</CardTitle>
            <Activity className="text-label-secondary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-title-1 text-red">{activeEquipment}</div>
            <p className="text-label-secondary text-footnote">
              Currently available for procurement
            </p>
          </CardContent>
        </Card>

        <Card className="border-red/30 bg-red/10 flex flex-col gap-6 py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Total Manufacturers</CardTitle>
            <Factory className="text-label-secondary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-title-1 text-red">{totalManufacturers}</div>
            <p className="text-label-secondary text-footnote">Active equipment producers</p>
          </CardContent>
        </Card>

        <Card className="border-red/30 bg-red/10 flex flex-col gap-6 py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body font-medium">Average Tech Level</CardTitle>
            <TrendingUp className="text-label-secondary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-title-1 text-red">{avgTechLevel.toFixed(1)}</div>
            <p className="text-label-secondary text-footnote">Across all equipment (1-10 scale)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 10 Most Used Equipment */}
        <Card className="border-red/30 col-span-2 flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Top 10 Most Used Equipment</CardTitle>
            <CardDescription>Equipment with the highest procurement usage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={topEquipmentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-chart-8)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Equipment by Category */}
        <Card className="border-red/30 flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Equipment by Category</CardTitle>
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
                  fill="var(--color-chart-1)"
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
        <Card className="border-red/30 flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Equipment by Era</CardTitle>
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
                  fill="var(--color-chart-1)"
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
        <Card className="border-red/30 col-span-2 flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Equipment Count by Manufacturer (Top 10)</CardTitle>
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
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Technology Level Progression by Era */}
        <Card className="border-red/30 col-span-2 flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-red">Technology Level Progression by Era</CardTitle>
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
                  stroke="var(--color-chart-8)"
                  strokeWidth={3}
                  dot={{ fill: "var(--color-chart-8)", r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Least Used Equipment Table (Deprecation Candidates) */}
      <Card className="border-red/30 flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="text-red flex items-center gap-2">
            <AlertTriangle className="text-orange h-5 w-5" />
            Least Used Equipment (Deprecation Candidates)
          </CardTitle>
          <CardDescription>
            Equipment with usage count less than 5 - consider reviewing for relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deprecationCandidates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Equipment Name</TableHead>
                  <TableHead className="px-4">Category</TableHead>
                  <TableHead className="px-4">Era</TableHead>
                  <TableHead className="px-4">Manufacturer</TableHead>
                  <TableHead className="px-4 text-center">Tech Level</TableHead>
                  <TableHead className="px-4 text-right">Usage Count</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deprecationCandidates.map((equipment: any, index: number) => {
                  const manufacturerName = (equipment as any).manufacturer ?? "N/A";
                  const techLevel =
                    (equipment as any).technologyLevel ??
                    (equipment as any & { technologyTier?: number }).technologyTier ??
                    null;

                  return (
                    <TableRow key={equipment.id} className={index % 2 === 0 ? "bg-red/50" : ""}>
                      <TableCell className="text-body px-4 font-medium">{equipment.name}</TableCell>
                      <TableCell className="text-body px-4">
                        {equipment.category.charAt(0).toUpperCase() + equipment.category.slice(1)}
                      </TableCell>
                      <TableCell className="text-body px-4">
                        {equipment.era.toUpperCase().replace("-", " ")}
                      </TableCell>
                      <TableCell className="text-body px-4">{manufacturerName}</TableCell>
                      <TableCell className="text-body px-4 text-center">
                        {techLevel ?? "N/A"}
                      </TableCell>
                      <TableCell className="text-headline text-orange px-4 text-right">
                        {equipment.usageCount}
                      </TableCell>
                      <TableCell className="text-body px-4">
                        <span
                          className={`text-caption inline-flex rounded-full px-2 py-1 ${
                            equipment.isActive
                              ? "bg-green/10 text-green"
                              : "bg-surface-secondary text-label"
                          }`}
                        >
                          {equipment.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="text-green mb-4 h-12 w-12" />
              <p className="text-title-3 text-green">All Equipment Well-Utilized</p>
              <p className="text-label-secondary text-body">
                No equipment with usage count below 5
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
