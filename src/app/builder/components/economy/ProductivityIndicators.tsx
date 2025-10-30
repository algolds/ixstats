"use client";

import React from "react";
import { Zap, TrendingUp, Award, Target, BarChart3, Activity, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import type { ProductivityData } from "../../types/economy";
import { MetricCard } from "../../primitives/enhanced";

interface ProductivityIndicatorsProps {
  data: ProductivityData;
  showAdvanced?: boolean;
  className?: string;
}

export function ProductivityIndicators({
  data,
  showAdvanced = false,
  className = "",
}: ProductivityIndicatorsProps) {
  const getCompetitivenessLevel = (score: number) => {
    if (score >= 80)
      return { level: "World Leader", color: "emerald", variant: "default" as const };
    if (score >= 65)
      return { level: "Highly Competitive", color: "blue", variant: "default" as const };
    if (score >= 50)
      return { level: "Competitive", color: "yellow", variant: "secondary" as const };
    return { level: "Developing", color: "orange", variant: "secondary" as const };
  };

  const competitiveness = getCompetitivenessLevel(data.globalCompetitivenessIndex);

  const qualityMetrics = [
    {
      label: "Competitiveness",
      value: data.globalCompetitivenessIndex,
      icon: Award,
      color: competitiveness.color,
    },
    {
      label: "Innovation",
      value: data.innovationIndex,
      icon: Zap,
      color: data.innovationIndex > 70 ? "emerald" : "blue",
    },
    {
      label: "Infrastructure",
      value: data.infrastructureQualityIndex,
      icon: Target,
      color: data.infrastructureQualityIndex > 75 ? "emerald" : "yellow",
    },
    {
      label: "Institutions",
      value: data.institutionalQualityIndex,
      icon: BarChart3,
      color: data.institutionalQualityIndex > 70 ? "emerald" : "orange",
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Labor Productivity"
          value={data.laborProductivityIndex.toString()}
          icon={Activity}
          description={`${data.laborProductivityGrowthRate > 0 ? "+" : ""}${data.laborProductivityGrowthRate.toFixed(1)}% growth`}
          trend={
            data.laborProductivityGrowthRate > 2
              ? "up"
              : data.laborProductivityGrowthRate > 0
                ? "neutral"
                : "down"
          }
        />

        <MetricCard
          label="Competitiveness"
          value={`${data.globalCompetitivenessIndex}/100`}
          icon={Award}
          description={competitiveness.level}
          className={`text-${competitiveness.color}-600 bg-${competitiveness.color}-50`}
        />

        <MetricCard
          label="Innovation Index"
          value={`${data.innovationIndex}/100`}
          icon={Zap}
          description="Innovation capacity"
          trend={data.innovationIndex > 70 ? "up" : "neutral"}
        />

        <MetricCard
          label="Skills Index"
          value={`${data.skillsIndex}/100`}
          icon={Target}
          description={`${data.averageEducationYears.toFixed(1)} yrs avg education`}
          trend={data.skillsIndex > 70 ? "up" : "neutral"}
        />
      </div>

      {/* Productivity Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Productivity Metrics
            </span>
            <Badge variant={competitiveness.variant}>{competitiveness.level}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Labor Productivity Index</span>
                <Badge variant={data.laborProductivityIndex > 100 ? "default" : "secondary"}>
                  {data.laborProductivityIndex.toFixed(0)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Productivity Growth Rate</span>
                <Badge variant={data.laborProductivityGrowthRate > 2 ? "default" : "secondary"}>
                  {data.laborProductivityGrowthRate > 0 ? "+" : ""}
                  {data.laborProductivityGrowthRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Multifactor Productivity</span>
                <Badge variant={data.multifactorProductivityGrowth > 1 ? "default" : "secondary"}>
                  {data.multifactorProductivityGrowth > 0 ? "+" : ""}
                  {data.multifactorProductivityGrowth.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Capital Productivity</span>
                <Badge variant="secondary">{data.capitalProductivity.toFixed(2)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Return on Capital</span>
                <Badge variant={data.returnOnInvestedCapital > 10 ? "default" : "secondary"}>
                  {data.returnOnInvestedCapital.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Energy Efficiency</span>
                <Badge variant={data.energyEfficiency > 8 ? "default" : "secondary"}>
                  {data.energyEfficiency.toFixed(1)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Indices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quality & Competitiveness Indices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {qualityMetrics.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <Badge variant={value > 70 ? "default" : "secondary"}>
                    {value.toFixed(0)}/100
                  </Badge>
                </div>
                <Progress value={value} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced: Human Capital */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Human Capital Development
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {data.averageEducationYears.toFixed(1)}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Years of Education</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {data.tertiaryEducationRate.toFixed(0)}%
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Tertiary Education</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{data.skillsIndex}/100</div>
                <div className="text-muted-foreground mt-1 text-xs">Skills Index</div>
              </div>
              <div className="rounded-lg bg-orange-50 p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {data.brainDrainIndex.toFixed(0)}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Brain Drain Index</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced: Efficiency Metrics */}
      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capital Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Capital Productivity</span>
                <Badge variant="secondary">{data.capitalProductivity.toFixed(2)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Capital Intensity</span>
                <Badge variant="secondary">{data.capitalIntensity.toFixed(2)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Return on Invested Capital</span>
                <Badge variant={data.returnOnInvestedCapital > 10 ? "default" : "secondary"}>
                  {data.returnOnInvestedCapital.toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Efficiency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Energy Efficiency</span>
                <Badge variant={data.energyEfficiency > 8 ? "default" : "secondary"}>
                  {data.energyEfficiency.toFixed(1)} GDP/unit
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Resource Productivity</span>
                <Badge variant={data.resourceProductivity > 2 ? "default" : "secondary"}>
                  {data.resourceProductivity.toFixed(2)} GDP/ton
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Efficiency Score</span>
                <Badge variant="default">
                  {((data.energyEfficiency + data.resourceProductivity) * 10).toFixed(0)}/100
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
