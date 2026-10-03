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
  "var(--color-chart-2)",
  "var(--color-chart-6)",
];

const titleCase = (text: string) =>
  text
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

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

  if (loadingUsage || loadingCompletion) return <AnalyticsSkeleton />;
  if (usageError || completionError || !usageStats || !completionStats) {
    return <AnalyticsError subject="diplomatic scenarios" />;
  }

  const topScenariosData = usageStats.byType
    .sort((a, b) => b._count.id - a._count.id)
    .slice(0, 10)
    .map((item) => ({
      name: titleCase(item.type),
      count: item._count.id,
      avgImpact: item._avg?.culturalImpact ?? 0,
      avgRisk: item._avg?.diplomaticRisk ?? 0,
    }));

  const statusChartData = usageStats.byStatus.map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    count: item._count.id,
  }));

  return (
    <div className="space-y-5">
      <StatTiles
        stats={[
          ["Total generations", usageStats.totalGenerations, "text-label"],
          ["Active scenarios", completionStats.active, "text-teal"],
          ["Completion rate", `${usageStats.completionRate}%`, "text-green"],
          ["Scenario types", usageStats.byType.length, "text-purple"],
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HorizontalBarCard
          title="Top generated scenarios by type"
          data={topScenariosData}
          labelKey="name"
          valueKey="count"
          fill="var(--color-chart-1)"
        />
        <DistributionPieCard
          title="Distribution by scenario status"
          data={statusChartData}
          colors={COLORS}
        />
      </div>
    </div>
  );
}
