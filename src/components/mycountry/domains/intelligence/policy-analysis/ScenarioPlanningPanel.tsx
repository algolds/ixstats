"use client";

/**
 * ScenarioPlanningPanel
 *
 * Scenario selector with outcome display. Users can choose between
 * predefined scenarios (baseline, high growth, fiscal consolidation,
 * welfare state) and view projected outcomes.
 *
 * @module ScenarioPlanningPanel
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Send, Activity } from "iconoir-react";
import type { ScenarioDefinition } from "~/hooks/usePolicyAnalytics";

interface ScenarioPlanningPanelProps {
  selectedScenario: string;
  setSelectedScenario: (value: string) => void;
  scenarios: ScenarioDefinition[];
}

const scenarioData: Record<
  string,
  {
    growth: string;
    growthColor: string;
    budget: string;
    budgetColor: string;
    risk: string;
    riskColor: string;
  }
> = {
  baseline: {
    growth: "+3.00%",
    growthColor: "text-emerald-600 dark:text-emerald-400",
    budget: "+0.5%",
    budgetColor: "text-emerald-600 dark:text-emerald-400",
    risk: "Low",
    riskColor: "text-blue-600 dark:text-blue-400",
  },
  high_growth: {
    growth: "+4.20%",
    growthColor: "text-emerald-600 dark:text-emerald-400",
    budget: "-2.1%",
    budgetColor: "text-red-600 dark:text-red-400",
    risk: "High",
    riskColor: "text-amber-600 dark:text-amber-400",
  },
  fiscal_consolidation: {
    growth: "+2.10%",
    growthColor: "text-amber-600 dark:text-amber-400",
    budget: "+3.8%",
    budgetColor: "text-emerald-600 dark:text-emerald-400",
    risk: "Medium",
    riskColor: "text-amber-600 dark:text-amber-400",
  },
  welfare_state: {
    growth: "+2.50%",
    growthColor: "text-emerald-600 dark:text-emerald-400",
    budget: "-1.5%",
    budgetColor: "text-red-600 dark:text-red-400",
    risk: "Low",
    riskColor: "text-blue-600 dark:text-blue-400",
  },
};

export const ScenarioPlanningPanel = React.memo(function ScenarioPlanningPanel({
  selectedScenario,
  setSelectedScenario,
  scenarios,
}: ScenarioPlanningPanelProps) {
  const currentScenario = scenarios.find((s) => s.id === selectedScenario);
  const data = scenarioData[selectedScenario] || scenarioData.baseline!;

  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Scenario Planning Tool
        </CardTitle>
        <CardDescription>Explore what-if scenarios for policy changes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-3 block">Select Scenario</Label>
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedScenario && (
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-6">
            <h4 className="mb-2 font-semibold">{currentScenario?.name}</h4>
            <p className="text-muted-foreground mb-4 text-sm">{currentScenario?.description}</p>

            <div className="space-y-3">
              <div className="bg-background flex items-center justify-between rounded-lg p-3">
                <span className="text-sm font-medium">Projected GDP Growth</span>
                <Badge variant="outline" className={data.growthColor}>
                  {data.growth}
                </Badge>
              </div>
              <div className="bg-background flex items-center justify-between rounded-lg p-3">
                <span className="text-sm font-medium">Budget Impact</span>
                <Badge variant="outline" className={data.budgetColor}>
                  {data.budget}
                </Badge>
              </div>
              <div className="bg-background flex items-center justify-between rounded-lg p-3">
                <span className="text-sm font-medium">Risk Level</span>
                <Badge variant="outline" className={data.riskColor}>
                  {data.risk}
                </Badge>
              </div>
            </div>

            <Button className="mt-6 w-full" variant="default">
              <Send className="mr-2 h-4 w-4" />
              Run Detailed Simulation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
