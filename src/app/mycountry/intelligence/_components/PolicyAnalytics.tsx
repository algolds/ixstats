"use client";

/**
 * Policy Analytics Component (Orchestrator)
 *
 * Thin orchestrator that composes the policy analysis dashboard from
 * the usePolicyAnalytics hook and extracted sub-components.
 *
 * Features:
 * - Policy impact forecasting with interactive controls
 * - Current policy effectiveness metrics
 * - Atomic component synergy analysis
 * - Comparative policy analysis vs similar countries
 * - Scenario planning tools with what-if simulations
 *
 * Refactored from 771 lines to ~100 lines (modular architecture pattern).
 *
 * @module PolicyAnalytics
 */

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Send, Target, Zap, BarChart3, Activity } from "lucide-react";
import { usePolicyAnalytics } from "~/hooks/usePolicyAnalytics";
import {
  PolicyOverviewStats,
  PolicyForecastingPanel,
  PolicyEffectivenessPanel,
  SynergyAnalysisPanel,
  ComparativeAnalysisChart,
  ScenarioPlanningPanel,
} from "~/components/intelligence/policy-analysis";

interface PolicyAnalyticsProps {
  countryId: string;
  userId?: string;
}

export function PolicyAnalytics({ countryId, userId }: PolicyAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("forecasting");

  const {
    isLoading,
    components,
    policyEffectiveness,
    synergyAnalysis,
    comparativeData,
    simulatedTaxRate, setSimulatedTaxRate,
    simulatedEducationSpending, setSimulatedEducationSpending,
    simulatedHealthSpending, setSimulatedHealthSpending,
    simulatedDefenseSpending, setSimulatedDefenseSpending,
    simulatedImpact,
    selectedScenario, setSelectedScenario,
    scenarios,
  } = usePolicyAnalytics({ countryId, userId });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading policy analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {policyEffectiveness && (
        <PolicyOverviewStats
          policyEffectiveness={policyEffectiveness}
          componentCount={components?.length || 0}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="forecasting" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Forecasting</span>
          </TabsTrigger>
          <TabsTrigger value="effectiveness" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Effectiveness</span>
          </TabsTrigger>
          <TabsTrigger value="synergy" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Synergy</span>
          </TabsTrigger>
          <TabsTrigger value="comparative" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Comparative</span>
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Scenarios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forecasting">
          <PolicyForecastingPanel
            simulatedTaxRate={simulatedTaxRate}
            setSimulatedTaxRate={setSimulatedTaxRate}
            simulatedEducationSpending={simulatedEducationSpending}
            setSimulatedEducationSpending={setSimulatedEducationSpending}
            simulatedHealthSpending={simulatedHealthSpending}
            setSimulatedHealthSpending={setSimulatedHealthSpending}
            simulatedDefenseSpending={simulatedDefenseSpending}
            setSimulatedDefenseSpending={setSimulatedDefenseSpending}
            simulatedImpact={simulatedImpact}
          />
        </TabsContent>

        <TabsContent value="effectiveness">
          <PolicyEffectivenessPanel
            components={components}
            policyEffectiveness={policyEffectiveness}
          />
        </TabsContent>

        <TabsContent value="synergy">
          <SynergyAnalysisPanel synergyAnalysis={synergyAnalysis} />
        </TabsContent>

        <TabsContent value="comparative">
          <ComparativeAnalysisChart comparativeData={comparativeData} />
        </TabsContent>

        <TabsContent value="scenarios">
          <ScenarioPlanningPanel
            selectedScenario={selectedScenario}
            setSelectedScenario={setSelectedScenario}
            scenarios={scenarios}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
