"use client";

/**
 * Atomic Economic Components - Main Orchestrator
 *
 * Refactored modular version using composition pattern.
 * Reduced from 1,565 lines to ~350 lines (78% reduction).
 *
 * Architecture:
 * - Data Layer: ~/lib/atomic-economic-data.ts (~550 lines)
 * - Utils Layer: ~/lib/atomic-economic-utils.ts (~325 lines)
 * - Hook Layer: ~/hooks/useAtomicEconomicBuilder.ts (~225 lines)
 * - UI Components: ~/components/economy/atomic/* (~700 lines total)
 * - Main Component: This file (~350 lines)
 *
 * Total system: ~2,150 lines vs 1,565 monolith
 * Better organization, testability, and maintainability
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { UnifiedAtomicComponentSelector } from '~/components/atomic/shared/UnifiedAtomicComponentSelector';
import { ECONOMY_THEME } from '~/components/atomic/shared/themes';
import { DollarSign, AlertCircle, Save, RotateCcw, Database } from 'lucide-react';

// Data imports
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  type EconomicComponentType,
  type EconomicCategory,
  formatComponentName
} from '~/lib/atomic-economic-data';

// Hook import for database integration
import { useEconomicComponentsData } from '~/hooks/useEconomicComponentsData';

// Utility imports
import {
  calculateEconomicEffectiveness,
  checkEconomicSynergy,
  checkEconomicConflict
} from '~/lib/atomic-economic-utils';

// Hook import
import { useAtomicEconomicBuilder } from '~/hooks/useAtomicEconomicBuilder';

// UI Component imports
import {
  ComponentLibrary,
  SelectedComponentsList,
  SynergyDisplay,
  CategoryFilter,
  ComponentSearch,
  MetricsPanel,
  TemplateSelector
} from '~/components/economy/atomic';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AtomicEconomicComponentSelectorProps {
  selectedComponents: EconomicComponentType[];
  onComponentChange: (components: EconomicComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
  governmentComponents?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AtomicEconomicComponent to UnifiedAtomicComponent format
 */
function convertEconomicToUnifiedComponents(components: typeof ATOMIC_ECONOMIC_COMPONENTS): Record<string, any> {
  const converted: Record<string, any> = {};

  Object.entries(components).forEach(([key, component]) => {
    if (component) {
      converted[key] = {
        id: component.id,
        name: component.name,
        category: component.category,
        description: component.description,
        effectiveness: component.effectiveness,
        implementationCost: component.implementationCost,
        maintenanceCost: component.maintenanceCost,
        prerequisites: [],
        synergies: component.synergies.map(s => s.toString()),
        conflicts: component.conflicts.map(c => c.toString()),
        metadata: component.metadata,
        icon: component.icon
      };
    }
  });

  return converted;
}

/**
 * Convert categories to the expected format
 */
const convertedCategories: Record<string, string[]> = {
  "Economic Model": COMPONENT_CATEGORIES["Economic Model"].components.map(c => c.toString()),
  "Sector Focus": COMPONENT_CATEGORIES["Sector Focus"].components.map(c => c.toString()),
  "Labor System": COMPONENT_CATEGORIES["Labor System"].components.map(c => c.toString()),
  "Trade Policy": COMPONENT_CATEGORIES["Trade Policy"].components.map(c => c.toString()),
  "Innovation": COMPONENT_CATEGORIES["Innovation"].components.map(c => c.toString()),
  "Resource Management": COMPONENT_CATEGORIES["Resource Management"].components.map(c => c.toString())
};

// ============================================================================
// Main Component - Unified Selector Version
// ============================================================================

/**
 * Atomic Economic Component Selector (Unified)
 *
 * Uses the existing UnifiedAtomicComponentSelector for consistent UI/UX
 * across atomic systems.
 */
