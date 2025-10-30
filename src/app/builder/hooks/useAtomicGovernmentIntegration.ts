/**
 * Atomic Government Integration Hook.
 *
 * Provides a unified interface for managing atomic government components
 * and their bidirectional integration with traditional government builder
 * and spending systems. Handles component selection, validation, synergy
 * calculation, and automatic builder generation.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import type { GovernmentBuilderState } from "~/types/government";
import type { EconomicInputs } from "../lib/economy-data-service";
import { atomicIntegrationService } from "../services/AtomicIntegrationService";
import { generateGovernmentBuilderFromAtomicComponents } from "../utils/atomicGovernmentIntegration";
import { validateGovernmentSpendingSource } from "../utils/governmentValidation";

/**
 * Return value interface for useAtomicGovernmentIntegration hook.
 * Provides state, validation, and action methods for atomic government integration.
 */
export interface UseAtomicGovernmentIntegrationResult {
  // State
  /** Currently selected atomic government components */
  selectedComponents: ComponentType[];
  /** Traditional government builder structure */
  governmentBuilder: GovernmentBuilderState | null;
  /** Economic inputs for budget calculations */
  economicInputs: EconomicInputs | null;
  /** Whether integration updates are in progress */
  isUpdating: boolean;
  /** Critical integration errors */
  errors: string[];
  /** Non-blocking integration warnings */
  warnings: string[];
  /** Validation result for government spending configuration */
  validation: {
    isValid: boolean;
    hasGovernmentBuilder: boolean;
    hasDepartments: boolean;
    hasBudgetAllocations: boolean;
    errorMessage?: string;
    warningMessage?: string;
  };

  // Actions
  /** Update selected atomic components */
  setSelectedComponents: (components: ComponentType[]) => void;
  /** Update traditional government builder */
  setGovernmentBuilder: (builder: GovernmentBuilderState) => void;
  /** Update economic inputs */
  setEconomicInputs: (inputs: EconomicInputs) => void;
  /** Generate traditional builder from atomic components */
  generateFromAtomicComponents: () => Promise<void>;
  /** Clear all error messages */
  clearErrors: () => void;
  /** Clear all warning messages */
  clearWarnings: () => void;

  // Computed values
  /** Whether any atomic components are selected */
  hasAtomicComponents: boolean;
  /** Whether traditional builder needs to be generated */
  needsGovernmentBuilder: boolean;
  /** Whether builder can be generated from current state */
  canGenerateBuilder: boolean;
}

