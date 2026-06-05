"use client";

import React from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import { PieChart, BarChart3, GraduationCap, MapPin, Gauge } from "lucide-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";

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
  return (
    <div className="space-y-6">
      {/* Age Distribution */}
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
            <span>Age Distribution</span>
          </h4>
          <GlassPieChart
            data={ageDistributionData}
            dataKey="value"
            nameKey="name"
            height={300}
            colors={DEFAULT_CHART_COLORS}
          />
        </GlassCardContent>
      </GlassCard>

      {/* Urban-Rural Split */}
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
            <span>Urban-Rural Distribution</span>
          </h4>
          <GlassBarChart
            data={urbanRuralData}
            xKey="name"
            yKey="value"
            height={200}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
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

      {/* Regional Distribution */}
      <GlassCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <GlassCardContent className="p-6">
          <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <MapPin className="h-5 w-5" />
            <span>Regional Distribution</span>
          </h4>
          <GlassPieChart
            data={regionData}
            dataKey="value"
            nameKey="name"
            height={250}
            colors={DEFAULT_CHART_COLORS}
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
              <Progress value={demographics.lifeExpectancy / 100} className="h-2" />
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
