"use client";

/**
 * PolicyForecastingPanel
 *
 * Forecasting tab content with 4 interactive sliders (Tax Rate, Education,
 * Healthcare, Defense) and the projected impact preview section.
 *
 * @module PolicyForecastingPanel
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import {
  Send,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Activity,
  WarningCircle as AlertCircle,
  CheckCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { SimulatedImpactData } from "~/hooks/usePolicyAnalytics";

interface PolicyForecastingPanelProps {
  simulatedTaxRate: number;
  setSimulatedTaxRate: (value: number) => void;
  simulatedEducationSpending: number;
  setSimulatedEducationSpending: (value: number) => void;
  simulatedHealthSpending: number;
  setSimulatedHealthSpending: (value: number) => void;
  simulatedDefenseSpending: number;
  setSimulatedDefenseSpending: (value: number) => void;
  simulatedImpact: SimulatedImpactData;
}

export const PolicyForecastingPanel = React.memo(function PolicyForecastingPanel({
  simulatedTaxRate,
  setSimulatedTaxRate,
  simulatedEducationSpending,
  setSimulatedEducationSpending,
  simulatedHealthSpending,
  setSimulatedHealthSpending,
  simulatedDefenseSpending,
  setSimulatedDefenseSpending,
  simulatedImpact,
}: PolicyForecastingPanelProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-indigo-600" />
          Policy Impact Forecasting
        </CardTitle>
        <CardDescription>
          Adjust policy parameters to see projected economic impacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tax Rate Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Tax Rate</Label>
            <Badge variant="outline">{simulatedTaxRate}% of GDP</Badge>
          </div>
          <Slider
            value={[simulatedTaxRate]}
            onValueChange={(value) => setSimulatedTaxRate(value[0]!)}
            min={10}
            max={50}
            step={1}
            className="w-full"
          />
        </div>

        {/* Education Spending Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Education Spending</Label>
            <Badge variant="outline">{simulatedEducationSpending}% of GDP</Badge>
          </div>
          <Slider
            value={[simulatedEducationSpending]}
            onValueChange={(value) => setSimulatedEducationSpending(value[0]!)}
            min={5}
            max={25}
            step={1}
            className="w-full"
          />
        </div>

        {/* Healthcare Spending Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Healthcare Spending</Label>
            <Badge variant="outline">{simulatedHealthSpending}% of GDP</Badge>
          </div>
          <Slider
            value={[simulatedHealthSpending]}
            onValueChange={(value) => setSimulatedHealthSpending(value[0]!)}
            min={5}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Defense Spending Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Defense Spending</Label>
            <Badge variant="outline">{simulatedDefenseSpending}% of GDP</Badge>
          </div>
          <Slider
            value={[simulatedDefenseSpending]}
            onValueChange={(value) => setSimulatedDefenseSpending(value[0]!)}
            min={2}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Impact Preview */}
        <div className="mt-6 rounded-lg border bg-gradient-to-r from-indigo-50/50 to-purple-50/50 p-6 dark:from-indigo-950/20 dark:to-purple-950/20">
          <h4 className="mb-4 font-semibold">Projected Impacts</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Tax Revenue Change</span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    simulatedImpact.taxRevenue > 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {simulatedImpact.taxRevenue > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {simulatedImpact.taxRevenue.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.abs(simulatedImpact.taxRevenue)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">GDP Growth Rate</span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    simulatedImpact.gdpGrowth > 3 ? "text-green-600" : "text-yellow-600"
                  )}
                >
                  {simulatedImpact.gdpGrowth > 3 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  {simulatedImpact.gdpGrowth.toFixed(2)}%
                </span>
              </div>
              <Progress value={simulatedImpact.gdpGrowth * 10} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Budget Balance</span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    simulatedImpact.budgetBalance > 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {simulatedImpact.budgetBalance > 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {simulatedImpact.budgetBalance > 0 ? "Surplus" : "Deficit"}
                </span>
              </div>
              <Progress
                value={Math.min(100, (Math.abs(simulatedImpact.budgetBalance) / 1000000000) * 10)}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Policy Efficiency</span>
                <span className="font-semibold text-indigo-600">
                  {simulatedImpact.efficiency.toFixed(0)}%
                </span>
              </div>
              <Progress value={simulatedImpact.efficiency} className="h-2" />
            </div>
          </div>

          <Button className="mt-6 w-full" variant="default">
            <Send className="mr-2 h-4 w-4" />
            Apply Simulation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
