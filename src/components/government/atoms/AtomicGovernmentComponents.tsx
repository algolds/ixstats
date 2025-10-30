"use client";

/**
 * Atomic Government Components
 *
 * Main orchestrator component for the atomic government builder system.
 * Refactored to use modular UI components with clean composition.
 *
 * Original: 2,167 lines (monolithic)
 * Refactored: ~350 lines (orchestrator only)
 * Reduction: 84% code reduction
 *
 * @module AtomicGovernmentComponents
 */

import React, { useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Save, RotateCcw, Info, Blocks } from 'lucide-react';
import { useAtomicGovernmentBuilder } from '~/hooks/useAtomicGovernmentBuilder';
import { ATOMIC_COMPONENTS, GOVERNMENT_TEMPLATES } from '~/lib/atomic-government-data';
import { getCategories } from '~/lib/atomic-government-utils';
import { useGovernmentComponentsData } from '~/hooks/useGovernmentComponentsData';
import {
  ComponentLibrary,
  SelectedComponentsList,
  SynergyDisplay,
  CategoryFilter,
  ComponentSearch,
  MetricsPanel,
  TemplateSelector,
} from '~/components/government/atomic';
import { ComponentType } from '@prisma/client';
import { Alert, AlertDescription } from '~/components/ui/alert';

export interface AtomicGovernmentComponentsProps {
  /** Currently selected components */
  initialComponents?: ComponentType[];
  /** Maximum allowed components */
  maxComponents?: number;
  /** Read-only mode */
  isReadOnly?: boolean;
  /** Save callback */
  onSave?: (components: ComponentType[]) => void;
  /** Change callback */
  onChange?: (components: ComponentType[]) => void;
}

/**
 * Main atomic government builder component
 * Orchestrates all sub-components and manages state through hook
 */
