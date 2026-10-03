"use client";

// src/components/admin/equipment/AnalyticsTab.tsx
// Military equipment analytics: summary cards, charts, and deprecation candidates table.

import type { ReactElement } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
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

const COLORS = Array.from({ length: 8 }, (_, i) => `var(--color-chart-${i + 1})`);

const chartConfig = {
  count: { label: "Equipment count", color: "var(--color-chart-8)" },
  value: { label: "Total items", color: "var(--color-chart-1)" },
  usage: { label: "Usage count", color: "var(--color-chart-2)" },
  avgTechLevel: { label: "Avg tech level", color: "var(--color-chart-8)" },
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const eraLabel = (era: string) => era.toUpperCase().replace("-", " ");

function StatCard({
  title,
  icon: Icon,
  value,
  caption,
}: {
  title: string;
  icon: typeof Shield;
  value: string | number;
  caption: string;
}) {
  return (
    <Card className="border-red/30 bg-red/10 flex flex-col gap-6 py-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-body font-medium">{title}</CardTitle>
        <Icon className="text-label-secondary h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-title-1 text-red">{value}</div>
        <p className="text-label-secondary text-footnote">{caption}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  height,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  height: number;
  wide?: boolean;
  children: ReactElement;
}) {
  return (
    <Card className={cn("border-red/30 flex flex-col gap-6 py-6", wide && "col-span-2")}>
      <CardHeader>
        <CardTitle className="text-red">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function DistributionPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ name, percent }: { name?: string; percent?: number }) =>
          `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
        }
        outerRadius={80}
        fill="var(--color-chart-1)"
        dataKey="value"
      >
        {data.map((_, index) => (
          <Cell key={index} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <ChartTooltip content={<ChartTooltipContent />} />
    </PieChart>
  );
}

function CountBarChart({
  data,
  fill,
  labelHeight,
}: {
  data: unknown[];
  fill: string;
  labelHeight: number;
}) {
  return (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" angle={-45} textAnchor="end" height={labelHeight} />
      <YAxis />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="count" fill={fill} radius={[8, 8, 0, 0]} />
    </BarChart>
  );
}

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
            <CardTitle className="text-red">Error loading analytics</CardTitle>
            <CardDescription className="text-red">{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!usageStats || !manufacturerStats || !allEquipment) {
    return null;
  }

  const manufacturerCountries = new Map<string, string>(
    (manufacturerStats.manufacturers ?? []).map((m: any) => [m.name, m.country])
  );
  const truncate = (text: string, max: number) =>
    text.length > max ? `${text.substring(0, max)}...` : text;

  const topEquipmentChartData = (usageStats.topEquipment ?? []).map((eq: any) => ({
    name: truncate(eq.name, 30),
    fullName: eq.name,
    count: eq.usageCount,
    category: eq.category,
    manufacturer: eq.manufacturer ?? "Unknown",
  }));
  const categoryChartData = (usageStats.byCategory ?? []).map((cat: any) => ({
    name: capitalize(cat.category),
    value: cat._count.id,
    usage: cat._sum.usageCount || 0,
  }));
  const eraChartData = (usageStats.byEra ?? []).map((era: any) => ({
    name: eraLabel(era.era),
    value: era._count.id,
    usage: era._sum.usageCount || 0,
  }));
  const manufacturerChartData = (usageStats.byManufacturer ?? []).slice(0, 10).map((mfr: any) => ({
    name: truncate(mfr.manufacturerName, 25),
    fullName: mfr.manufacturerName,
    count: mfr.equipmentCount,
    usage: mfr.totalUsage,
    country: manufacturerCountries.get(mfr.manufacturerName) ?? "Unknown",
  }));

  const averageTechLevel = (items: any[]) =>
    items.length > 0
      ? items.reduce((sum: number, eq: any) => sum + (eq.technologyLevel ?? 0), 0) / items.length
      : 0;
  const totalEquipment = allEquipment.length;
  const activeEquipment = allEquipment.filter((eq: any) => eq.isActive).length;
  const avgTechLevel = averageTechLevel(allEquipment);

  const techProgressionData = ["wwi", "wwii", "cold-war", "modern", "future"]
    .map((era) => {
      const eraEquipment = allEquipment.filter((eq: any) => eq.era === era);
      return {
        era: eraLabel(era),
        avgTechLevel: Math.round(averageTechLevel(eraEquipment) * 10) / 10,
        count: eraEquipment.length,
      };
    })
    .filter((item) => item.count > 0);

  const deprecationCandidates = allEquipment
    .filter((eq: any) => eq.isActive && eq.usageCount < 5)
    .sort((a: any, b: any) => a.usageCount - b.usageCount)
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface rounded-row border-separator border p-6">
        <h2 className="text-title-1 text-red">Military equipment analytics</h2>
        <p className="text-label-secondary">Usage statistics for the military equipment catalog</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total equipment items"
          icon={Shield}
          value={totalEquipment}
          caption="Across all categories and eras"
        />
        <StatCard
          title="Active equipment"
          icon={Activity}
          value={activeEquipment}
          caption="Currently available for procurement"
        />
        <StatCard
          title="Total manufacturers"
          icon={Factory}
          value={manufacturerStats.totalManufacturers}
          caption="Active equipment producers"
        />
        <StatCard
          title="Average tech level"
          icon={TrendingUp}
          value={avgTechLevel.toFixed(1)}
          caption="Across all equipment (1-10 scale)"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard
          title="Top 10 Most Used Equipment"
          description="Equipment with the highest procurement usage"
          height={400}
          wide
        >
          <CountBarChart
            data={topEquipmentChartData}
            fill="var(--color-chart-8)"
            labelHeight={120}
          />
        </ChartCard>

        <ChartCard
          title="Equipment by category"
          description="Distribution across equipment categories"
          height={300}
        >
          <DistributionPie data={categoryChartData} />
        </ChartCard>

        <ChartCard
          title="Equipment by era"
          description="Distribution across historical eras"
          height={300}
        >
          <DistributionPie data={eraChartData} />
        </ChartCard>

        <ChartCard
          title="Equipment Count by Manufacturer (Top 10)"
          description="Manufacturers with the most equipment items in catalog"
          height={350}
          wide
        >
          <CountBarChart
            data={manufacturerChartData}
            fill="var(--color-chart-1)"
            labelHeight={100}
          />
        </ChartCard>

        <ChartCard
          title="Technology level progression by era"
          description="Average technology tier across historical eras"
          height={300}
          wide
        >
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
        </ChartCard>
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
                  <TableHead className="px-4">Equipment name</TableHead>
                  <TableHead className="px-4">Category</TableHead>
                  <TableHead className="px-4">Era</TableHead>
                  <TableHead className="px-4">Manufacturer</TableHead>
                  <TableHead className="px-4 text-center">Tech level</TableHead>
                  <TableHead className="px-4 text-right">Usage count</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deprecationCandidates.map((equipment: any, index: number) => {
                  const techLevel = equipment.technologyLevel ?? equipment.technologyTier ?? null;

                  return (
                    <TableRow key={equipment.id} className={index % 2 === 0 ? "bg-red/50" : ""}>
                      <TableCell className="text-body px-4 font-medium">{equipment.name}</TableCell>
                      <TableCell className="text-body px-4">
                        {capitalize(equipment.category)}
                      </TableCell>
                      <TableCell className="text-body px-4">{eraLabel(equipment.era)}</TableCell>
                      <TableCell className="text-body px-4">
                        {equipment.manufacturer ?? "N/A"}
                      </TableCell>
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
