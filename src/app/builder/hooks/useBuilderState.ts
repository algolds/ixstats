// Shared state management hook for Atomic Builder
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

import { useState, useCallback, useEffect, useRef } from 'react';
import type { BuilderStep } from '../components/enhanced/builderConfig';
import type { RealCountryData, EconomicInputs } from '../lib/economy-data-service';
import type { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import { safeGetItemSync, safeSetItemSync, safeRemoveItemSync } from '~/lib/localStorageMutex';
import { createDefaultEconomicInputs } from '../lib/economy-data-service';
import { unifiedBuilderService } from '../services/UnifiedBuilderIntegrationService';

export interface BuilderState {
  step: BuilderStep;
  selectedCountry: RealCountryData | null;
  economicInputs: EconomicInputs | null;
  governmentComponents: ComponentType[];
  taxSystemData: TaxBuilderState | null;
  governmentStructure: any;
  completedSteps: BuilderStep[];
  // Tab state for each step
  activeCoreTab: string;
  activeGovernmentTab: string;
  activeEconomicsTab: string;
  showAdvancedMode: boolean;
}

export interface UseBuilderStateReturn {
  builderState: BuilderState;
  setBuilderState: React.Dispatch<React.SetStateAction<BuilderState>>;
  lastSaved: Date | null;
  isAutoSaving: boolean;
  updateEconomicInputs: (inputs: EconomicInputs) => void;
  updateGovernmentComponents: (components: ComponentType[]) => void;
  updateGovernmentStructure: (structure: any) => void;
  updateTaxSystem: (taxData: TaxBuilderState) => void;
  updateStep: (step: BuilderStep, data?: any) => void;
  clearDraft: () => void;
  canAccessStep: (step: BuilderStep) => boolean;
}

const initialState: BuilderState = {
  step: 'foundation',
  selectedCountry: null,
  economicInputs: null,
  governmentComponents: [],
  taxSystemData: null,
  governmentStructure: null,
  completedSteps: [],
  activeCoreTab: 'identity',
  activeGovernmentTab: 'components',
  activeEconomicsTab: 'economy',
  showAdvancedMode: false,
};

export function useBuilderState(): UseBuilderStateReturn {
  const [builderState, setBuilderState] = useState<BuilderState>(initialState);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const quickStartProcessed = useRef(false);

  // Load saved state on mount
  useEffect(() => {
    try {
      const quickStartSection = safeGetItemSync('builder_quick_start_section');

      if (quickStartSection === 'core' && !quickStartProcessed.current) {
        quickStartProcessed.current = true;

        setBuilderState(prev => ({
          ...prev,
          step: 'core',
          selectedCountry: null,
          economicInputs: createDefaultEconomicInputs(),
          completedSteps: [...new Set([...prev.completedSteps, 'foundation' as BuilderStep])]
        }));
        safeRemoveItemSync('builder_quick_start_section');
        return;
      }

      if (!quickStartProcessed.current) {
        const savedState = safeGetItemSync('builder_state');
        const savedLastSaved = safeGetItemSync('builder_last_saved');

        if (savedState) {
          const parsedState = JSON.parse(savedState);
          setBuilderState(parsedState);
        }

        if (savedLastSaved) {
          setLastSaved(new Date(savedLastSaved));
        }
      }
    } catch (error) {
      // Failed to load saved state, continue with default
    }
  }, []);

  // Autosave state to localStorage
  useEffect(() => {
    const saveState = async () => {
      setIsAutoSaving(true);
      try {
        safeSetItemSync('builder_state', JSON.stringify(builderState));
        const now = new Date();
        safeSetItemSync('builder_last_saved', now.toISOString());
        setLastSaved(now);
      } catch (error) {
        // Failed to save state
      } finally {
        setIsAutoSaving(false);
      }
    };

    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [builderState]);

  // Autosave on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        safeSetItemSync('builder_state', JSON.stringify(builderState));
        safeSetItemSync('builder_last_saved', new Date().toISOString());
      } catch (error) {
        // Failed to save state on unload
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [builderState]);

  // Unified Builder Integration - Sync all data across subsystems
  useEffect(() => {
    if (builderState.economicInputs?.nationalIdentity) {
      unifiedBuilderService.updateNationalIdentity({
        countryName: builderState.economicInputs.nationalIdentity.countryName,
        capital: builderState.economicInputs.nationalIdentity.capitalCity,
        currency: builderState.economicInputs.nationalIdentity.currency,
        language: builderState.economicInputs.nationalIdentity.officialLanguages || '',
        flag: undefined,
        anthem: builderState.economicInputs.nationalIdentity.nationalAnthem,
        motto: builderState.economicInputs.nationalIdentity.motto
      });
    }

    if (builderState.governmentComponents.length > 0) {
      unifiedBuilderService.updateGovernmentComponents(builderState.governmentComponents);
      const suggested = unifiedBuilderService.getSuggestedEconomicComponents();
      console.log(`[UnifiedBuilder] Auto-selected ${suggested.length} economic components`);
    }

    if (builderState.governmentStructure) {
      unifiedBuilderService.updateGovernmentBuilder(builderState.governmentStructure);
    }

    if (builderState.taxSystemData) {
      unifiedBuilderService.updateTaxBuilder(builderState.taxSystemData);
    }
  }, [
    builderState.economicInputs?.nationalIdentity,
    builderState.governmentComponents,
    builderState.governmentStructure,
    builderState.taxSystemData
  ]);

  // Update handlers
  const updateEconomicInputs = useCallback((inputs: EconomicInputs) => {
    setBuilderState(prev => ({ ...prev, economicInputs: inputs }));
  }, []);

  const updateGovernmentComponents = useCallback((components: ComponentType[]) => {
    setBuilderState(prev => ({ ...prev, governmentComponents: components }));
  }, []);

  const updateGovernmentStructure = useCallback((structure: any) => {
    setBuilderState(prev => ({ ...prev, governmentStructure: structure }));
  }, []);

  const updateTaxSystem = useCallback((taxData: TaxBuilderState) => {
    setBuilderState(prev => ({ ...prev, taxSystemData: taxData }));
  }, []);

  const updateStep = useCallback((step: BuilderStep, data?: any) => {
    setBuilderState(prev => {
      const newState = { ...prev };

      if (!prev.completedSteps.includes(step)) {
        newState.completedSteps = [...prev.completedSteps, step];
      }

      switch (step) {
        case 'foundation':
          newState.selectedCountry = data;
          newState.step = 'core';
          if (data) {
            newState.economicInputs = createDefaultEconomicInputs(data);
          }
          break;
        case 'core':
          newState.economicInputs = data;
          newState.step = 'government';
          break;
        case 'government':
          newState.governmentComponents = data;
          newState.step = 'economics';
          break;
        case 'economics':
          newState.economicInputs = data;
          newState.step = 'preview';
          break;
      }

      return newState;
    });
  }, []);

  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('builder_state');
        localStorage.removeItem('builder_last_saved');
      }
      setLastSaved(null);
      setBuilderState(initialState);
    } catch (error) {
      // Failed to clear draft
    }
  }, []);

  const canAccessStep = useCallback((step: BuilderStep): boolean => {
    const stepOrder: BuilderStep[] = ['foundation', 'core', 'government', 'economics', 'preview'];
    const currentIndex = stepOrder.indexOf(builderState.step);
    const targetIndex = stepOrder.indexOf(step);
    return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
  }, [builderState.step, builderState.completedSteps]);

  return {
    builderState,
    setBuilderState,
    lastSaved,
    isAutoSaving,
    updateEconomicInputs,
    updateGovernmentComponents,
    updateGovernmentStructure,
    updateTaxSystem,
    updateStep,
    clearDraft,
    canAccessStep,
  };
}
