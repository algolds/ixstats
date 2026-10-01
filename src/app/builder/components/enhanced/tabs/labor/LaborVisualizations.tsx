"use client";

import React, { useState } from "react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/shared/charts/RechartsIntegration";
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
      <FacetCard>
        <FacetCardContent className="p-6">
          <div className="border-separator mb-4 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-headline text-green flex items-center gap-2">
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
            <div className="rounded-control border-separator bg-fill-4 flex max-w-fit border p-0.5 select-none">
              <Button
                size="sm"
                variant={activeChart === "type" ? "default" : "ghost"}
                onClick={() => setActiveChart("type")}
                className={cn(
                  "rounded-control-sm text-caption h-7 px-2.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeChart === "type"
                    ? "bg-green text-on-green shadow-card hover:bg-green"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
                )}
              >
                Employment Type
              </Button>
              <Button
                size="sm"
                variant={activeChart === "sector" ? "default" : "ghost"}
                onClick={() => setActiveChart("sector")}
                className={cn(
                  "rounded-control-sm text-caption h-7 px-2.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeChart === "sector"
                    ? "bg-green text-on-green shadow-card hover:bg-green"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
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
        </FacetCardContent>
      </FacetCard>

      <FacetCard>
        <FacetCardContent className="p-6">
          <h4 className="text-headline text-green mb-4 flex items-center gap-2">
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
        </FacetCardContent>
      </FacetCard>

      <FacetCard>
        <FacetCardContent className="p-6">
          <h4 className="text-headline text-green mb-4 flex items-center gap-2">
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
                <div className="text-body flex justify-between">
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
        </FacetCardContent>
      </FacetCard>
    </div>
  );
}
