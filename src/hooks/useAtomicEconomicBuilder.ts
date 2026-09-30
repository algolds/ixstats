"use client";
/**
 * Atomic Economic Builder - State Management Hook (Plan 166)
 *
 * Custom React hook that encapsulates all state management and business logic
 * for the atomic economic component builder system.
 * Composes headless useAtomicSelectorState while retaining all economic domain logic.
 */

import { useMemo, useCallback } from "react";
import {
  type EconomicComponentType,
  type EconomicCategory,
  type EconomicTemplate,
  ECONOMIC_TEMPLATES,
  COMPONENT_CATEGORIES,
} from "~/lib/economy/atomic-data";
import {
  filterAndSearchComponents,
  detectEconomicSynergies,
  detectEconomicConflicts,
  getEconomicMetrics,
  validateEconomicSelection,
  getAllComponents,
  type EconomicMetrics,
  type ValidationResult,
} from "~/lib/economy/atomic-utils";
import { useEconomicComponentsData } from "./useEconomicComponentsData";
import { useAtomicSelectorState } from "./useAtomicSelectorState";

/**
 * Hook Props
 */
export interface UseAtomicEconomicBuilderProps {
  countryId?: string;
  initialSelection?: EconomicComponentType[];
  maxComponents?: number;
  onSelectionChange?: (components: EconomicComponentType[]) => void;
}

/**
 * Hook Return Type
 */
export interface UseAtomicEconomicBuilderReturn {
  // Selection State
  selectedComponents: EconomicComponentType[];
  selectedIds: Set<string>;
  availableComponents: EconomicComponentType[];

  // Filter State
  categoryFilter: {
    category: EconomicCategory | null;
    setCategory: (category: EconomicCategory | null) => void;
    categories: typeof COMPONENT_CATEGORIES;
  };

  // Search State
  search: {
    query: string;
    setQuery: (query: string) => void;
  };

  // Templates
  templates: {
    available: EconomicTemplate[];
    load: (templateId: string) => void;
  };

  // Computed Data
  synergies: ReturnType<typeof detectEconomicSynergies>;
  conflicts: ReturnType<typeof detectEconomicConflicts>;
  metrics: EconomicMetrics;
  validation: ValidationResult;

  // Actions
  handleSelect: (component: EconomicComponentType) => void;
  handleDeselect: (component: EconomicComponentType) => void;
  handleToggle: (component: EconomicComponentType) => void;
  handleClear: () => void;

  // Utility
  canSelect: boolean;
  maxComponents: number;
}

/**
 * Atomic Economic Builder Hook
 */
export function useAtomicEconomicBuilder({
  countryId: _countryId,
  initialSelection = [],
  maxComponents = 15,
  onSelectionChange,
}: UseAtomicEconomicBuilderProps = {}): UseAtomicEconomicBuilderReturn {
  // Database Integration
  const { components: dbComponents } = useEconomicComponentsData();

  // Headless state composition
  const state = useAtomicSelectorState<EconomicComponentType>({
    initialSelection,
    maxComponents,
    onSelectionChange,
  });

  const { selectedComponents, selectedIds, searchQuery, activeCategory } = state;

  const allComponents = useMemo(() => {
    if (dbComponents.length > 0) {
      return dbComponents.map((comp) => comp.type);
    }
    return getAllComponents();
  }, [dbComponents]);

  const availableComponents = useMemo(() => {
    return filterAndSearchComponents(
      allComponents,
      activeCategory as EconomicCategory | null,
      searchQuery
    );
  }, [allComponents, activeCategory, searchQuery]);

  const synergies = useMemo(() => {
    return detectEconomicSynergies(selectedComponents);
  }, [selectedComponents]);

  const conflicts = useMemo(() => {
    return detectEconomicConflicts(selectedComponents);
  }, [selectedComponents]);

  const metrics = useMemo(() => {
    return getEconomicMetrics(selectedComponents);
  }, [selectedComponents]);

  const validation = useMemo(() => {
    return validateEconomicSelection(selectedComponents, maxComponents);
  }, [selectedComponents, maxComponents]);

  const loadTemplate = useCallback(
    (templateId: string) => {
      const template = ECONOMIC_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;
      state.setSelection(template.components);
    },
    [state]
  );

  const setCategory = useCallback(
    (category: EconomicCategory | null) => {
      state.setActiveCategory(category);
    },
    [state]
  );

  return {
    selectedComponents,
    selectedIds,
    availableComponents,

    categoryFilter: {
      category: activeCategory as EconomicCategory | null,
      setCategory,
      categories: COMPONENT_CATEGORIES,
    },

    search: {
      query: searchQuery,
      setQuery: state.setSearchQuery,
    },

    templates: {
      available: ECONOMIC_TEMPLATES,
      load: loadTemplate,
    },

    synergies,
    conflicts,
    metrics,
    validation,

    handleSelect: state.handleSelect,
    handleDeselect: state.handleDeselect,
    handleToggle: state.handleToggle,
    handleClear: state.handleClear,

    canSelect: state.canSelectMore,
    maxComponents,
  };
}
