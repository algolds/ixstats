/**
 * Shared state management hook for the Atomic Country Builder.
 * Composed of focused sub-hooks: useBuilderPersistence, useBuilderEditMode, useBuilderSync.
 */

import { useState, useCallback, useRef } from "react";
import { type BuilderStep, getStepsForMode } from "../components/enhanced/builderConfig";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { ComponentType } from "~/lib/enums";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { GovernmentBuilderState } from "~/types/government";
import { applyCoreStep, applyFoundationStep } from "../lib/step-transitions";
import { registerCustomCurrency } from "~/lib/utils";
import {
  type BuilderState,
  type UseBuilderStateReturn,
  baseInitialState,
  getInitialState,
  sanitizeEconomicInputs,
} from "./builderStateTypes";
import { useBuilderEditMode } from "./useBuilderEditMode";
import { useBuilderPersistence } from "./useBuilderPersistence";
import { useBuilderSync } from "./useBuilderSync";
import { isScratchOrImportOrigin } from "../lib/builder-theme";

export type { BuilderState, UseBuilderStateReturn };
export { baseInitialState, getInitialState, sanitizeEconomicInputs };

/**
 * Main builder state management hook for the Atomic Country Builder.
 */
export function useBuilderState(
  mode: "create" | "edit" = "create",
  countryId?: string
): UseBuilderStateReturn {
  const [builderState, setBuilderState] = useState<BuilderState>(() => getInitialState(mode));
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const localHadDataRef = useRef(false);

  // Edit mode hydration from database and local crash recovery
  const {
    isLoadingCountry,
    editModeInitialized,
    countryLoadError,
    retryCountryLoad,
    recoveredDraft,
    applyRecoveredDraft,
    dismissRecoveredDraft,
  } = useBuilderEditMode({
    mode,
    countryId,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
  });

  // Create mode synchronization (quick-start, wiki imports, and draft restore)
  useBuilderSync({
    mode,
    setBuilderState,
    setHasRestoredState,
    setLastSaved,
    localHadDataRef,
  });

  // Persistence to localStorage, server draft, and DB
  const {
    isAutoSaving,
    isSyncing,
    syncError,
    hasUnsyncedChanges,
    lastSyncedAt,
    triggerManualSave,
    clearDraft,
  } = useBuilderPersistence({
    mode,
    countryId,
    builderState,
    setBuilderState,
    isLoadingCountry,
    editModeInitialized,
    localHadDataRef,
    hasRestoredState,
    setHasRestoredState,
    lastSaved,
    setLastSaved,
    suspendLocalAutosave: recoveredDraft !== null,
  });

  // Update handlers
  const updateEconomicInputs = useCallback((inputs: EconomicInputs) => {
    setBuilderState((prev) => {
      const sanitized = sanitizeEconomicInputs(inputs);
      const nextState = { ...prev, economicInputs: sanitized };

      if (nextState.economyBuilderState) {
        const totalPopulation = sanitized.coreIndicators?.totalPopulation;
        if (totalPopulation !== undefined) {
          const participationRate =
            nextState.economyBuilderState.laborMarket?.laborForceParticipationRate ?? 65;
          const totalWorkforce =
            sanitized.laborEmployment?.totalWorkforce ||
            Math.round(totalPopulation * (participationRate / 100));
          nextState.economyBuilderState = {
            ...nextState.economyBuilderState,
            demographics: {
              ...nextState.economyBuilderState.demographics,
              totalPopulation,
            },
            laborMarket: {
              ...nextState.economyBuilderState.laborMarket,
              totalWorkforce,
            },
          };
        }
      }

      const currency = sanitized.nationalIdentity?.currency;
      if (currency) {
        const symbol = sanitized.nationalIdentity?.currencySymbol || "$";
        registerCustomCurrency(currency, symbol);

        if (nextState.governmentStructure?.structure) {
          nextState.governmentStructure = {
            ...nextState.governmentStructure,
            structure: {
              ...nextState.governmentStructure.structure,
              budgetCurrency: currency,
            },
          };
        }
      }
      return nextState;
    });
  }, []);

  const updateGovernmentComponents = useCallback((components: ComponentType[]) => {
    setBuilderState((prev) => ({ ...prev, governmentComponents: components }));
  }, []);

  const updateGovernmentStructure = useCallback((structure: GovernmentBuilderState) => {
    setBuilderState((prev) => ({ ...prev, governmentStructure: structure }));
  }, []);

  const updateTaxSystem = useCallback((taxData: TaxBuilderState) => {
    setBuilderState((prev) => ({ ...prev, taxSystemData: taxData }));
  }, []);

  const updateEconomyBuilderState = useCallback((economyState: EconomyBuilderState | null) => {
    setBuilderState((prev) => ({ ...prev, economyBuilderState: economyState }));
  }, []);

  const updateArchetypeId = useCallback((id: string | null) => {
    setBuilderState((prev) => ({ ...prev, selectedArchetypeId: id }));
  }, []);

  const updateStep = useCallback(
    (
      step: BuilderStep,
      data?: Partial<BuilderState> | EconomicInputs | RealCountryData | ComponentType[]
    ) => {
      setBuilderState((prev) => {
        const newState = { ...prev };

        if (!prev.completedSteps.includes(step)) {
          newState.completedSteps = [...prev.completedSteps, step];
        }

        if (step === "foundation") {
          applyFoundationStep(newState, data as Partial<BuilderState> | RealCountryData | null);
        } else if (step === "core") {
          applyCoreStep(newState, data as EconomicInputs);
        } else if (step === "government") {
          newState.governmentComponents = data as ComponentType[];
        } else if (step === "economics") {
          newState.economicInputs = sanitizeEconomicInputs(data as EconomicInputs);
        }

        const steps = getStepsForMode(mode, isScratchOrImportOrigin(newState));
        const currentIndex = steps.indexOf(step);
        if (currentIndex !== -1 && currentIndex < steps.length - 1) {
          newState.step = steps[currentIndex + 1]!;
        }

        return newState;
      });
    },
    [mode]
  );

  const canAccessStep = useCallback(
    (step: BuilderStep): boolean => {
      const steps = getStepsForMode(mode, isScratchOrImportOrigin(builderState));
      if (!steps.includes(step)) return false;
      const currentIndex = steps.indexOf(builderState.step);
      const targetIndex = steps.indexOf(step);
      return targetIndex <= currentIndex || builderState.completedSteps.includes(step);
    },
    [builderState, mode]
  );

  const applyImportedData = useCallback((imported: Partial<BuilderState>) => {
    setBuilderState((prev) => ({
      ...prev,
      ...imported,
      creationOrigin: "import",
      step: "core",
      completedSteps: Array.from(new Set([...prev.completedSteps, "foundation" as BuilderStep])),
      activeCoreTab: "identity",
    }));
  }, []);

  return {
    builderState,
    setBuilderState,
    lastSaved,
    isAutoSaving,
    isLoadingCountry,
    countryId,
    mode,
    enabledSteps: getStepsForMode(mode, isScratchOrImportOrigin(builderState)),
    isSyncing,
    syncError,
    hasUnsyncedChanges,
    lastSyncedAt,
    countryLoadError,
    retryCountryLoad,
    recoveredDraft,
    applyRecoveredDraft,
    dismissRecoveredDraft,
    selectedArchetypeId: builderState.selectedArchetypeId,
    updateArchetypeId,
    updateEconomicInputs,
    updateGovernmentComponents,
    updateGovernmentStructure,
    updateTaxSystem,
    updateEconomyBuilderState,
    updateStep,
    clearDraft,
    applyImportedData,
    canAccessStep,
    triggerManualSave,
    hasRestoredState,
  };
}