/**
 * Atomic government integration hook for managing component-based government systems.
 *
 * Integrates atomic government components with traditional builder structures:
 * - Automatic synergy detection between components
 * - Bidirectional sync with government builder
 * - Budget allocation generation from components
 * - Real-time validation and error tracking
 * - Integration service subscription for updates
 *
 * This hook serves as the primary interface for the atomic government system,
 * coordinating between component selection UI, traditional builder, and
 * spending/budget systems.
 *
 * @hook
 * @param {ComponentType[]} initialComponents - Initial atomic components (default: [])
 * @param {GovernmentBuilderState|null} initialGovernmentBuilder - Initial builder state (default: null)
 * @param {EconomicInputs|null} initialEconomicInputs - Initial economic data (default: null)
 * @returns {UseAtomicGovernmentIntegrationResult} Integration state and methods
 *
 * @example
 * ```tsx
 * function GovernmentBuilder() {
 *   const {
 *     selectedComponents,
 *     setSelectedComponents,
 *     governmentBuilder,
 *     generateFromAtomicComponents,
 *     validation,
 *     hasAtomicComponents,
 *     canGenerateBuilder
 *   } = useAtomicGovernmentIntegration([], null, economicInputs);
 *
 *   const handleComponentSelect = (component: ComponentType) => {
 *     setSelectedComponents([...selectedComponents, component]);
 *   };
 *
 *   const handleGenerate = async () => {
 *     if (canGenerateBuilder) {
 *       await generateFromAtomicComponents();
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <ComponentSelector
 *         selected={selectedComponents}
 *         onSelect={handleComponentSelect}
 *       />
 *       {hasAtomicComponents && (
 *         <button onClick={handleGenerate} disabled={!canGenerateBuilder}>
 *           Generate Government Structure
 *         </button>
 *       )}
 *       {!validation.isValid && (
 *         <div className="text-red-500">{validation.errorMessage}</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Monitor integration errors and warnings
 * function IntegrationStatus() {
 *   const { errors, warnings, isUpdating, clearErrors, clearWarnings } =
 *     useAtomicGovernmentIntegration();
 *
 *   return (
 *     <div>
 *       {isUpdating && <Spinner />}
 *       {errors.length > 0 && (
 *         <div>
 *           <h4>Errors:</h4>
 *           {errors.map(err => <p key={err} className="text-red-500">{err}</p>)}
 *           <button onClick={clearErrors}>Clear Errors</button>
 *         </div>
 *       )}
 *       {warnings.length > 0 && (
 *         <div>
 *           <h4>Warnings:</h4>
 *           {warnings.map(warn => <p key={warn} className="text-yellow-500">{warn}</p>)}
 *           <button onClick={clearWarnings}>Clear Warnings</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Validation-based conditional rendering
 * function BudgetAllocationDisplay() {
 *   const { validation, governmentBuilder } = useAtomicGovernmentIntegration();
 *
 *   if (!validation.hasGovernmentBuilder) {
 *     return <p>No government structure configured</p>;
 *   }
 *
 *   if (!validation.hasDepartments) {
 *     return <p>No departments defined</p>;
 *   }
 *
 *   if (!validation.hasBudgetAllocations) {
 *     return <p>No budget allocations configured</p>;
 *   }
 *
 *   return (
 *     <div>
 *       {governmentBuilder?.budgetAllocations.map(alloc => (
 *         <div key={alloc.id}>
 *           {alloc.departmentName}: {alloc.allocatedPercent}%
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAtomicGovernmentIntegration(
  initialComponents: ComponentType[] = [],
  initialGovernmentBuilder: GovernmentBuilderState | null = null,
  initialEconomicInputs: EconomicInputs | null = null
): UseAtomicGovernmentIntegrationResult {
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>(initialComponents);
  const [governmentBuilder, setGovernmentBuilder] = useState<GovernmentBuilderState | null>(
    initialGovernmentBuilder
  );
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(
    initialEconomicInputs
  );
  const [integrationState, setIntegrationState] = useState(atomicIntegrationService.getState());

  // Track last sent values to prevent redundant updates
  const lastSentComponentsRef = useRef<ComponentType[]>([]);
  const lastSentGovernmentBuilderRef = useRef<GovernmentBuilderState | null>(null);
  const lastSentEconomicInputsRef = useRef<EconomicInputs | null>(null);

  // Subscribe to integration service updates once
  useEffect(() => {
    const unsubscribe = atomicIntegrationService.subscribe(setIntegrationState);
    return unsubscribe;
  }, []);

  // Consolidated effect for updating service with guards
  useEffect(() => {
    // Update components if changed
    if (
      selectedComponents.length > 0 &&
      JSON.stringify(selectedComponents) !== JSON.stringify(lastSentComponentsRef.current)
    ) {
      lastSentComponentsRef.current = [...selectedComponents];
      atomicIntegrationService.updateComponents(selectedComponents);
    }

    // Update government builder if changed
    if (
      governmentBuilder &&
      JSON.stringify(governmentBuilder) !== JSON.stringify(lastSentGovernmentBuilderRef.current)
    ) {
      lastSentGovernmentBuilderRef.current = governmentBuilder;
      atomicIntegrationService.updateGovernmentBuilder(governmentBuilder);
    }

    // Update economic inputs if changed
    if (
      economicInputs &&
      JSON.stringify(economicInputs) !== JSON.stringify(lastSentEconomicInputsRef.current)
    ) {
      lastSentEconomicInputsRef.current = economicInputs;
      atomicIntegrationService.updateEconomicInputs(economicInputs);
    }
  }, [selectedComponents, governmentBuilder, economicInputs]);

  // Validation
  const validation = economicInputs
    ? validateGovernmentSpendingSource(economicInputs, governmentBuilder)
    : {
        isValid: false,
        hasGovernmentBuilder: !!governmentBuilder,
        hasDepartments: false,
        hasBudgetAllocations: false,
        errorMessage: "Economic inputs are required",
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
      console.error("Failed to generate government builder from atomic components:", error);
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
    canGenerateBuilder,
  };
}
