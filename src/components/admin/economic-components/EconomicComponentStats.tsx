"use client";

import { Card } from "~/components/ui/card";

interface EconomicComponentStatsProps {
  stats: {
    totalComponents: number;
    activeComponents: number;
    totalUsage: number;
    totalSynergies?: number;
    totalTemplates?: number;
  } | undefined;
}

export function EconomicComponentStats({ stats }: EconomicComponentStatsProps) {
  if (!stats) return null;

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      <Card className="glass-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Components</p>
        <p className="text-foreground mt-2 text-3xl font-bold">{stats.totalComponents}</p>
      </Card>
      <Card className="glass-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Active Components</p>
        <p className="mt-2 text-3xl font-bold text-[--intel-gold]">
          {stats.activeComponents}
        </p>
      </Card>
      <Card className="glass-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Usage</p>
        <p className="mt-2 text-3xl font-bold text-blue-400">{stats.totalUsage}</p>
      </Card>
      <Card className="glass-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Synergies</p>
        <p className="mt-2 text-3xl font-bold text-green-400">{stats.totalSynergies || 0}</p>
      </Card>
      <Card className="glass-card-child p-4">
        <p className="text-sm text-[--intel-silver]">Total Templates</p>
        <p className="mt-2 text-3xl font-bold text-purple-400">{stats.totalTemplates || 0}</p>
      </Card>
    </div>
  );
}
