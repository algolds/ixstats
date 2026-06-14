"use client";

import React from "react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Button } from "~/components/ui/button";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Factory, PieChart, Users, TrendingUp, Target } from "lucide-react";
import { MetricCard } from "../../../../primitives/enhanced";
import type { SectorConfiguration } from "~/types/economy-builder";
import { calculateSectorTotals } from "../utils/sectorCalculations";
import type { SectorContribution } from "../utils/validation";

interface SectorMetricsProps {
  sectors: SectorConfiguration[];
  onNormalize: () => void;
  hasZeroContribution?: SectorContribution[];
}

export function SectorMetrics({
  sectors,
  // eslint-disable-next-line unused-imports/no-unused-vars
  onNormalize,
  hasZeroContribution = [],
}: SectorMetricsProps) {
  const { totalGDP, totalEmployment, averageProductivity } = calculateSectorTotals(sectors);

  const gdpValid = Math.abs(totalGDP - 100) < 1;
  const employmentValid = Math.abs(totalEmployment - 100) < 1;
  const zeroCount = hasZeroContribution.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Economic Sectors Configuration</h2>
          <p className="text-muted-foreground">
            Configure your economy's sector composition and characteristics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground mr-1 text-xs">Status:</span>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                gdpValid
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-400"
              }`}
            >
              GDP: {(100 - totalGDP).toFixed(1)}% remaining
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                employmentValid
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-400"
              }`}
            >
              Emp: {(100 - totalEmployment).toFixed(1)}% remaining
            </span>
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="GDP Distribution"
          value={`${totalGDP.toFixed(1)}%`}
          icon={PieChart}
          sectionId="sectors"
          trend={gdpValid ? "up" : "down"}
          texture="dots"
          textureOpacity={0.04}
          tooltip="Total gross domestic product contributed by active sectors. Must sum to 100%."
        />
        <MetricCard
          label="Employment Distribution"
          value={`${totalEmployment.toFixed(1)}%`}
          icon={Users}
          sectionId="sectors"
          trend={employmentValid ? "up" : "down"}
          texture="dots"
          textureOpacity={0.04}
          tooltip="Total share of the active labor force employed across active sectors. Must sum to 100%."
        />
        <MetricCard
          label="Active Sectors"
          value={`${sectors.length - zeroCount} / ${sectors.length}`}
          icon={Factory}
          sectionId="sectors"
          trend={zeroCount > 0 ? "down" : "neutral"}
          texture="dots"
          textureOpacity={0.04}
          tooltip="Sectors that have non-zero contribution to GDP or Employment. A balanced economy typically has at least 3 active sectors."
        />
        <MetricCard
          label="Avg Productivity"
          value={averageProductivity.toFixed(0)}
          icon={TrendingUp}
          sectionId="sectors"
          trend="neutral"
          texture="dots"
          textureOpacity={0.04}
          tooltip="Weighted average productivity index across all active sectors, reflecting automation, technology levels, and workforce efficiency."
        />
      </div>
    </div>
  );
}
