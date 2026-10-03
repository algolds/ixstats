"use client";

import { api } from "~/trpc/react";
import {
  AnalyticsError,
  AnalyticsSkeleton,
  DistributionPieCard,
  HorizontalBarCard,
  StatTiles,
} from "../../_components/UsageAnalytics";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-indigo)",
];

export function DiplomaticOptionsAnalyticsTab() {
  const { data: usageStats, isLoading, error } = api.diplomaticCore.getOptionUsageStats.useQuery();

  if (isLoading) return <AnalyticsSkeleton />;
  if (error || !usageStats) return <AnalyticsError subject="diplomatic options" />;

  const categoryChartData = Object.entries(usageStats.categoryStats).map(([name, stat]) => ({
    name,
    count: stat.count,
    usage: stat.totalUsage,
  }));

  return (
    <div className="space-y-5">
      <StatTiles
        stats={[
          ["Total options", usageStats.summary.totalOptions, "text-label"],
          ["Active options", usageStats.summary.activeOptions, "text-green"],
          ["Total usages", usageStats.summary.totalCurrentUsage, "text-teal"],
          ["Categories", categoryChartData.length, "text-purple"],
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HorizontalBarCard
          title="Top 10 Most Selected Diplomatic Options"
          data={usageStats.topOptions}
          labelKey="value"
          valueKey="currentUsageCount"
          fill="var(--color-chart-6)"
        />
        <DistributionPieCard
          title="Option distribution by category"
          data={categoryChartData}
          colors={COLORS}
        />
      </div>
    </div>
  );
}
