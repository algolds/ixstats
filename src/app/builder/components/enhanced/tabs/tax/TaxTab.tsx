"use client";

import React, { useMemo, useCallback } from "react";
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

  // Memoize economicData object to prevent rendering loops and unnecessary useEffect triggers
  const economicData = useMemo(
    () => ({
      gdp: economicInputs.coreIndicators?.nominalGDP || 0,
      sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
      population: economicInputs.coreIndicators?.totalPopulation || 1000000,
    }),
    [
      economicInputs.coreIndicators?.nominalGDP,
      economyBuilder.structure.sectors,
      economyBuilder.sectors,
      economicInputs.coreIndicators?.totalPopulation,
    ]
  );

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
