"use client";
/**
 * Atomic Government Builder Hook (Plan 166)
 *
 * Composes the generic headless useAtomicSelectorState while retaining
 * all government-specific domain formulas, synergy detection, costs, and capacity metrics.
 *
 * @module useAtomicGovernmentBuilder
 */

import { useMemo } from "react";
import { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from "~/lib/government/atomic-data";
import {
  calculateGovernmentEffectiveness,
  detectSynergies,
  detectConflicts,
  filterByCategory,
  searchComponents,
  calculateImplementationCost,
  calculateMaintenanceCost,
  calculateRequiredCapacity,
  validateSelection,
} from "~/lib/government/atomic-utils";
import type { EffectivenessMetrics } from "~/components/ui/atomic/shared/types";
import { useAtomicSelectorState } from "./useAtomicSelectorState";

export interface UseAtomicGovernmentBuilderProps {
  /** Initially selected components */
  initialComponents?: ComponentType[];
  /** Maximum allowed components */
  maxComponents?: number;
  /** Read-only mode */
  isReadOnly?: boolean;
  /** Change callback */
  onChange?: (components: ComponentType[]) => void;
  /** Default category to filter components */
  defaultCategoryFilter?: string | null;
}

export interface UseAtomicGovernmentBuilderReturn {
  // State
  selectedComponents: ComponentType[];
  categoryFilter: string | null;
  searchQuery: string;

  // Computed values
  filteredComponents: Partial<Record<ComponentType, (typeof ATOMIC_COMPONENTS)[ComponentType]>>;
  effectiveness: EffectivenessMetrics;
  synergies: ReturnType<typeof detectSynergies>;
  conflicts: ReturnType<typeof detectConflicts>;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  validation: ReturnType<typeof validateSelection>;

  // Actions
  selectComponent: (componentType: ComponentType) => void;
  deselectComponent: (componentType: ComponentType) => void;
  toggleComponent: (componentType: ComponentType) => void;
  clearSelection: () => void;
  setCategoryFilter: (category: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Utilities
  isSelected: (componentType: ComponentType) => boolean;
  canSelectMore: boolean;
  categories: typeof COMPONENT_CATEGORIES;
}

/**
 * Hook for managing atomic government component builder state and logic
 */
export function useAtomicGovernmentBuilder({
  initialComponents = [],
  maxComponents = 10,
  isReadOnly = false,
  onChange,
  defaultCategoryFilter = null,
}: UseAtomicGovernmentBuilderProps = {}): UseAtomicGovernmentBuilderReturn {
  const state = useAtomicSelectorState<ComponentType>({
    initialSelection: initialComponents,
    maxComponents,
    isReadOnly,
    onSelectionChange: onChange,
    defaultCategory: defaultCategoryFilter,
  });

  const { selectedComponents, activeCategory, searchQuery } = state;

  // Filtered components based on search and category
  const filteredComponents = useMemo(() => {
    let filtered = ATOMIC_COMPONENTS;

    if (activeCategory) {
      filtered = filterByCategory(filtered, activeCategory);
    }

    if (searchQuery.trim()) {
      filtered = searchComponents(filtered, searchQuery);
    }

    return filtered;
  }, [activeCategory, searchQuery]);

  // Effectiveness metrics
  const effectiveness = useMemo(
    () => calculateGovernmentEffectiveness(selectedComponents),
    [selectedComponents]
  );

  // Synergies
  const synergies = useMemo(() => detectSynergies(selectedComponents), [selectedComponents]);

  // Conflicts
  const conflicts = useMemo(() => detectConflicts(selectedComponents), [selectedComponents]);

  // Cost calculations
  const implementationCost = useMemo(
    () => calculateImplementationCost(selectedComponents),
    [selectedComponents]
  );

  const maintenanceCost = useMemo(
    () => calculateMaintenanceCost(selectedComponents),
    [selectedComponents]
  );

  const requiredCapacity = useMemo(
    () => calculateRequiredCapacity(selectedComponents),
    [selectedComponents]
  );

  // Validation
  const validation = useMemo(
    () => validateSelection(selectedComponents, maxComponents),
    [selectedComponents, maxComponents]
  );

  return {
    // State
    selectedComponents,
    categoryFilter: activeCategory,
    searchQuery,

    // Computed values
    filteredComponents,
    effectiveness,
    synergies,
    conflicts,
    implementationCost,
    maintenanceCost,
    requiredCapacity,
    validation,

    // Actions
    selectComponent: state.handleSelect,
    deselectComponent: state.handleDeselect,
    toggleComponent: state.handleToggle,
    clearSelection: state.handleClear,
    setCategoryFilter: state.setActiveCategory,
    setSearchQuery: state.setSearchQuery,

    // Utilities
    isSelected: state.isSelected,
    canSelectMore: state.canSelectMore,
    categories: COMPONENT_CATEGORIES,
  };
}
