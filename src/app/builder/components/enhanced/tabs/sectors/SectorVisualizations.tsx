"use client";

import React, { useMemo } from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Badge } from "~/components/ui/badge";
import { PieChart, BarChart3, Zap } from "lucide-react";
import { GlassBarChart, GlassPieChart } from "~/components/ui/charts/RechartsIntegration";
import { getColorsFromData } from "~/lib/themes";
import { SECTOR_TEMPLATES } from "../utils/sectorCalculations";
import type { SectorConfiguration } from "~/types/economy-builder";

interface SectorVisualizationsProps {
  sectors: SectorConfiguration[];
  sectorImpacts: Record<string, number>;
}

export function SectorVisualizations({ sectors, sectorImpacts }: SectorVisualizationsProps) {
  // Prepare GDP chart data
  const sectorChartData = useMemo(() => {
    return sectors.map((sector) => {
      const sectorType = sector.id.split("_")[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.gdpContribution,
        color: SECTOR_TEMPLATES[sectorType]?.color || "gray",
      };
    });
  }, [sectors]);

  // Prepare employment chart data
  const employmentChartData = useMemo(() => {
    return sectors.map((sector) => {
      const sectorType = sector.id.split("_")[0] as keyof typeof SECTOR_TEMPLATES;
      return {
        name: sector.name,
        value: sector.employmentShare,
        color: SECTOR_TEMPLATES[sectorType]?.color || "gray",
      };
    });
  }, [sectors]);

  return (
    <div className="space-y-6">
      {/* GDP Composition */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <PieChart className="h-5 w-5" />
            <span>GDP Composition</span>
          </h4>
          {sectorChartData.length === 0 ? (
            <div className="text-muted-foreground flex h-[300px] items-center justify-center">
              Add sectors to see GDP composition
            </div>
          ) : (
            <GlassPieChart
              data={sectorChartData}
              dataKey="value"
              nameKey="name"
              height={300}
              colors={getColorsFromData(sectorChartData)}
            />
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Employment Distribution */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <BarChart3 className="h-5 w-5" />
            <span>Employment Distribution</span>
          </h4>
          {employmentChartData.length === 0 ? (
            <div className="text-muted-foreground flex h-[250px] items-center justify-center">
              Add sectors to see employment distribution
            </div>
          ) : (
            <GlassBarChart
              data={employmentChartData}
              xKey="name"
              yKey="value"
              height={250}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
              colors={getColorsFromData(employmentChartData)}
            />
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Component Impact Summary */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Zap className="h-5 w-5" />
            <span>Atomic Component Impact</span>
          </h4>
          <div className="space-y-3">
            {Object.entries(sectorImpacts).map(([sectorId, impact]) => {
              const template = SECTOR_TEMPLATES[sectorId as keyof typeof SECTOR_TEMPLATES];
              if (!template || impact === 1) return null;

              return (
                <div
                  key={sectorId}
                  className="flex items-center justify-between rounded border border-zinc-800/40 bg-zinc-900/30 p-2 text-zinc-300"
                >
                  <div className="flex items-center space-x-2">
                    <template.icon className="h-4 w-4" />
                    <span className="text-sm">{template.name}</span>
                  </div>
                  <Badge variant={impact > 1 ? "default" : "secondary"}>
                    {impact > 1 ? "+" : ""}
                    {((impact - 1) * 100).toFixed(1)}%
                  </Badge>
                </div>
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
