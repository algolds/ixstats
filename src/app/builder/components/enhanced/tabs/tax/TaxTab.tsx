"use client";

import React, { useMemo, useCallback } from "react";
import { TaxBuilder } from "~/components/mycountry/domains/government/tax/TaxBuilder";
import { getTaxOptimization } from "../utils/sectorCalculations";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
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
  flat?: boolean;
}

export function TaxTab({
  countryId,
  economicInputs,
  economyBuilder,
  governmentBuilderData,
  selectedComponents,
  activeTaxBuilderState,
  onTaxStateChange,
  flat,
}: TaxTabProps) {
  // Memoize taxOpt to avoid recreating it on every render
  const taxOpt = useMemo(() => getTaxOptimization(selectedComponents), [selectedComponents]);

  const economicData = useMemo(() => {
    const gdp = economicInputs.coreIndicators?.nominalGDP || 0;
    const population = economicInputs.coreIndicators?.totalPopulation || 1000000;
    return {
      gdp,
      sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
      population,
      gdpPerCapita: population > 0 ? gdp / population : 0,
    };
  }, [
    economicInputs.coreIndicators?.nominalGDP,
    economyBuilder.structure.sectors,
    economyBuilder.sectors,
    economicInputs.coreIndicators?.totalPopulation,
  ]);

  // Memoize componentOptimization to prevent passing unstable objects
  const componentOptimization = useMemo(() => {
    if (taxOpt && taxOpt.componentCount > 0) {
      return {
        optimalCorporateRate: taxOpt.optimalCorporateRate,
        optimalIncomeRate: taxOpt.optimalIncomeRate,
        revenueEfficiency: taxOpt.revenueEfficiency,
        componentCount: taxOpt.componentCount,
      };
    }
    return null;
  }, [taxOpt]);

  // Memoize onChange callback to prevent recreation on every render
  const handleTaxBuilderChange = useCallback(
    (state: TaxBuilderState) => {
      onTaxStateChange(state);
    },
    [onTaxStateChange]
  );

  return (
    <div className="w-full space-y-6">
      <TaxBuilder
        countryId={countryId || ""}
        initialData={activeTaxBuilderState}
        onChange={handleTaxBuilderChange}
        flat={flat}
        economicData={economicData}
        governmentData={governmentBuilderData}
        enableAutoSync={!!countryId}
        hideSaveButton={true}
        componentOptimization={componentOptimization}
      />
    </div>
  );
}
