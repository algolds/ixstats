"use client";

import React, { useState } from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/ui/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/themes";
import { PieChart, BarChart3, GraduationCap, MapPin, Gauge } from "lucide-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface DemographicsVisualizationsProps {
  demographics: DemographicsConfiguration;
  ageDistributionData: Array<{ name: string; value: number; color: string }>;
  urbanRuralData: Array<{ name: string; value: number; color: string }>;
  educationLevelData: Array<{ name: string; value: number; color: string }>;
  regionData: Array<{ name: string; value: number; color: string }>;
}

export function DemographicsVisualizations({
  demographics,
  ageDistributionData,
  urbanRuralData,
  educationLevelData,
  regionData,
}: DemographicsVisualizationsProps) {
  const [activeChart, setActiveChart] = useState<"age" | "urbanRural" | "regional">("age");

  return (
    <div className="space-y-6">
      {/* Merged Age, Urban-Rural & Regional Distribution */}
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
              {activeChart === "age" && (
                <>
                  <PieChart className="h-5 w-5" />
                  <span>Age Distribution</span>
                </>
              )}
              {activeChart === "urbanRural" && (
                <>
                  <BarChart3 className="h-5 w-5" />
                  <span>Urban-Rural Distribution</span>
                </>
              )}
              {activeChart === "regional" && (
                <>
                  <MapPin className="h-5 w-5" />
                  <span>Regional Distribution</span>
                </>
              )}
            </h4>
            <div className="flex max-w-fit rounded-lg border border-white/10 bg-white/5 p-0.5 select-none">
              <Button
                size="sm"
                variant={activeChart === "age" ? "default" : "ghost"}
                onClick={() => setActiveChart("age")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
                  activeChart === "age"
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                Age
              </Button>
              <Button
                size="sm"
                variant={activeChart === "urbanRural" ? "default" : "ghost"}
                onClick={() => setActiveChart("urbanRural")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
                  activeChart === "urbanRural"
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                Urban/Rural
              </Button>
              <Button
                size="sm"
                variant={activeChart === "regional" ? "default" : "ghost"}
                onClick={() => setActiveChart("regional")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
                  activeChart === "regional"
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                Regional
              </Button>
            </div>
          </div>

          {activeChart === "age" && (
            <GlassPieChart
              data={ageDistributionData}
              dataKey="value"
              nameKey="name"
              height={300}
              colors={DEFAULT_CHART_COLORS}
            />
          )}

          {activeChart === "urbanRural" && (
            <GlassBarChart
              data={urbanRuralData}
              xKey="name"
              yKey="value"
              height={300}
              colors={DEFAULT_CHART_COLORS}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
            />
          )}

          {activeChart === "regional" &&
            (regionData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-xs text-zinc-400">
                No regions configured. Go to the Geographic tab to add regions.
              </div>
            ) : (
              <GlassPieChart
                data={regionData}
                dataKey="value"
                nameKey="name"
                height={300}
                colors={DEFAULT_CHART_COLORS}
              />
            ))}
        </GlassCardContent>
      </GlassCard>

      {/* Education Levels */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <GraduationCap className="h-5 w-5" />
            <span>Education Levels</span>
          </h4>
          <GlassBarChart
            data={educationLevelData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </GlassCardContent>
      </GlassCard>

      {/* Demographics Health */}
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
            <span>Demographics Health</span>
          </h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Life Expectancy</span>
                <span className="font-medium">{demographics.lifeExpectancy.toFixed(1)} years</span>
              </div>
              <Progress value={demographics.lifeExpectancy} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Literacy Rate</span>
                <span className="font-medium">{demographics.literacyRate.toFixed(1)}%</span>
              </div>
              <Progress value={demographics.literacyRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Urbanization</span>
                <span className="font-medium">
                  {demographics.urbanRuralSplit.urban.toFixed(1)}%
                </span>
              </div>
              <Progress value={demographics.urbanRuralSplit.urban} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Working Age Share</span>
                <span className="font-medium">
                  {demographics.ageDistribution.age15to64.toFixed(1)}%
                </span>
              </div>
              <Progress value={demographics.ageDistribution.age15to64} className="h-2" />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
