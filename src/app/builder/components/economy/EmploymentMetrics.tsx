"use client";

import React from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Shield,
  Activity,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { EmploymentData } from "../../types/economy";
import { MetricCard } from "../../primitives/enhanced";
import { GlassBarChart, GlassPieChart } from "~/components/charts/RechartsIntegration";
import { SectionBase, sectionUtils, type ExtendedSectionProps } from "../glass/SectionBase";

interface EmploymentMetricsProps {
  data: EmploymentData;
  totalPopulation: number;
  showAdvanced?: boolean;
  className?: string;
}

export function EmploymentMetrics({
  data,
  totalPopulation,
  showAdvanced = false,
  className = "",
}: EmploymentMetricsProps) {
  // Calculate derived metrics
  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const totalEmployed = Math.round(data.totalWorkforce * (data.employmentRate / 100));
  const totalUnemployed = Math.round(data.totalWorkforce * (data.unemploymentRate / 100));

  const employmentHealth =
    data.unemploymentRate < 5 ? "healthy" : data.unemploymentRate < 8 ? "moderate" : "concerning";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50 border-green-200";
      case "moderate":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "concerning":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const topSectors = Object.entries(data.sectorDistribution)
    .map(([sector, value]) => ({ sector, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Workforce"
          value={data.totalWorkforce.toLocaleString()}
          icon={Users}
          description={`${data.laborForceParticipationRate.toFixed(1)}% participation`}
          trend={data.laborForceParticipationRate > 60 ? "up" : "down"}
        />

        <MetricCard
          label="Employment Rate"
          value={`${data.employmentRate.toFixed(1)}%`}
          icon={Briefcase}
          description={`${totalEmployed.toLocaleString()} employed`}
          trend={data.employmentRate > 90 ? "up" : "neutral"}
          className={getStatusColor(employmentHealth)}
        />

        <MetricCard
          label="Unemployment Rate"
          value={`${data.unemploymentRate.toFixed(1)}%`}
          icon={data.unemploymentRate > 7 ? TrendingDown : TrendingUp}
          description={`${totalUnemployed.toLocaleString()} unemployed`}
          trend={data.unemploymentRate < 5 ? "up" : data.unemploymentRate > 8 ? "down" : "neutral"}
        />

        <MetricCard
          label="Avg. Work Hours"
          value={data.averageWorkweekHours.toString()}
          unit="hrs/week"
          icon={Clock}
          description={`${data.averageOvertimeHours} overtime hrs/week`}
        />
      </div>

      {/* Employment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Employment Status
            </span>
            <Badge
              variant={
                employmentHealth === "healthy"
                  ? "default"
                  : employmentHealth === "moderate"
                    ? "secondary"
                    : "destructive"
              }
            >
              {employmentHealth.charAt(0).toUpperCase() + employmentHealth.slice(1)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Employed ({data.employmentRate.toFixed(1)}%)</span>
                <span className="font-medium text-green-600">{totalEmployed.toLocaleString()}</span>
              </div>
              <Progress value={data.employmentRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Unemployed ({data.unemploymentRate.toFixed(1)}%)</span>
                <span className="font-medium text-red-600">{totalUnemployed.toLocaleString()}</span>
              </div>
              <Progress value={data.unemploymentRate} className="h-2 bg-red-100" />
            </div>

            {showAdvanced && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Underemployed ({data.underemploymentRate.toFixed(1)}%)</span>
                  <span className="font-medium text-yellow-600">
                    {Math.round(
                      data.totalWorkforce * (data.underemploymentRate / 100)
                    ).toLocaleString()}
                  </span>
                </div>
                <Progress value={data.underemploymentRate} className="h-2 bg-yellow-100" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sector Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Employment by Sector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topSectors.map(({ sector, value }) => (
              <div key={sector} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{sector.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="font-medium">{value.toFixed(1)}%</span>
                </div>
                <Progress value={value} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Demographics */}
      {showAdvanced && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demographic Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Youth Unemployment (15-24)</span>
                <Badge variant={data.youthUnemploymentRate > 15 ? "destructive" : "secondary"}>
                  {data.youthUnemploymentRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Senior Employment (55+)</span>
                <Badge variant={data.seniorEmploymentRate > 50 ? "default" : "secondary"}>
                  {data.seniorEmploymentRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Female Participation</span>
                <Badge variant={data.femaleParticipationRate > 60 ? "default" : "secondary"}>
                  {data.femaleParticipationRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Male Participation</span>
                <Badge variant="secondary">{data.maleParticipationRate.toFixed(1)}%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Working Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Unionization Rate</span>
                <Badge variant="secondary">{data.unionizationRate.toFixed(1)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Workplace Safety</span>
                <Badge variant={data.workplaceSafetyIndex > 80 ? "default" : "secondary"}>
                  {data.workplaceSafetyIndex}/100
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Paid Vacation Days</span>
                <span className="text-sm font-medium">{data.paidVacationDays} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Parental Leave</span>
                <span className="text-sm font-medium">{data.parentalLeaveWeeks} weeks</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employment Type Distribution */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {data.employmentType.fullTime.toFixed(1)}%
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Full-Time</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {data.employmentType.partTime.toFixed(1)}%
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Part-Time</div>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {data.employmentType.selfEmployed.toFixed(1)}%
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Self-Employed</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {data.employmentType.informal.toFixed(1)}%
                </div>
                <div className="text-muted-foreground mt-1 text-xs">Informal</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
