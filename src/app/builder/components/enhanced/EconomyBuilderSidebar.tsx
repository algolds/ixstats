"use client";

import React from 'react';
import { BuilderIntegrationSidebar } from './BuilderIntegrationSidebar';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import type { EconomicHealthMetrics } from '~/types/economy-builder';

export interface EconomyBuilderSidebarProps {
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics?: EconomicHealthMetrics;
  maxComponents?: number;
}

/**
 * Economy Builder Sidebar Component
 *
 * Provides a sidebar for the economy builder showing selected components,
 * health metrics, and integration status.
 */
export function EconomyBuilderSidebar({
  selectedComponents,
  economicHealthMetrics,
  maxComponents = 12
}: EconomyBuilderSidebarProps) {
  return (
    <div className="w-80 flex-shrink-0 sticky top-4 self-start">
      <BuilderIntegrationSidebar
        selectedComponents={selectedComponents}
        maxComponents={maxComponents}
        economicHealthMetrics={economicHealthMetrics}
      />
    </div>
  );
}
