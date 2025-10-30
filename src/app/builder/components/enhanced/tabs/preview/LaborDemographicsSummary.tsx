"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Labor Market</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Progress value={laborSummary.unemploymentRate / 30} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Participation Rate</span>
              <span className="font-medium">{laborSummary.participationRate.toFixed(1)}%</span>
            </div>
            <Progress value={laborSummary.participationRate / 100} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
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
        </CardContent>
      </Card>

      {/* Demographics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5" />
            <span>Demographics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Progress value={demographicsSummary.lifeExpectancy / 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Literacy Rate</span>
              <span className="font-medium">{demographicsSummary.literacyRate.toFixed(1)}%</span>
            </div>
            <Progress value={demographicsSummary.literacyRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
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
        </CardContent>
      </Card>
    </div>
  );
}
