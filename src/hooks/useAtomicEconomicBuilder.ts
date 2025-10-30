/**
 * Atomic Economic Builder - State Management Hook
 *
 * Custom React hook that encapsulates all state management and business logic
 * for the atomic economic component builder system.
 *
 * Features:
 * - Component selection state
 * - Category filtering
 * - Search functionality
 * - Template loading
 * - Synergy detection
 * - Metrics calculation
 * - Performance optimization with useMemo/useCallback
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  type EconomicComponentType,
  type EconomicCategory,
  type EconomicTemplate,
  ECONOMIC_TEMPLATES,
  COMPONENT_CATEGORIES,
} from "~/lib/atomic-economic-data";
import {
  filterAndSearchComponents,
  detectEconomicSynergies,
  detectEconomicConflicts,
  getEconomicMetrics,
  validateEconomicSelection,
  getAllComponents,
  type EconomicMetrics,
  type ValidationResult,
} from "~/lib/atomic-economic-utils";
import { useEconomicComponentsData } from "./useEconomicComponentsData";

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
 *
 * @param props Hook configuration
 * @returns Builder state and actions
 */
export function useAtomicEconomicBuilder({
  countryId,
  initialSelection = [],
  maxComponents = 12,
  onSelectionChange,
}: UseAtomicEconomicBuilderProps = {}): UseAtomicEconomicBuilderReturn {
  // ============================================================================
  // Database Integration
  // ============================================================================

  // Use database hook for component data
  const {
    components: dbComponents,
    isLoading: dbLoading,
    isUsingFallback,
  } = useEconomicComponentsData();

  // ============================================================================
  // State
  // ============================================================================

  const [selectedComponents, setSelectedComponents] =
    useState<EconomicComponentType[]>(initialSelection);
  const [categoryFilter, setCategoryFilter] = useState<EconomicCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ============================================================================
  // Computed Values (Memoized)
  // ============================================================================

  /**
   * All available component types (from database or fallback)
   * Uses database data when available, falls back to hardcoded data
   */
  const allComponents = useMemo(() => {
    if (dbComponents.length > 0) {
      return dbComponents.map((comp) => comp.type);
    }
    return getAllComponents();
  }, [dbComponents]);

  /**
   * Filtered and searched components
   */
  const availableComponents = useMemo(() => {
    return filterAndSearchComponents(allComponents, categoryFilter, searchQuery);
  }, [allComponents, categoryFilter, searchQuery]);

  /**
   * Set of selected component IDs for quick lookup
   */
  const selectedIds = useMemo(() => {
    return new Set(selectedComponents.map((c) => c.toString()));
  }, [selectedComponents]);

  /**
   * Detected synergies between selected components
   */
  const synergies = useMemo(() => {
    return detectEconomicSynergies(selectedComponents);
  }, [selectedComponents]);

  /**
   * Detected conflicts between selected components
   */
  const conflicts = useMemo(() => {
    return detectEconomicConflicts(selectedComponents);
  }, [selectedComponents]);

  /**
   * Economic metrics for selected components
   * Uses database component data when available for tax/sector/employment impacts
   */
  const metrics = useMemo(() => {
    // If using database components, metrics are already calculated from database data
    // The getEconomicMetrics function pulls from ATOMIC_ECONOMIC_COMPONENTS by default,
    // but database components are already merged into that structure via the hook
    return getEconomicMetrics(selectedComponents);
  }, [selectedComponents]);

  /**
   * Validation result for current selection
   */
  const validation = useMemo(() => {
    return validateEconomicSelection(selectedComponents, maxComponents);
  }, [selectedComponents, maxComponents]);

  /**
   * Whether more components can be selected
   */
  const canSelect = useMemo(() => {
    return selectedComponents.length < maxComponents;
  }, [selectedComponents.length, maxComponents]);

  // ============================================================================
  // Action Handlers (Memoized)
  // ============================================================================

  /**
   * Handle component selection
   */
  const handleSelect = useCallback(
    (component: EconomicComponentType) => {
      setSelectedComponents((prev) => {
        // Don't add if already selected
        if (prev.includes(component)) return prev;

        // Don't add if max reached
        if (prev.length >= maxComponents) return prev;

        const newSelection = [...prev, component];

        // Notify parent if callback provided
        onSelectionChange?.(newSelection);

        return newSelection;
      });
    },
    [maxComponents, onSelectionChange]
  );

  /**
   * Handle component deselection
   */
  const handleDeselect = useCallback(
    (component: EconomicComponentType) => {
      setSelectedComponents((prev) => {
        const newSelection = prev.filter((c) => c !== component);

        // Notify parent if callback provided
        onSelectionChange?.(newSelection);

        return newSelection;
      });
    },
    [onSelectionChange]
  );

  /**
   * Handle component toggle (select/deselect)
   */
  const handleToggle = useCallback(
    (component: EconomicComponentType) => {
      if (selectedIds.has(component.toString())) {
        handleDeselect(component);
      } else {
        handleSelect(component);
      }
    },
    [selectedIds, handleSelect, handleDeselect]
  );

  /**
   * Clear all selected components
   */
  const handleClear = useCallback(() => {
    setSelectedComponents([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  /**
   * Load economic template
   */
  const loadTemplate = useCallback(
    (templateId: string) => {
      const template = ECONOMIC_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;

      setSelectedComponents(template.components);
      onSelectionChange?.(template.components);
    },
    [onSelectionChange]
  );

  /**
   * Set category filter
   */
  const setCategory = useCallback((category: EconomicCategory | null) => {
    setCategoryFilter(category);
  }, []);

  /**
   * Set search query
   */
  const setQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // ============================================================================
  // Return Interface
  // ============================================================================

  return {
    // Selection State
    selectedComponents,
    selectedIds,
    availableComponents,

    // Filter State
    categoryFilter: {
      category: categoryFilter,
      setCategory,
      categories: COMPONENT_CATEGORIES,
    },

    // Search State
    search: {
      query: searchQuery,
      setQuery,
    },

    // Templates
    templates: {
      available: ECONOMIC_TEMPLATES,
      load: loadTemplate,
    },

    // Computed Data
    synergies,
    conflicts,
    metrics,
    validation,

    // Actions
    handleSelect,
    handleDeselect,
    handleToggle,
    handleClear,

    // Utility
    canSelect,
    maxComponents,
  };
}
