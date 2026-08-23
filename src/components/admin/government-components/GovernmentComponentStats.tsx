"use client";

import { Card } from "~/components/ui/card";

export interface GovernmentComponentStatsProps {
  stats?: {
    totalComponents?: number;
    activeComponents?: number;
    totalUsage?: number;
    totalSynergies?: number;
    summary?: {
      total: number;
      active: number;
      totalUsage: number;
      avgUsage: number;
    };
    synergyStats?: {
      totalSynergies: number;
    };
  } | any;
}

export function GovernmentComponentStats({ stats }: GovernmentComponentStatsProps) {
  if (!stats) return null;

  const totalComponents = stats.summary?.total ?? stats.totalComponents ?? 0;
  const activeComponents = stats.summary?.active ?? stats.activeComponents ?? 0;
  const totalUsage = stats.summary?.totalUsage ?? stats.totalUsage ?? 0;
  const totalSynergies = stats.synergyStats?.totalSynergies ?? stats.totalSynergies ?? 0;

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card className="facet-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Components</p>
        <p className="text-foreground mt-2 text-3xl font-bold">{totalComponents}</p>
      </Card>
      <Card className="facet-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Active Components</p>
        <p className="mt-2 text-3xl font-bold text-[--intel-gold]">
          {activeComponents}
        </p>
      </Card>
      <Card className="facet-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Usage</p>
        <p className="mt-2 text-3xl font-bold text-blue-400">{totalUsage}</p>
      </Card>
      <Card className="facet-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Synergies</p>
        <p className="mt-2 text-3xl font-bold text-green-400">{totalSynergies}</p>
      </Card>
    </div>
  );
}