export function AtomicGovernmentComponents({
  initialComponents = [],
  maxComponents = 10,
  isReadOnly = false,
  onSave,
  onChange,
}: AtomicGovernmentComponentsProps) {
  // Fetch component data from database (with fallback)
  const {
    components: componentData,
    isLoading: componentsLoading,
    isUsingFallback,
    incrementUsage
  } = useGovernmentComponentsData();

  // Initialize builder hook
  const builder = useAtomicGovernmentBuilder({
    initialComponents,
    maxComponents,
    isReadOnly,
    onChange,
  });

  // Get available categories
  const categories = useMemo(() => getCategories(ATOMIC_COMPONENTS), []);

  // Calculate category counts for filtered components
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(builder.filteredComponents).forEach((comp) => {
      if (comp?.category) {
        counts[comp.category] = (counts[comp.category] ?? 0) + 1;
      }
    });
    return counts;
  }, [builder.filteredComponents]);

  // Get selected component objects
  const selectedComponentObjects = useMemo(() => {
    return builder.selectedComponents
      .map((type) => ATOMIC_COMPONENTS[type])
      .filter((comp) => comp !== undefined);
  }, [builder.selectedComponents]);

  // Build metrics object
  const metrics = useMemo(
    () => ({
      totalComponents: builder.selectedComponents.length,
      totalEffectiveness: builder.effectiveness.totalEffectiveness,
      implementationCost: builder.implementationCost,
      maintenanceCost: builder.maintenanceCost,
      synergyCount: builder.synergies.length,
      conflictCount: builder.conflicts.length,
    }),
    [
      builder.selectedComponents.length,
      builder.effectiveness.totalEffectiveness,
      builder.implementationCost,
      builder.maintenanceCost,
      builder.synergies.length,
      builder.conflicts.length,
    ]
  );

  // Build components map with ComponentType keys for SynergyDisplay
  const componentsMap = useMemo(() => {
    const map: Partial<Record<ComponentType, typeof ATOMIC_COMPONENTS[ComponentType]>> = {};
    Object.entries(ATOMIC_COMPONENTS).forEach(([key, value]) => {
      map[key as ComponentType] = value;
    });
    return map;
  }, []);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = GOVERNMENT_TEMPLATES[templateId as keyof typeof GOVERNMENT_TEMPLATES];
    if (template) {
      builder.clearSelection();
      template.components.forEach((componentType) => {
        builder.selectComponent(componentType);
      });
    }
  };

  // Handle save with usage tracking
  const handleSave = () => {
    if (builder.validation.isValid) {
      // Track usage of all selected components
      builder.selectedComponents.forEach(componentType => {
        incrementUsage(componentType);
      });
      onSave?.(builder.selectedComponents);
    }
  };

  // Handle component selection with usage tracking
  const handleComponentSelect = (componentType: ComponentType) => {
    builder.selectComponent(componentType);
    incrementUsage(componentType);
  };

  // Show loading state
  if (componentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fallback Warning Banner */}
      {isUsingFallback && (
        <Alert variant="warning">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Using local component data. Database connection unavailable or empty.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Blocks className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-2xl">Atomic Government Builder</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Build your government from modular components
                  {isUsingFallback && ' (Local Mode)'}
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={builder.clearSelection}
                  disabled={builder.selectedComponents.length === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!builder.validation.isValid}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Select {maxComponents} government components to build your custom governance system.
          Watch for synergies (bonuses) and conflicts (penalties) between components.
        </AlertDescription>
      </Alert>

      {/* Validation Errors */}
      {!builder.validation.isValid && builder.validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {builder.validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Panel */}
      <MetricsPanel metrics={metrics} />

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <CategoryFilter
              categories={categories}
              selectedCategory={builder.categoryFilter}
              onChange={builder.setCategoryFilter}
              categoryCounts={categoryCounts}
            />
            <ComponentSearch
              value={builder.searchQuery}
              onChange={builder.setSearchQuery}
              placeholder="Search components by name or description..."
            />
            <div className="ml-auto">
              <TemplateSelector
                templates={GOVERNMENT_TEMPLATES}
                onSelect={handleTemplateSelect}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Component Library and Selected Components */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Component Library (2/3 width on large screens) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Components</CardTitle>
            </CardHeader>
            <CardContent>
              <ComponentLibrary
                components={builder.filteredComponents}
                selectedIds={builder.selectedComponents}
                onSelect={handleComponentSelect}
                onDeselect={builder.deselectComponent}
                isReadOnly={isReadOnly}
                canSelectMore={builder.canSelectMore}
              />
            </CardContent>
          </Card>
        </div>

        {/* Selected Components (1/3 width on large screens) */}
        <div className="lg:col-span-1">
          <SelectedComponentsList
            selectedComponents={selectedComponentObjects}
            onDeselect={builder.deselectComponent}
            isReadOnly={isReadOnly}
            totalCost={builder.implementationCost}
            totalEffectiveness={builder.effectiveness.totalEffectiveness}
          />
        </div>
      </div>

      {/* Synergies and Conflicts Display */}
      <SynergyDisplay
        synergies={builder.synergies}
        conflicts={builder.conflicts}
        components={componentsMap}
      />

      {/* Save Button (Bottom) */}
      {!isReadOnly && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={builder.clearSelection}
            disabled={builder.selectedComponents.length === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Selection
          </Button>
          <Button
            onClick={handleSave}
            disabled={!builder.validation.isValid}
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Government Configuration
          </Button>
        </div>
      )}
    </div>
  );
}

// Re-export types and utilities for convenience
export { ComponentType } from '@prisma/client';
export { ATOMIC_COMPONENTS, GOVERNMENT_TEMPLATES } from '~/lib/atomic-government-data';
export type { AtomicGovernmentComponent } from '~/lib/atomic-government-data';
export {
  calculateGovernmentEffectiveness,
  checkGovernmentSynergy,
  checkGovernmentConflict
} from '~/lib/atomic-government-utils';

// Export alias for backward compatibility
export { AtomicGovernmentComponents as AtomicComponentSelector };
