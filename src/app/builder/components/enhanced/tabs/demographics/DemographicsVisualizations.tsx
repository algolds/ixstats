"use client";

import React, { useState } from "react";
import { Progress } from "~/components/ui/progress";
import { GlassBarChart, GlassPieChart } from "~/components/shared/charts/RechartsIntegration";
import { DEFAULT_CHART_COLORS } from "~/lib/themes";
import {
  Reports as PieChart,
  StatsReport as BarChart3,
  GraduationCap,
  MapPin,
  Dashboard as Gauge,
} from "iconoir-react";
import type { DemographicsConfiguration } from "~/types/economy-builder";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

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
      <Card>
        <CardContent className="p-6">
          <div className="border-separator mb-4 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-headline text-label flex items-center gap-2">
              {activeChart === "age" && (
                <>
                  <PieChart className="h-5 w-5" />
                  <span>Age distribution</span>
                </>
              )}
              {activeChart === "urbanRural" && (
                <>
                  <BarChart3 className="h-5 w-5" />
                  <span>Urban-rural distribution</span>
                </>
              )}
              {activeChart === "regional" && (
                <>
                  <MapPin className="h-5 w-5" />
                  <span>Regional distribution</span>
                </>
              )}
            </h4>
            <div className="rounded-control border-separator bg-fill-4 flex max-w-fit border p-0.5 select-none">
              <Button
                size="sm"
                variant={activeChart === "age" ? "default" : "ghost"}
                onClick={() => setActiveChart("age")}
                className={cn(
                  "rounded-control-sm text-caption h-7 px-3 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeChart === "age"
                    ? "bg-green text-on-green shadow-card hover:bg-green"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
                )}
              >
                Age
              </Button>
              <Button
                size="sm"
                variant={activeChart === "urbanRural" ? "default" : "ghost"}
                onClick={() => setActiveChart("urbanRural")}
                className={cn(
                  "rounded-control-sm text-caption h-7 px-3 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeChart === "urbanRural"
                    ? "bg-green text-on-green shadow-card hover:bg-green"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
                )}
              >
                Urban/Rural
              </Button>
              <Button
                size="sm"
                variant={activeChart === "regional" ? "default" : "ghost"}
                onClick={() => setActiveChart("regional")}
                className={cn(
                  "rounded-control-sm text-caption h-7 px-3 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  activeChart === "regional"
                    ? "bg-green text-on-green shadow-card hover:bg-green"
                    : "text-label-secondary hover:bg-fill-4 hover:text-label"
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
              <div className="text-footnote text-label-secondary flex h-[300px] items-center justify-center">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h4 className="text-headline text-label mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            <span>Education levels</span>
          </h4>
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

      <Card>
        <CardContent className="p-6">
          <h4 className="text-headline text-label mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            <span>Demographics health</span>
          </h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Life expectancy</span>
                <span className="font-medium">{demographics.lifeExpectancy.toFixed(1)} years</span>
              </div>
              <Progress value={demographics.lifeExpectancy} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Literacy rate</span>
                <span className="font-medium">{demographics.literacyRate.toFixed(1)}%</span>
              </div>
              <Progress value={demographics.literacyRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Urbanization</span>
                <span className="font-medium">
                  {demographics.urbanRuralSplit.urban.toFixed(1)}%
                </span>
              </div>
              <Progress value={demographics.urbanRuralSplit.urban} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-body flex justify-between">
                <span>Working age share</span>
                <span className="font-medium">
                  {demographics.ageDistribution.age15to64.toFixed(1)}%
                </span>
              </div>
              <Progress value={demographics.ageDistribution.age15to64} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
