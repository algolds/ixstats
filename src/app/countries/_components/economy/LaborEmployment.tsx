
"use client";

import React, { useState } from "react";
import {
  Briefcase,
  Users,
  Clock,
  BarChart2,
  Info,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { formatPopulation, formatPercentage, formatCurrency } from "./utils";

export interface LaborEmploymentData {
  laborForceParticipationRate: number;
  employmentRate: number;
  unemploymentRate: number;
  totalWorkforce: number;
  averageWorkweekHours: number;
  minimumWage: number;
  averageAnnualIncome: number;
}

export interface RealCountryData {
  name: string;
  unemploymentRate: number;
}

interface LaborEmploymentProps {
  laborData: LaborEmploymentData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  /** SERVER ACTION */
  onLaborDataChangeAction: (d: LaborEmploymentData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function LaborEmployment({
  laborData,
  referenceCountry,
  totalPopulation,
  onLaborDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: LaborEmploymentProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");

  function handleField<K extends keyof LaborEmploymentData>(
    field: K,
    value: number
  ) {
    const next = { ...laborData, [field]: value };
    if (field === "laborForceParticipationRate") {
      const wap = totalPopulation * 0.65;
      next.totalWorkforce = Math.round((value / 100) * wap);
    } else if (field === "unemploymentRate") {
      next.employmentRate = 100 - value;
    } else if (field === "employmentRate") {
      next.unemploymentRate = 100 - value;
    }
    onLaborDataChangeAction(next);
  }

  // Derived breakdown
  const wap = Math.round(totalPopulation * 0.65);
  const lf = Math.round((laborData.laborForceParticipationRate / 100) * wap);
  const employed = Math.round((laborData.employmentRate / 100) * lf);
  const unemployed = lf - employed;

  function getHealth() {
    if (laborData.unemploymentRate <= 4) {
      return { label: "Full Employment", color: "text-green-600" };
    }
    if (laborData.unemploymentRate <= 7) {
      return { label: "Healthy", color: "text-blue-600" };
    }
    if (laborData.unemploymentRate <= 12) {
      return { label: "Moderate Concern", color: "text-yellow-600" };
    }
    return { label: "High Unemployment", color: "text-red-600" };
  }
  const health = getHealth();

  const metrics = [
    {
      label: "Participation Rate",
      field: "laborForceParticipationRate" as const,
      value: laborData.laborForceParticipationRate,
      target: 65,
      reverse: false,
      description: "% of working-age population",
    },
    {
      label: "Employment Rate",
      field: "employmentRate" as const,
      value: laborData.employmentRate,
      target: 95,
      reverse: false,
      description: "% of labor force employed",
    },
    {
      label: "Unemployment Rate",
      field: "unemploymentRate" as const,
      value: laborData.unemploymentRate,
      target: 5,
      reverse: true,
      description: "% seeking work",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Labor & Employment
          </h3>
          <p className="text-sm text-muted-foreground">
            Workforce participation & market dynamics
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList className="grid grid-cols-2 w-[200px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Breakdown Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Labor Force Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 text-center gap-4">
            <div>
              <div className="text-2xl font-bold">
                {formatPopulation(totalPopulation)}
              </div>
              <div className="text-xs text-muted-foreground">Total Pop</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {formatPopulation(wap)}
              </div>
              <div className="text-xs text-muted-foreground">
                Working Age
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatPopulation(lf)}
              </div>
              <div className="text-xs text-muted-foreground">Labor Force</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-lg font-bold text-green-600">
                  {formatPopulation(employed)}
                </div>
                <div className="text-xs text-muted-foreground">Employed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {formatPopulation(unemployed)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Unemployed
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <TabsContent value="overview" className="space-y-4">
        {metrics.map((m) => {
          const pct = m.reverse
            ? Math.max(0, 100 - m.value)
            : Math.min(100, (m.value / m.target) * 100);
          return (
            <Card key={m.label}>
              <CardContent>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm font-medium">{m.label}</Label>
                  <div className="text-sm font-semibold">
                    {m.value.toFixed(1)}%
                  </div>
                </div>
                {isReadOnly ? (
                  <Progress value={pct} className="w-full" />
                ) : (
                  <>
                    <Slider
                      value={[m.value]}
                      onValueChange={(vals) => {
                        const v = vals?.[0] ?? 0;
                        handleField(m.field, v);
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                      className="w-full mb-2"
                    />
                    <Progress value={pct} className="w-full" />
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {m.description}
                  {referenceCountry && m.field === "unemploymentRate" && (
                    <> • Ref: {referenceCountry.unemploymentRate.toFixed(1)}%</>
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* Detailed Inputs */}
      <TabsContent value="detailed" className="space-y-6">
        {/* Work Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Work Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="hours">Avg Workweek (hrs)</Label>
              {isReadOnly ? (
                <div className="text-2xl font-bold">
                  {laborData.averageWorkweekHours}h
                </div>
              ) : (
                <>
                  <Slider
                    id="hours"
                    value={[laborData.averageWorkweekHours]}
                    onValueChange={(vals) => {
                      const v = vals?.[0] ?? 0;
                      handleField("averageWorkweekHours", v);
                    }}
                    min={20}
                    max={60}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>20h</span>
                    <span>{laborData.averageWorkweekHours}h</span>
                    <span>60h</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <Label htmlFor="minw">Minimum Wage ($/h)</Label>
              {isReadOnly ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    ${laborData.minimumWage.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Annual: $
                    {(
                      laborData.minimumWage *
                      laborData.averageWorkweekHours *
                      52
                    ).toLocaleString()}
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    id="minw"
                    type="number"
                    step={0.25}
                    value={laborData.minimumWage}
                    onChange={(e) =>
                      handleField("minimumWage", +e.target.value || 0)
                    }
                  />
                  <div className="text-xs text-muted-foreground">
                    Annual: $
                    {(
                      laborData.minimumWage *
                      laborData.averageWorkweekHours *
                      52
                    ).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Income & Workforce */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Income & Workforce
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="avginc">Avg Annual Income ($)</Label>
              {isReadOnly ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    ${laborData.averageAnnualIncome.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ≈ $
                    {(
                      laborData.averageAnnualIncome /
                      (laborData.averageWorkweekHours * 52)
                    ).toFixed(2)}
                    /h
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    id="avginc"
                    type="number"
                    step={1000}
                    value={laborData.averageAnnualIncome}
                    onChange={(e) =>
                      handleField("averageAnnualIncome", +e.target.value || 0)
                    }
                  />
                  <div className="text-xs text-muted-foreground">
                    ≈ $
                    {(
                      laborData.averageAnnualIncome /
                      (laborData.averageWorkweekHours * 52)
                    ).toFixed(2)}
                    /h
                  </div>
                </>
              )}
            </div>
            <div>
              <Label htmlFor="tw">Total Workforce</Label>
              {isReadOnly ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {formatPopulation(laborData.totalWorkforce)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(
                      (laborData.totalWorkforce / totalPopulation) *
                      100
                    ).toFixed(1)}
                    % of pop
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    id="tw"
                    type="number"
                    step={1000}
                    value={laborData.totalWorkforce}
                    onChange={(e) =>
                      handleField("totalWorkforce", +e.target.value || 0)
                    }
                  />
                  <div className="text-xs text-muted-foreground">
                    {(
                      (laborData.totalWorkforce / totalPopulation) *
                      100
                    ).toFixed(1)}
                    % of pop
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Labor Market Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Labor Market Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Participation Rate */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Participation Rate
                </div>
                <div className="text-2xl font-bold">
                  {laborData.laborForceParticipationRate.toFixed(1)}%
                </div>
                <Badge
                  variant={
                    laborData.laborForceParticipationRate >= 60
                      ? "default"
                      : "secondary"
                  }
                >
                  {laborData.laborForceParticipationRate >= 60 ? "Good" : "Low"}
                </Badge>
              </div>

              {/* Employment-Population Ratio */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Employment‐Population Ratio
                </div>
                <div className="text-2xl font-bold">
                  {((employed / totalPopulation) * 100).toFixed(1)}%
                </div>
                <Badge
                  variant={employed / totalPopulation > 0.5 ? "default" : "secondary"}
                >
                  {employed / totalPopulation > 0.5 ? "Strong" : "Weak"}
                </Badge>
              </div>

              {/* Labor Productivity */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Labor Productivity
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    laborData.averageAnnualIncome /
                      laborData.averageWorkweekHours /
                      52
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  per hour worked
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Health Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">
            Employment Health: <span className={health.color}>{health.label}</span>
          </div>
          <p className="text-sm">
            {laborData.unemploymentRate <= 4
              ? "Full employment—watch for shortages."
              : laborData.unemploymentRate <= 7
              ? "Healthy levels."
              : laborData.unemploymentRate <= 12
              ? "Moderate—consider job programs."
              : "High—urgent intervention."}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}