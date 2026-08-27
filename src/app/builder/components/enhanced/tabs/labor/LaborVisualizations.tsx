"use client";

import React, { useState } from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/ui/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/themes";
import {
  Reports as PieChart,
  StatsReport as BarChart3,
  Shield,
  Dashboard as Gauge,
} from "iconoir-react";
import type { LaborConfiguration } from "~/types/economy-builder";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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
  const [activeChart, setActiveChart] = useState<"type" | "sector">("type");

  return (
    <div className="space-y-6">
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <div className="mb-4 flex flex-col gap-2 border-b border-white/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
              {activeChart === "type" ? (
                <>
                  <PieChart className="h-5 w-5" />
                  <span>Employment Type Distribution</span>
                </>
              ) : (
                <>
                  <BarChart3 className="h-5 w-5" />
                  <span>Employment by Sector</span>
                </>
              )}
            </h4>
            <div className="flex max-w-fit rounded-lg border border-white/10 bg-white/5 p-0.5 select-none">
              <Button
                size="sm"
                variant={activeChart === "type" ? "default" : "ghost"}
                onClick={() => setActiveChart("type")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
                  activeChart === "type"
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                Employment Type
              </Button>
              <Button
                size="sm"
                variant={activeChart === "sector" ? "default" : "ghost"}
                onClick={() => setActiveChart("sector")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
                  activeChart === "sector"
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                Employment by Sector
              </Button>
            </div>
          </div>

          {activeChart === "type" ? (
            <GlassPieChart
              data={employmentTypeData}
              dataKey="value"
              nameKey="name"
              height={300}
              colors={DEFAULT_CHART_COLORS}
            />
          ) : (
            <GlassBarChart
              data={sectorDistributionData}
              xKey="name"
              yKey="value"
              height={250}
              colors={DEFAULT_CHART_COLORS}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
            />
          )}
        </GlassCardContent>
      </GlassCard>

      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
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

      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
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
