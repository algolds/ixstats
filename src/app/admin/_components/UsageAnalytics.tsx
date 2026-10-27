"use client";

import type { ReactNode } from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { StatsReport as BarChart3, Reports as PieChartIcon } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

export function AnalyticsSkeleton() {
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

export function AnalyticsError({ subject }: { subject: string }) {
  return (
    <div className="rounded-card border-red/20 bg-red/5 border p-8 text-center">
      <p className="text-footnote text-red">Failed to load {subject} analytics.</p>
    </div>
  );
}

/** The row of four headline numbers: `[label, value, value colour class]`. */
export function StatTiles({ stats }: { stats: ReadonlyArray<[string, ReactNode, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(([label, value, tone]) => (
        <Card key={label} className="p-4">
          <p className="text-label-secondary text-stat-label">{label}</p>
          <p className={`text-title-2 mt-1 tabular-nums ${tone}`}>{value}</p>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: React.ReactElement;
}) {
  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-label text-caption flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="h-72">
        <ChartContainer config={{}} className="h-full w-full">
          {children}
        </ChartContainer>
      </div>
    </Card>
  );
}

export function HorizontalBarCard({
  title,
  data,
  labelKey,
  valueKey,
  fill,
}: {
  title: string;
  data: unknown[];
  labelKey: string;
  valueKey: string;
  fill: string;
}) {
  return (
    <ChartCard icon={<BarChart3 className="text-teal h-4 w-4" />} title={title}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis type="number" stroke="currentColor" className="text-footnote" />
        <YAxis
          dataKey={labelKey}
          type="category"
          width={140}
          stroke="currentColor"
          className="text-footnote"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey={valueKey} fill={fill} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  );
}

export function DistributionPieCard({
  title,
  data,
  colors,
}: {
  title: string;
  data: Array<{ name: string; count: number }>;
  colors: readonly string[];
}) {
  return (
    <ChartCard icon={<PieChartIcon className="text-purple h-4 w-4" />} title={title}>
      <PieChart>
        <Pie
          data={data}
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
          {data.map((_entry, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
      </PieChart>
    </ChartCard>
  );
}
