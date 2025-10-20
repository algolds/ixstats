"use client";

import React from 'react';
import { TaxBuilder } from '~/components/tax-system/TaxBuilder';
import { toast } from 'sonner';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import type { EconomicInputs, EconomyBuilderState } from '~/types/economy-builder';

interface TaxSystemStepProps {
  countryId: string | null;
  activeTaxSystemData: TaxBuilderState | null;
  economicInputs: EconomicInputs;
  economyBuilder: EconomyBuilderState;
  selectedComponents: EconomicComponentType[];
  governmentBuilderData?: any;
  onUpdate: (taxSystem: TaxBuilderState) => Promise<void>;
  onCreate: (taxSystem: TaxBuilderState) => Promise<void>;
  onRefetch: () => Promise<void>;
  onDraftChange?: (taxSystem: TaxBuilderState) => void;
}

export function TaxSystemStep({
  countryId,
  activeTaxSystemData,
  economicInputs,
  economyBuilder,
  selectedComponents,
  governmentBuilderData,
  onUpdate,
  onCreate,
  onRefetch,
  onDraftChange,
}: TaxSystemStepProps) {
  const handleSave = async (taxSystem: TaxBuilderState) => {
    if (!countryId) {
      toast.error('Country ID is required to save tax system');
      return;
    }

    try {
      // Try to update first
      try {
        await onUpdate(taxSystem);
        toast.success('Tax system updated successfully');
        await onRefetch();
      } catch (updateError: any) {
        // If update fails because record doesn't exist, create it
        const errorMessage = updateError?.message || '';
        if (errorMessage.includes('No record was found') || errorMessage.includes('P2025')) {
          await onCreate(taxSystem);
          toast.success('Tax system created successfully');
          await onRefetch();
        } else {
          throw updateError;
        }
      }
    } catch (error) {
      console.error('[TaxSystemStep] Failed to save tax system:', error);
      toast.error('Failed to save tax system');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">
          Tax System
        </h2>
      </div>
      <TaxBuilder
        countryId={countryId || ""}
        initialData={activeTaxSystemData || undefined}
        onChange={(taxSystem: TaxBuilderState) => {
          console.log('[TaxSystemStep] Tax system updated', taxSystem);
          onDraftChange?.(taxSystem);
        }}
        onSave={handleSave}
        economicData={{
          gdp: economicInputs.coreIndicators?.nominalGDP || 0,
          sectors: economyBuilder.structure.sectors ?? economyBuilder.sectors,
          population: economicInputs.coreIndicators?.totalPopulation || 1000000,
        }}
        governmentData={governmentBuilderData}
        enableAutoSync={true}
      />
    </div>
  );
}
