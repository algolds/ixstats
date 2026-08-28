"use client";

import React from "react";
import { formatExactCurrency } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Calculator, SystemRestart as Loader2, Flash as Zap } from "iconoir-react";

import type {
  TaxSystem,
  TaxCategory,
  TaxBracket,
  TaxExemption,
  TaxDeduction,
  TaxCalculationResult,
} from "~/types/tax-system";
import type { CoreEconomicIndicatorsData } from "~/types/economics";
import type { GovernmentBuilderState } from "~/types/government";
import { ComponentType } from "~/lib/enums";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";

import { useTaxCalculatorState } from "./calculator/useTaxCalculatorState";
import { TaxCalculatorSummary } from "./calculator/TaxCalculatorSummary";
import { TaxBracketBreakdown } from "./calculator/TaxBracketBreakdown";
import { TaxSimulatorInputs } from "./calculator/TaxSimulatorInputs";
import { TaxOptimizationTips } from "./calculator/TaxOptimizationTips";

const EMPTY_ARRAY: any[] = [];

export interface TaxCalculatorProps {
  taxSystem: TaxSystem;
  categories: TaxCategory[];
  brackets: TaxBracket[];
  exemptions: TaxExemption[];
  deductions: TaxDeduction[];
  onCalculationChange?: (result: TaxCalculationResult | null) => void;
  economicData?: CoreEconomicIndicatorsData;
  governmentData?: GovernmentBuilderState;
  calculationMode?: "individual" | "corporate" | "both";
  governmentComponents?: ComponentType[];
  economicComponents?: EconomicComponentType[];
  sectorData?: {
    id: string;
    name: string;
    gdpContribution: number;
    taxRate?: number;
  }[];
  countryId?: string;
  enableLiveCalculation?: boolean;
}

export const TaxCalculator = React.memo(function TaxCalculator({
  taxSystem,
  categories,
  brackets,
  exemptions,
  deductions,
  onCalculationChange,
  economicData,
  governmentData,
  calculationMode: initialCalculationMode = "individual",
  governmentComponents = EMPTY_ARRAY,
  economicComponents = EMPTY_ARRAY,
  sectorData = EMPTY_ARRAY,
  countryId,
  enableLiveCalculation = false,
}: TaxCalculatorProps) {
  const state = useTaxCalculatorState({
    taxSystem,
    categories,
    brackets,
    exemptions,
    deductions,
    onCalculationChange,
    economicData,
    governmentData,
    calculationMode: initialCalculationMode,
    governmentComponents,
    economicComponents,
    sectorData,
    countryId,
    enableLiveCalculation,
  });

  const formatCurrency = (amount: number) => {
    return formatExactCurrency(amount, governmentData?.structure?.budgetCurrency || "USD");
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/40">
              <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span>Tax Calculator</span>
            <Badge variant="outline">{taxSystem.taxSystemName}</Badge>
            {enableLiveCalculation && (
              <Badge
                variant="secondary"
                className="ml-auto bg-gradient-to-r from-purple-500 to-blue-500 text-white"
              >
                <Zap className="mr-1 h-3 w-3" />
                Live Calculation
              </Badge>
            )}
            {state.liveTaxCalculation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </CardTitle>

          {/* Calculator Mode Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Calculator Mode:</Label>
            <Tabs
              value={state.calculatorMode}
              onValueChange={(value) =>
                state.setCalculatorMode(value as "individual" | "corporate")
              }
              className="w-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="corporate">Corporate</TabsTrigger>
              </TabsList>
            </Tabs>
            {economicData && (
              <Badge variant="secondary" className="ml-auto">
                GDP/capita: $
                {(
                  economicData.gdpPerCapita ||
                  economicData.nominalGDP / (economicData.totalPopulation || 1)
                ).toFixed(0)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Results Summary */}
        <TaxCalculatorSummary
          calculationResult={state.calculationResult}
          corporateCalculationResult={state.corporateCalculationResult}
          calculatorMode={state.calculatorMode}
          formatCurrency={formatCurrency}
          formatPercentage={formatPercentage}
        />

        <Tabs
          value={state.activeTab}
          onValueChange={(value) => state.setActiveTab(value as any)}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator">Calculator Inputs</TabsTrigger>
            <TabsTrigger value="breakdown">Bracket Breakdown</TabsTrigger>
            <TabsTrigger value="suggestions">Optimization Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6">
            <TaxSimulatorInputs
              income={state.income}
              setIncome={state.setIncome}
              taxYear={state.taxYear}
              setTaxYear={state.setTaxYear}
              calculatorMode={state.calculatorMode}
              deductions={deductions}
              exemptions={exemptions}
              selectedDeductions={state.selectedDeductions}
              selectedExemptions={state.selectedExemptions}
              setSelectedDeductions={state.setSelectedDeductions}
              setSelectedExemptions={state.setSelectedExemptions}
            />
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            <TaxBracketBreakdown
              calculationResult={
                state.calculatorMode === "individual"
                  ? state.calculationResult
                  : state.corporateCalculationResult
              }
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
            />
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-6">
            <TaxOptimizationTips suggestions={state.suggestions} formatCurrency={formatCurrency} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
