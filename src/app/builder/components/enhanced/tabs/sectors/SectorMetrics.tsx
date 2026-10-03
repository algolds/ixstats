"use client";

import React from "react";
import {
  Industry as Factory,
  Reports as PieChart,
  Group as Users,
  StatUp as TrendingUp,
} from "iconoir-react";
import { MetricCard } from "../../../../primitives/enhanced";
import type { SectorConfiguration } from "~/types/economy-builder";
import { calculateSectorTotals } from "../utils/sectorCalculations";
import type { SectorContribution } from "../utils/validation";

interface SectorMetricsProps {
  sectors: SectorConfiguration[];
  hasZeroContribution?: SectorContribution[];
}

export function SectorMetrics({ sectors, hasZeroContribution = [] }: SectorMetricsProps) {
  const { totalGDP, totalEmployment, averageProductivity } = calculateSectorTotals(sectors);

  const gdpValid = Math.abs(totalGDP - 100) < 1;
  const employmentValid = Math.abs(totalEmployment - 100) < 1;
  const zeroCount = hasZeroContribution.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-title-1">Economic sectors configuration</h2>
          <p className="text-label-secondary">
            Configure your economy's sector composition and characteristics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-label-secondary text-footnote mr-1">Status:</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-caption rounded-full border px-3 py-1 font-semibold ${
                gdpValid
                  ? "border-green/20 bg-green/10 text-green"
                  : "border-caution/20 bg-caution/10 text-caution"
              }`}
            >
              GDP: {(100 - totalGDP).toFixed(1)}% remaining
            </span>
            <span
              className={`text-caption rounded-full border px-3 py-1 font-semibold ${
                employmentValid
                  ? "border-green/20 bg-green/10 text-green"
                  : "border-caution/20 bg-caution/10 text-caution"
              }`}
            >
              Emp: {(100 - totalEmployment).toFixed(1)}% remaining
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="GDP distribution"
          value={totalGDP}
          unit="%"
          precision={1}
          icon={PieChart}
          sectionId="sectors"
          trend={gdpValid ? "up" : "down"}
          tooltip="Total gross domestic product contributed by active sectors. Must sum to 100%."
        />
        <MetricCard
          label="Employment distribution"
          value={totalEmployment}
          unit="%"
          precision={1}
          icon={Users}
          sectionId="sectors"
          trend={employmentValid ? "up" : "down"}
          tooltip="Total share of the active labor force employed across active sectors. Must sum to 100%."
        />
        <MetricCard
          label="Active sectors"
          value={`${sectors.length - zeroCount} / ${sectors.length}`}
          icon={Factory}
          sectionId="sectors"
          trend={zeroCount > 0 ? "down" : "neutral"}
          tooltip="Sectors that have non-zero contribution to GDP or Employment. A balanced economy typically has at least 3 active sectors."
        />
        <MetricCard
          label="Avg productivity"
          value={averageProductivity}
          precision={0}
          icon={TrendingUp}
          sectionId="sectors"
          trend="neutral"
          tooltip="Weighted average productivity index across all active sectors, reflecting automation, technology levels, and workforce efficiency."
        />
      </div>
    </div>
  );
}
