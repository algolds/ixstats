"use client";

import React from "react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import { Group as Users, Heart } from "iconoir-react";
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
      <FacetCard>
        <FacetCardContent className="space-y-4 p-6">
          <h3 className="text-headline text-green mb-4 flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Labor Market</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-title-1">{laborSummary.totalWorkforce.toLocaleString()}</div>
              <div className="text-label-secondary text-body">Total Workforce</div>
            </div>
            <div className="text-center">
              <div className="text-title-1">{laborSummary.employed.toLocaleString()}</div>
              <div className="text-label-secondary text-body">Employed</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Unemployment Rate</span>
              <span className="font-medium">{laborSummary.unemploymentRate.toFixed(1)}%</span>
            </div>
            <Progress value={(laborSummary.unemploymentRate / 30) * 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Participation Rate</span>
              <span className="font-medium">{laborSummary.participationRate.toFixed(1)}%</span>
            </div>
            <Progress value={laborSummary.participationRate} className="h-2" />
          </div>

          <div className="text-body grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-label-secondary">Min Wage:</span>
              <span className="ml-1 font-medium">${laborSummary.minimumWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Living Wage:</span>
              <span className="ml-1 font-medium">${laborSummary.livingWage.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Wage Gap:</span>
              <span className="ml-1 font-medium">${laborSummary.wageGap.toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-label-secondary">Avg Hours:</span>
              <span className="ml-1 font-medium">{laborSummary.averageHours}/week</span>
            </div>
          </div>
        </FacetCardContent>
      </FacetCard>

      {/* Demographics */}
      <FacetCard>
        <FacetCardContent className="space-y-4 p-6">
          <h3 className="text-headline text-green mb-4 flex items-center space-x-2">
            <Heart className="h-5 w-5" />
            <span>Demographics</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-title-1">
                {demographicsSummary.totalPopulation.toLocaleString()}
              </div>
              <div className="text-label-secondary text-body">Total Population</div>
            </div>
            <div className="text-center">
              <div className="text-title-1">
                {demographicsSummary.workingAgePopulation.toLocaleString()}
              </div>
              <div className="text-label-secondary text-body">Working Age</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Life Expectancy</span>
              <span className="font-medium">
                {demographicsSummary.lifeExpectancy.toFixed(1)} years
              </span>
            </div>
            <Progress value={demographicsSummary.lifeExpectancy} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="text-body flex justify-between">
              <span>Literacy Rate</span>
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
              <span className="text-label-secondary">Growth Rate:</span>
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
        </FacetCardContent>
      </FacetCard>
    </div>
  );
}
