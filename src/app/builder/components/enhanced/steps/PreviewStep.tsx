"use client";

import React from 'react';
import { EconomyPreviewTab } from '../tabs/EconomyPreviewTab';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import type { EconomicInputs, EconomyBuilderState, EconomicHealthMetrics } from '~/types/economy-builder';

interface PreviewStepProps {
  economyBuilder: EconomyBuilderState;
  economicInputs: EconomicInputs;
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics: EconomicHealthMetrics;
}

export function PreviewStep({
  economyBuilder,
  economicInputs,
  selectedComponents,
  economicHealthMetrics,
}: PreviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">
          Economy Preview
        </h2>
      </div>

      <EconomyPreviewTab
        economyBuilder={economyBuilder}
        economicInputs={economicInputs}
        selectedComponents={selectedComponents}
        economicHealthMetrics={economicHealthMetrics}
      />
    </div>
  );
}
