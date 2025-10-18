/**
 * Atomic Government Integration Hook
 * 
 * This hook provides a unified interface for managing atomic government components
 * and their integration with the government builder and spending systems.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { GovernmentBuilderState } from '~/types/government';
import type { EconomicInputs } from '../lib/economy-data-service';
import { atomicIntegrationService } from '../services/AtomicIntegrationService';
import { generateGovernmentBuilderFromAtomicComponents } from '../utils/atomicGovernmentIntegration';
import { validateGovernmentSpendingSource } from '../utils/governmentValidation';

export interface UseAtomicGovernmentIntegrationResult {
  // State
  selectedComponents: ComponentType[];
  governmentBuilder: GovernmentBuilderState | null;
  economicInputs: EconomicInputs | null;
  isUpdating: boolean;
  errors: string[];
  warnings: string[];
  validation: {
    isValid: boolean;
    hasGovernmentBuilder: boolean;
    hasDepartments: boolean;
    hasBudgetAllocations: boolean;
    errorMessage?: string;
    warningMessage?: string;
  };

  // Actions
  setSelectedComponents: (components: ComponentType[]) => void;
  setGovernmentBuilder: (builder: GovernmentBuilderState) => void;
  setEconomicInputs: (inputs: EconomicInputs) => void;
  generateFromAtomicComponents: () => Promise<void>;
  clearErrors: () => void;
  clearWarnings: () => void;

  // Computed values
  hasAtomicComponents: boolean;
  needsGovernmentBuilder: boolean;
  canGenerateBuilder: boolean;
}

export function useAtomicGovernmentIntegration(
  initialComponents: ComponentType[] = [],
  initialGovernmentBuilder: GovernmentBuilderState | null = null,
  initialEconomicInputs: EconomicInputs | null = null
): UseAtomicGovernmentIntegrationResult {
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>(initialComponents);
  const [governmentBuilder, setGovernmentBuilder] = useState<GovernmentBuilderState | null>(initialGovernmentBuilder);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(initialEconomicInputs);
  const [integrationState, setIntegrationState] = useState(atomicIntegrationService.getState());

  // Subscribe to integration service updates
  useEffect(() => {
    const unsubscribe = atomicIntegrationService.subscribe(setIntegrationState);
    return unsubscribe;
  }, []);

  // Update integration service when state changes
  useEffect(() => {
    if (selectedComponents.length > 0) {
      atomicIntegrationService.updateComponents(selectedComponents);
    }
  }, [selectedComponents]);

  useEffect(() => {
    if (governmentBuilder) {
      atomicIntegrationService.updateGovernmentBuilder(governmentBuilder);
    }
  }, [governmentBuilder]);

  useEffect(() => {
    if (economicInputs) {
      atomicIntegrationService.updateEconomicInputs(economicInputs);
    }
  }, [economicInputs]);

  // Validation
  const validation = economicInputs
    ? validateGovernmentSpendingSource(economicInputs, governmentBuilder)
    : {
        isValid: false,
        hasGovernmentBuilder: !!governmentBuilder,
        hasDepartments: false,
        hasBudgetAllocations: false,
        errorMessage: 'Economic inputs are required'
      };

  // Computed values
  const hasAtomicComponents = selectedComponents.length > 0;
  const needsGovernmentBuilder = !validation.hasGovernmentBuilder || !validation.hasDepartments;
  const canGenerateBuilder = hasAtomicComponents && economicInputs !== null;

  // Generate government builder from atomic components
  const generateFromAtomicComponents = useCallback(async () => {
    if (!canGenerateBuilder) return;

    try {
      const generated = generateGovernmentBuilderFromAtomicComponents(
        selectedComponents,
        economicInputs!.governmentSpending.totalSpending,
        economicInputs!
      );

      setGovernmentBuilder(generated);
    } catch (error) {
      console.error('Failed to generate government builder from atomic components:', error);
    }
  }, [selectedComponents, economicInputs, canGenerateBuilder]);

  // Clear errors and warnings
  const clearErrors = useCallback(() => {
    atomicIntegrationService.clearUpdateQueue();
  }, []);

  const clearWarnings = useCallback(() => {
    atomicIntegrationService.clearUpdateQueue();
  }, []);

  return {
    // State
    selectedComponents,
    governmentBuilder,
    economicInputs,
    isUpdating: integrationState.isUpdating,
    errors: integrationState.errors,
    warnings: integrationState.warnings,
    validation,

    // Actions
    setSelectedComponents,
    setGovernmentBuilder,
    setEconomicInputs,
    generateFromAtomicComponents,
    clearErrors,
    clearWarnings,

    // Computed values
    hasAtomicComponents,
    needsGovernmentBuilder,
    canGenerateBuilder
  };
}
