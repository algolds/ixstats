"use client";

import React from "react";
import { Progress } from "~/components/ui/progress";
import { Group as Users, Heart } from "iconoir-react";
import type { LaborSummary, DemographicsSummary } from "../utils/previewCalculations";
import { Card, CardContent } from "~/components/ui/card";

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
        <CardContent className="space-y-4 p-6">
          <h3 className="text-headline text-label mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Labor market</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-title-1">{laborSummary.totalWorkforce.toLocaleString()}</div>
              <div className="text-label-secondary text-body">Total workforce</div>
            </div>
            <div className="text-center">
              <div className="text-title-1">{laborSummary.employed.toLocaleString()}</div>
              <div className="text-label-secondary text-body">Employed</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Unemployment rate</span>
              <span className="font-medium">{laborSummary.unemploymentRate.toFixed(1)}%</span>
            </div>
            <Progress value={(laborSummary.unemploymentRate / 30) * 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Participation rate</span>
              <span className="font-medium">{laborSummary.participationRate.toFixed(1)}%</span>
            </div>
            <Progress value={laborSummary.participationRate} className="h-2" />
          </div>

          <div className="text-body grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-label-secondary">Min wage:</span>
              <span className="ml-1 font-medium">${laborSummary.minimumWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Living wage:</span>
              <span className="ml-1 font-medium">${laborSummary.livingWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Wage gap:</span>
              <span className="ml-1 font-medium">${laborSummary.wageGap.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Avg hours:</span>
              <span className="ml-1 font-medium">{laborSummary.averageHours}/week</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demographics */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-headline text-label mb-4 flex items-center space-x-2">
            <Heart className="h-5 w-5" />
            <span>Demographics</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-title-1">
                {demographicsSummary.totalPopulation.toLocaleString()}
              </div>
              <div className="text-label-secondary text-body">Total population</div>
            </div>
            <div className="text-center">
              <div className="text-title-1">
                {demographicsSummary.workingAgePopulation.toLocaleString()}
              </div>
              <div className="text-label-secondary text-body">Working age</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Life expectancy</span>
              <span className="font-medium">
                {demographicsSummary.lifeExpectancy.toFixed(1)} years
              </span>
            </div>
            <Progress value={demographicsSummary.lifeExpectancy} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Literacy rate</span>
              <span className="font-medium">{demographicsSummary.literacyRate.toFixed(1)}%</span>
            </div>
            <Progress value={demographicsSummary.literacyRate} className="h-2" />
          </div>

          <div className="text-body grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-label-secondary">Urban:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.urbanPopulation.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-label-secondary">Rural:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.ruralPopulation.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-label-secondary">Growth rate:</span>
              <span className="ml-1 font-medium">
                {demographicsSummary.populationGrowth.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-label-secondary">Dependency:</span>
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
