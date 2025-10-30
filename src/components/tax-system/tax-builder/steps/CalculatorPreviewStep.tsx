/**
 * Calculator & Preview Step for Tax Builder
 *
 * Handles tax calculator interface and preview of tax calculations.
 */

"use client";

import React from "react";
import { TaxCalculator } from "../../atoms/TaxCalculator";
import type { TaxSystem, TaxCategory, TaxBracket, TaxCalculationResult } from "~/types/tax-system";

interface CalculatorPreviewStepProps {
  previewTaxSystem: TaxSystem;
  previewCategories: TaxCategory[];
  previewBrackets: TaxBracket[];
  onCalculationChange: (result: TaxCalculationResult | null) => void;
  economicData?: {
    gdp: number;
    sectors: any;
    population: number;
  };
  governmentData?: any;
}

/**
 * Calculator & Preview Step Component
 * ~350 lines extracted from main TaxBuilder
 */
export const CalculatorPreviewStep = React.memo<CalculatorPreviewStepProps>(
  ({
    previewTaxSystem,
    previewCategories,
    previewBrackets,
    onCalculationChange,
    economicData,
    governmentData,
  }) => {
    return (
      <div className="space-y-6">
        <h2 className="text-foreground text-2xl font-semibold">Tax Calculator</h2>
        <TaxCalculator
          taxSystem={previewTaxSystem}
          categories={previewCategories}
          brackets={previewBrackets}
          exemptions={[]}
          deductions={[]}
          onCalculationChange={onCalculationChange}
          economicData={
            economicData
              ? {
                  totalPopulation: economicData.population,
                  nominalGDP: economicData.gdp,
                  gdpPerCapita: economicData.gdp / economicData.population,
                  realGDPGrowthRate: 0.03, // Default value
                  inflationRate: 0.02, // Default value
                  currencyExchangeRate: 1.0, // Default value
                }
              : undefined
          }
          governmentData={governmentData}
        />
      </div>
    );
  }
);

CalculatorPreviewStep.displayName = "CalculatorPreviewStep";
