"use client";

import React from "react";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import { Progress } from "~/components/ui/progress";
import { Users, Heart } from "lucide-react";
import type { LaborSummary, DemographicsSummary } from "../utils/previewCalculations";

interface LaborDemographicsSummaryProps {
  laborSummary: LaborSummary;
  demographicsSummary: DemographicsSummary;
}

export function LaborDemographicsSummary({
  laborSummary,
  demographicsSummary,
}: LaborDemographicsSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Labor Market */}
      <CutoutCard className="rounded-2xl border border-zinc-800 bg-zinc-950/40 shadow-lg backdrop-blur-md">
        <CutoutCardContent className="space-y-4 p-6">
          <h3 className="mb-4 flex items-center space-x-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Users className="h-5 w-5" />
            <span>Labor Market</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {laborSummary.totalWorkforce.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-sm">Total Workforce</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{laborSummary.employed.toLocaleString()}</div>
              <div className="text-muted-foreground text-sm">Employed</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Unemployment Rate</span>
              <span className="font-medium">{laborSummary.unemploymentRate.toFixed(1)}%</span>
            </div>
            <Progress value={(laborSummary.unemploymentRate / 30) * 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Participation Rate</span>
              <span className="font-medium">{laborSummary.participationRate.toFixed(1)}%</span>
            </div>
            <Progress value={laborSummary.participationRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Min Wage:</span>
              <span className="ml-1 font-medium">${laborSummary.minimumWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-muted-foreground">Living Wage:</span>
              <span className="ml-1 font-medium">${laborSummary.livingWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-muted-foreground">Wage Gap:</span>
              <span className="ml-1 font-medium">${laborSummary.wageGap.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Hours:</span>
              <span className="ml-1 font-medium">{laborSummary.averageHours}/week</span>
            </div>
          </div>
        </CutoutCardContent>
      </CutoutCard>

      {/* Demographics */}
      <CutoutCard className="rounded-2xl border border-zinc-800 bg-zinc-950/40 shadow-lg backdrop-blur-md">
        <CutoutCardContent className="space-y-4 p-6">
          <h3 className="mb-4 flex items-center space-x-2 text-base font-semibold text-emerald-500 dark:text-emerald-400">
            <Heart className="h-5 w-5" />
            <span>Demographics</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {demographicsSummary.totalPopulation.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-sm">Total Population</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {demographicsSummary.workingAgePopulation.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-sm">Working Age</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Life Expectancy</span>
              <span className="font-medium">
                {demographicsSummary.lifeExpectancy.toFixed(1)} years
              </span>
            </div>
            <Progress value={demographicsSummary.lifeExpectancy} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Literacy Rate</span>
              <span className="font-medium">{demographicsSummary.literacyRate.toFixed(1)}%</span>
            </div>
            <Progress value={demographicsSummary.literacyRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Urban:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.urbanPopulation.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Rural:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.ruralPopulation.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Growth Rate:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.populationGrowth.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Dependency:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.dependencyRatio.toFixed(1)}%
              </span>
            </div>
          </div>
        </CutoutCardContent>
      </CutoutCard>
    </div>
  );
}
