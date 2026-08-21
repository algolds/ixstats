"use client";

import { Card } from "~/components/ui/card";

interface GovernmentComponentStatsProps {
  stats: {
    totalComponents: number;
    activeComponents: number;
    totalUsage: number;
    totalSynergies?: number;
  } | undefined;
}

export function GovernmentComponentStats({ stats }: GovernmentComponentStatsProps) {
  if (!stats) return null;

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
    </div>
  );
}
