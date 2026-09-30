"use client";
// src/components/defense/stability/StabilityMetricsCard.tsx

import React from "react";
import type { ReactNode } from "react";
import { Group as Users, Shield, Activity, Heart, Eye } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { StabilityHelpDialog } from "./StabilityHelpDialog";

interface StabilityMetrics {
  stabilityScore: number;
  stabilityTrend: string;
  crimeRate: number;
  violentCrimeRate: number;
  propertyCrimeRate: number;
  organizedCrimeLevel: number;
  policingEffectiveness: number;
  justiceSystemEfficiency: number;
  protestFrequency: number;
  riotRisk: number;
  civilDisobedience: number;
  socialCohesion: number;
  ethnicTension: number;
  politicalPolarization: number;
  trustInGovernment: number;
  trustInPolice: number;
  fearOfCrime: number;
}

interface StabilityMetricsCardProps {
  metrics: StabilityMetrics | undefined;
  getStabilityColor: (score: number) => string;
  getStabilityBg: (score: number) => string;
  getTrendIcon: (trend: string) => ReactNode;
}

export const StabilityMetricsCard = React.memo(function StabilityMetricsCard({
  metrics,
  getStabilityColor,
  getStabilityBg,
  getTrendIcon,
}: StabilityMetricsCardProps) {
  return (
    <Card
      className={cn(
        "facet-hierarchy-child border-2",
        metrics ? getStabilityBg(metrics.stabilityScore) : ""
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Internal Stability
              <StabilityHelpDialog />
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {metrics && getTrendIcon(metrics.stabilityTrend)}
            <Badge variant="outline" className="text-xs">
              <Activity className="mr-1 h-3 w-3" />
              Auto-Generated Events
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stability Score */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Overall Stability Score</span>
            <span
              className={cn(
                "text-2xl font-bold",
                metrics ? getStabilityColor(metrics.stabilityScore) : ""
              )}
            >
              <NumberFlowDisplay
                value={metrics?.stabilityScore ?? 75}
                format="decimal"
                decimalPlaces={1}
              />
              <span className="text-muted-foreground text-sm">/100</span>
            </span>
          </div>
          <Progress value={metrics?.stabilityScore ?? 75} className="h-3" />
        </div>

        <Separator />

        {/* Crime & Law Enforcement */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4" />
            Crime & Law Enforcement
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Crime Rate</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.crimeRate ?? 5}
                    format="decimal"
                    decimalPlaces={1}
                  />{" "}
                  per 100k
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Violent Crime</span>
                <span>
                  <NumberFlowDisplay value={metrics?.violentCrimeRate ?? 2} />
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Property Crime</span>
                <span>
                  <NumberFlowDisplay value={metrics?.propertyCrimeRate ?? 10} />
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Organized Crime</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.organizedCrimeLevel ?? 3}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.organizedCrimeLevel ?? 3} className="h-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Policing Effectiveness</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.policingEffectiveness ?? 60}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.policingEffectiveness ?? 60} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Justice System Efficiency</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.justiceSystemEfficiency ?? 50}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.justiceSystemEfficiency ?? 50} className="h-2" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Public Order */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-semibold">
            <Activity className="h-4 w-4" />
            Public Order
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Protest Frequency</span>
                <span className="font-medium">
                  <NumberFlowDisplay value={metrics?.protestFrequency ?? 5} /> /year
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Riot Risk</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.riotRisk ?? 10}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.riotRisk ?? 10} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Civil Disobedience</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.civilDisobedience ?? 5}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.civilDisobedience ?? 5} className="h-2" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Social Cohesion */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-semibold">
            <Heart className="h-4 w-4" />
            Social Cohesion
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Social Cohesion</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.socialCohesion ?? 70}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.socialCohesion ?? 70} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ethnic Tension</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.ethnicTension ?? 20}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.ethnicTension ?? 20} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Political Polarization</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.politicalPolarization ?? 40}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.politicalPolarization ?? 40} className="h-2" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Public Confidence */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-semibold">
            <Eye className="h-4 w-4" />
            Public Confidence
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trust in Government</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.trustInGovernment ?? 50}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.trustInGovernment ?? 50} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trust in Police</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.trustInPolice ?? 55}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.trustInPolice ?? 55} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fear of Crime</span>
                <span className="font-medium">
                  <NumberFlowDisplay
                    value={metrics?.fearOfCrime ?? 35}
                    format="decimal"
                    decimalPlaces={0}
                  />
                  %
                </span>
              </div>
              <Progress value={metrics?.fearOfCrime ?? 35} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