export function AtomicEconomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 12,
  isReadOnly = false,
  governmentComponents = []
}: AtomicEconomicComponentSelectorProps) {
  // Use database hook for component data
  const { components: dbComponents, isLoading, isUsingFallback, incrementUsage } = useEconomicComponentsData();

  // Track component selection
  const handleComponentChange = (components: string[]) => {
    const newComponents = components.map(c => c as EconomicComponentType);

    // Track newly selected components
    const addedComponents = newComponents.filter(c => !selectedComponents.includes(c));
    addedComponents.forEach(comp => incrementUsage(comp));

    onComponentChange(newComponents);
  };

  // Convert database components to unified format
  const componentsToUse = React.useMemo(() => {
    if (dbComponents.length > 0) {
      // Build components object from database data
      const componentsObj: Record<string, any> = {};
      dbComponents.forEach(comp => {
        componentsObj[comp.type] = comp;
      });
      return convertEconomicToUnifiedComponents(componentsObj);
    }
    // Fallback to hardcoded data
    return convertEconomicToUnifiedComponents(ATOMIC_ECONOMIC_COMPONENTS);
  }, [dbComponents]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse space-y-2">
            <Database className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-sm text-gray-600">Loading economic components...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Fallback Warning Banner */}
      {isUsingFallback && (
        <Alert className="mb-4 border-amber-200 bg-amber-50">
          <Database className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Using hardcoded component data. Database integration pending Phase 5 migration.
          </AlertDescription>
        </Alert>
      )}

      <UnifiedAtomicComponentSelector
        components={componentsToUse}
        categories={convertedCategories}
        selectedComponents={selectedComponents.map(s => s.toString())}
        onComponentChange={handleComponentChange}
        maxComponents={maxComponents}
        isReadOnly={isReadOnly}
        theme={ECONOMY_THEME}
        systemName="Atomic Economic Components"
        systemIcon={DollarSign}
        calculateEffectiveness={(components) => calculateEconomicEffectiveness(components.map(c => c as EconomicComponentType))}
        checkSynergy={checkEconomicSynergy}
        checkConflict={checkEconomicConflict}
      />
    </>
  );
}

// ============================================================================
// Main Component - Custom Builder Version
// ============================================================================

export interface AtomicEconomicBuilderProps {
  countryId?: string;
  initialSelection?: EconomicComponentType[];
  maxComponents?: number;
  onSave?: (components: EconomicComponentType[]) => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
}

/**
 * Atomic Economic Component Builder (Custom)
 *
 * Full-featured builder with custom UI using modular components.
 * This is the refactored version of the original monolithic component.
 */
export function AtomicEconomicBuilder({
  countryId,
  initialSelection = [],
  maxComponents = 12,
  onSave,
  onCancel,
  isReadOnly = false
}: AtomicEconomicBuilderProps) {
  // Use the custom hook for all state management
  const builder = useAtomicEconomicBuilder({
    countryId,
    initialSelection,
    maxComponents,
    onSelectionChange: undefined // Handle changes locally
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSave = () => {
    if (builder.validation.valid) {
      onSave?.(builder.selectedComponents);
    }
  };

  const handleReset = () => {
    builder.handleClear();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="atomic-economic-builder space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Atomic Economic System Builder
            </span>
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={builder.selectedComponents.length === 0}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={!builder.validation.valid}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Build your economy by selecting complementary components. Discover synergies and avoid conflicts
            to maximize effectiveness.
          </p>
        </CardContent>
      </Card>

      {/* Validation Alerts */}
      {!builder.validation.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {builder.validation.errors.map((error, idx) => (
              <div key={idx}>{error}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {builder.validation.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {builder.validation.warnings.map((warning, idx) => (
              <div key={idx}>{warning}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Templates */}
      {!isReadOnly && (
        <TemplateSelector
          templates={builder.templates.available}
          onLoadTemplate={builder.templates.load}
          disabled={isReadOnly}
        />
      )}

      {/* Metrics Panel */}
      {builder.selectedComponents.length > 0 && (
        <MetricsPanel metrics={builder.metrics} />
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <CategoryFilter
            category={builder.categoryFilter.category}
            setCategory={builder.categoryFilter.setCategory}
          />
          <ComponentSearch
            query={builder.search.query}
            setQuery={builder.search.setQuery}
            placeholder="Search economic components..."
          />
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Components */}
        <div className="lg:col-span-2">
          <ComponentLibrary
            components={builder.availableComponents}
            onSelect={builder.handleSelect}
            selectedIds={builder.selectedIds}
            canSelectMore={builder.canSelect}
          />
        </div>

        {/* Selected Components */}
        <div className="space-y-6">
          <SelectedComponentsList
            selectedComponents={builder.selectedComponents}
            onDeselect={builder.handleDeselect}
            maxComponents={maxComponents}
          />
        </div>
      </div>

      {/* Synergies and Conflicts */}
      {builder.selectedComponents.length > 1 && (
        <SynergyDisplay
          synergies={builder.synergies}
          conflicts={builder.conflicts}
          components={builder.selectedComponents}
        />
      )}

      {/* Action Buttons (Bottom) */}
      {!isReadOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {builder.selectedComponents.length} / {maxComponents} components selected
              </div>
              <div className="flex items-center gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={!builder.validation.valid}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Economic Configuration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

// Re-export types and utilities for external use
export {
  formatComponentName,
  EconomicComponentType,
  EconomicCategory
} from '~/lib/atomic-economic-data';

export {
  calculateEconomicEffectiveness,
  checkEconomicSynergy,
  checkEconomicConflict
} from '~/lib/atomic-economic-utils';

// Default export for convenience
export default AtomicEconomicBuilder;
