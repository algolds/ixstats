"use client";

import React from "react";
import { TaxBuilder } from "~/components/tax-system/TaxBuilder";
import { getTaxOptimization } from "../utils/sectorCalculations";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import type { EconomicInputs } from "../../../../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

interface TaxTabProps {
  countryId?: string;
  economicInputs: EconomicInputs;
  economyBuilder: EconomyBuilderState;
  governmentBuilderData?: any;
  selectedComponents: EconomicComponentType[];
  activeTaxBuilderState: TaxBuilderState;
  onTaxStateChange: (state: TaxBuilderState) => void;
}

export function TaxTab({
  countryId,
  economicInputs,
  economyBuilder,
  governmentBuilderData,
  selectedComponents,
  activeTaxBuilderState,
  onTaxStateChange,
}: TaxTabProps) {
  const taxOpt = getTaxOptimization(selectedComponents);

  return (
    <div className="space-y-6">
      <TaxBuilder
        countryId={countryId || ""}
        initialData={activeTaxBuilderState}
        onChange={(state) => onTaxStateChange(state)}
        economicData={{
          gdp: economicInputs.coreIndicators?.nominalGDP || 0,
          sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
          population: economicInputs.coreIndicators?.totalPopulation || 1000000,
        }}
        governmentData={governmentBuilderData}
        enableAutoSync={!!countryId}
        hideSaveButton={true}
        componentOptimization={
          taxOpt && taxOpt.componentCount > 0
            ? {
                optimalCorporateRate: taxOpt.optimalCorporateRate,
                optimalIncomeRate: taxOpt.optimalIncomeRate,
                revenueEfficiency: taxOpt.revenueEfficiency,
                componentCount: taxOpt.componentCount,
              }
            : null
        }
      />
    </div>
  );
}
