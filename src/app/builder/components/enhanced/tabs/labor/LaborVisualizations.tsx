"use client";

import React from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import { PieChart, BarChart3, Shield, Gauge } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";

interface LaborVisualizationsProps {
  laborMarket: LaborConfiguration;
  employmentTypeData: Array<{ name: string; value: number; color: string }>;
  sectorDistributionData: Array<{ name: string; value: number; color: string }>;
  workerProtectionsData: Array<{ name: string; value: number; color: string }>;
}

export function LaborVisualizations({
  laborMarket,
  employmentTypeData,
  sectorDistributionData,
  workerProtectionsData,
}: LaborVisualizationsProps) {
  return (
    <div className="space-y-6">
      <GlassCard depth="base" theme="emerald" className="border-emerald-500/20" texture="chevron" textureOpacity={0.04}>
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <PieChart className="h-5 w-5" />
            <span>Employment Type Distribution</span>
          </h4>
          <GlassPieChart
            data={employmentTypeData}
            dataKey="value"
            nameKey="name"
            height={300}
            colors={DEFAULT_CHART_COLORS}
          />
        </GlassCardContent>
      </GlassCard>

      <GlassCard depth="base" theme="emerald" className="border-emerald-500/20" texture="chevron" textureOpacity={0.04}>
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <BarChart3 className="h-5 w-5" />
            <span>Employment by Sector</span>
          </h4>
          <GlassBarChart
            data={sectorDistributionData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </GlassCardContent>
      </GlassCard>

      <GlassCard depth="base" theme="emerald" className="border-emerald-500/20" texture="chevron" textureOpacity={0.04}>
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Shield className="h-5 w-5" />
            <span>Worker Protection Scores</span>
          </h4>
          <GlassBarChart
            data={workerProtectionsData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(0)}`}
          />
        </GlassCardContent>
      </GlassCard>

      <GlassCard depth="base" theme="emerald" className="border-emerald-500/20" texture="chevron" textureOpacity={0.04}>
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Gauge className="h-5 w-5" />
            <span>Labor Market Health</span>
          </h4>
          <div className="space-y-4">
            {[
              { label: "Employment Rate", value: laborMarket.employmentRate },
              {
                label: "Labor Force Participation",
                value: laborMarket.laborForceParticipationRate,
              },
              { label: "Workplace Safety", value: laborMarket.workplaceSafetyIndex },
              { label: "Labor Rights Score", value: laborMarket.laborRightsScore },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-medium">
                    {value.toFixed(label.includes("Score") || label.includes("Safety") ? 0 : 1)}
                    {!label.includes("Score") && !label.includes("Safety") ? "%" : ""}
                  </span>
                </div>
                <Progress
                  value={label.includes("Score") || label.includes("Safety") ? value : value}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
