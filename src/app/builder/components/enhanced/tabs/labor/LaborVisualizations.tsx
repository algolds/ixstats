"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import { PieChart, BarChart3, Shield, Gauge } from "lucide-react";
import type { LaborConfiguration } from "~/types/economy-builder";

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
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Employment Type Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassPieChart
            data={employmentTypeData}
            dataKey="value"
            nameKey="name"
            height={300}
            colors={DEFAULT_CHART_COLORS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Employment by Sector</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassBarChart
            data={sectorDistributionData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Worker Protection Scores</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlassBarChart
            data={workerProtectionsData}
            xKey="name"
            yKey="value"
            height={250}
            colors={DEFAULT_CHART_COLORS}
            valueFormatter={(value) => `${value.toFixed(0)}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5" />
            <span>Labor Market Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
