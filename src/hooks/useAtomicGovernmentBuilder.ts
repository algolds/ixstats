/**
 * Atomic Government Builder Hook
 *
 * React hook managing state and logic for government component builder.
 * Encapsulates all state management, computations, and event handlers.
 *
 * @module useAtomicGovernmentBuilder
 */

import { useState, useMemo, useCallback } from 'react';
import { ComponentType } from '@prisma/client';
import { ATOMIC_COMPONENTS, COMPONENT_CATEGORIES } from '~/lib/atomic-government-data';
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
} from '~/lib/atomic-government-utils';
import type { EffectivenessMetrics } from '~/components/atomic/shared/types';

export interface UseAtomicGovernmentBuilderProps {
  /** Initially selected components */
  initialComponents?: ComponentType[];
  /** Maximum allowed components */
  maxComponents?: number;
  /** Read-only mode */
  isReadOnly?: boolean;
  /** Change callback */
  onChange?: (components: ComponentType[]) => void;
}

export interface UseAtomicGovernmentBuilderReturn {
  // State
  selectedComponents: ComponentType[];
  categoryFilter: string | null;
  searchQuery: string;

  // Computed values
  filteredComponents: Partial<Record<ComponentType, typeof ATOMIC_COMPONENTS[ComponentType]>>;
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
}: UseAtomicGovernmentBuilderProps = {}): UseAtomicGovernmentBuilderReturn {
  // State
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>(initialComponents);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered components based on search and category
  const filteredComponents = useMemo(() => {
    let filtered = ATOMIC_COMPONENTS;

    if (categoryFilter) {
      filtered = filterByCategory(filtered, categoryFilter);
    }

    if (searchQuery.trim()) {
      filtered = searchComponents(filtered, searchQuery);
    }

    return filtered;
  }, [categoryFilter, searchQuery]);

  // Effectiveness metrics
  const effectiveness = useMemo(
    () => calculateGovernmentEffectiveness(selectedComponents),
    [selectedComponents]
  );

  // Synergies
  const synergies = useMemo(
    () => detectSynergies(selectedComponents),
    [selectedComponents]
  );

  // Conflicts
  const conflicts = useMemo(
    () => detectConflicts(selectedComponents),
    [selectedComponents]
  );

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

  // Can select more components
  const canSelectMore = useMemo(
    () => !isReadOnly && selectedComponents.length < maxComponents,
    [isReadOnly, selectedComponents.length, maxComponents]
  );

  // Select component
  const selectComponent = useCallback(
    (componentType: ComponentType) => {
      if (isReadOnly) return;
      if (selectedComponents.includes(componentType)) return;
      if (selectedComponents.length >= maxComponents) return;

      const newComponents = [...selectedComponents, componentType];
      setSelectedComponents(newComponents);
      onChange?.(newComponents);
    },
    [isReadOnly, selectedComponents, maxComponents, onChange]
  );

  // Deselect component
  const deselectComponent = useCallback(
    (componentType: ComponentType) => {
      if (isReadOnly) return;

      const newComponents = selectedComponents.filter((c) => c !== componentType);
      setSelectedComponents(newComponents);
      onChange?.(newComponents);
    },
    [isReadOnly, selectedComponents, onChange]
  );

  // Toggle component
  const toggleComponent = useCallback(
    (componentType: ComponentType) => {
      if (selectedComponents.includes(componentType)) {
        deselectComponent(componentType);
      } else {
        selectComponent(componentType);
      }
    },
    [selectedComponents, selectComponent, deselectComponent]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    if (isReadOnly) return;

    setSelectedComponents([]);
    onChange?.([]);
  }, [isReadOnly, onChange]);

  // Check if component is selected
  const isSelected = useCallback(
    (componentType: ComponentType) => selectedComponents.includes(componentType),
    [selectedComponents]
  );

  return {
    // State
    selectedComponents,
    categoryFilter,
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
    selectComponent,
    deselectComponent,
    toggleComponent,
    clearSelection,
    setCategoryFilter,
    setSearchQuery,

    // Utilities
    isSelected,
    canSelectMore,
    categories: COMPONENT_CATEGORIES,
  };
}
