"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { GlassBarChart, GlassPieChart } from '~/components/charts/RechartsIntegration';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import { PieChart, BarChart3, GraduationCap, MapPin, Gauge } from 'lucide-react';
import type { DemographicsConfiguration } from '~/types/economy-builder';

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
  regionData
}: DemographicsVisualizationsProps) {
  return (
    <div className="space-y-6">
      {/* Age Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Age Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassPieChart
            data={ageDistributionData}
            dataKey="value"
            nameKey="name"
            height={300}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>

      {/* Urban-Rural Split */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Urban-Rural Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassBarChart
            data={urbanRuralData}
            xKey="name"
            yKey="value"
            height={200}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </CardContent>
      </Card>

      {/* Education Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GraduationCap className="h-5 w-5" />
            <span>Education Levels</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassBarChart
            data={educationLevelData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </CardContent>
      </Card>

      {/* Regional Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Regional Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassPieChart
            data={regionData}
            dataKey="value"
            nameKey="name"
            height={250}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>

      {/* Demographics Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5" />
            <span>Demographics Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                <span className="font-medium">{demographics.urbanRuralSplit.urban.toFixed(1)}%</span>
              </div>
              <Progress value={demographics.urbanRuralSplit.urban} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Working Age Share</span>
                <span className="font-medium">{demographics.ageDistribution.age15to64.toFixed(1)}%</span>
              </div>
              <Progress value={demographics.ageDistribution.age15to64} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
