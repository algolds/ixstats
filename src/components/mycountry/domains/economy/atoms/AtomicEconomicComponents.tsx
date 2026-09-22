"use client";

/**
 * Atomic Economic Components - Main Orchestrator
 *
 * Modular version using shared atomic primitives and composition pattern.
 * Features live InstitutionalFoundationRibbon connecting Step 3 Government to Step 4 Economics,
 * interactive metrics dashboard, and responsive component library.
 */

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";
import { EconomicMetricModals } from "./EconomicMetricModals";
import {
  Dollar as DollarSign,
  WarningTriangle as AlertTriangle,
  FloppyDisk as Save,
  Undo as RotateCcw,
  Database,
  HelpCircle,
} from "iconoir-react";

// Data imports
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  ECONOMIC_TEMPLATES,
  type EconomicComponentType,
  EconomicCategory,
} from "~/lib/economy/atomic-data";

// Shared Atomic Primitives
import {
  InstitutionalFoundationRibbon,
  AtomicFilterBar,
} from "~/components/shared/atomic-picker";

// Hook import for database integration
import { useEconomicComponentsData } from "~/hooks/useEconomicComponentsData";

// Hook import
import { useAtomicEconomicBuilder } from "~/hooks/useAtomicEconomicBuilder";

// Feature-sliced module imports
import {
  ComponentLibrary,
  SelectedComponentsList,
  MetricsPanel,
  SynergyDisplay,
} from "~/components/mycountry/domains/economy/atomic";

// ============================================================================
// Type Definitions
// ============================================================================

export interface AtomicEconomicComponentSelectorProps {
  selectedComponents: EconomicComponentType[];
  onComponentChange: (components: EconomicComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
  governmentComponents?: string[];
  hideSelectedList?: boolean;
  standalone?: boolean;
}

// ============================================================================
// Main Component - Unified Selector Version
// ============================================================================

/**
 * Atomic Economic Component Selector (Unified/Modular)
 *
 * Structured with Apple HIG pacing, Institutional Foundation ribbon,
 * interactive metrics, search, category filters, and component library.
 */
export function AtomicEconomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  // oxlint-disable-next-line eslint/no-unused-vars
  isReadOnly = false,
  governmentComponents = [],
  hideSelectedList = false,
  standalone = false,
}: AtomicEconomicComponentSelectorProps) {
  // Use database hook for component data
  const {
    // oxlint-disable-next-line eslint/no-unused-vars
    components: _dbComponents,
    isLoading,
    isUsingFallback,
    incrementUsage,
  } = useEconomicComponentsData();

  // Initialize the economic builder hook
  const builder = useAtomicEconomicBuilder({
    initialSelection: selectedComponents,
    maxComponents,
    onSelectionChange: onComponentChange,
  });

  // Track newly selected components with usage tracking
  const handleComponentSelect = useCallback(
    (componentType: EconomicComponentType) => {
      builder.handleToggle(componentType);
      incrementUsage(componentType);
    },
    [builder, incrementUsage]
  );

  // Dialog state for active synergies/conflicts and detailed breakdown views
  const [interactionsOpen, setInteractionsOpen] = useState(false);
  const [selectedListOpen, setSelectedListOpen] = useState(false);
  const [effectivenessOpen, setEffectivenessOpen] = useState(false);
  const [implementationOpen, setImplementationOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  // Map selected component types to full objects
  const selectedComponentObjects = useMemo(() => {
    return builder.selectedComponents
      .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type])
      .filter((comp): comp is NonNullable<typeof comp> => comp !== undefined);
  }, [builder.selectedComponents]);

  // Categories list
  const categories = useMemo(() => Object.keys(COMPONENT_CATEGORIES), []);

  // Calculate category counts based on search query
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    builder.availableComponents.forEach((compType) => {
      const comp = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (comp?.category) {
        counts[comp.category] = (counts[comp.category] ?? 0) + 1;
      }
    });
    return counts;
  }, [builder.availableComponents]);

  // Flatten metrics object to pass to MetricsPanel
  const flatMetrics = useMemo(
    () => ({
      totalComponents: builder.selectedComponents.length,
      totalEffectiveness: builder.metrics.effectiveness.totalEffectiveness,
      implementationCost: builder.metrics.totalCost,
      maintenanceCost: builder.metrics.maintenanceCost,
      synergyCount: builder.synergies.length,
      conflictCount: builder.conflicts.length,
    }),
    [
      builder.selectedComponents.length,
      builder.metrics.effectiveness.totalEffectiveness,
      builder.metrics.totalCost,
      builder.metrics.maintenanceCost,
      builder.synergies.length,
      builder.conflicts.length,
    ]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse space-y-2">
            <Database className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading economic components...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const workspaceContent = (
    <div className="space-y-6">
      {/* Filter, Search and Template Selector Row */}
      <div className="border-b border-border/40 pb-6">
        <AtomicFilterBar
          searchQuery={builder.search.query}
          onSearchChange={builder.search.setQuery}
          categories={categories}
          selectedCategory={builder.categoryFilter.category}
          onCategoryChange={(cat) => builder.categoryFilter.setCategory(cat as EconomicCategory | null)}
          categoryCounts={categoryCounts}
          templates={ECONOMIC_TEMPLATES}
          onTemplateSelect={builder.templates.load}
          searchPlaceholder="Search economic components by name or description..."
        />
      </div>

      {/* Library and Selected sidebar list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Component Library (2/3 width) */}
        <div className={hideSelectedList ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Available Components
              </h3>
              <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                {builder.selectedComponents.length} / {maxComponents} selected
              </Badge>
            </div>

            <ComponentLibrary
              components={builder.availableComponents}
              onSelect={handleComponentSelect}
              selectedIds={builder.selectedIds}
              canSelectMore={builder.canSelect}
            />
          </div>
        </div>

        {/* Selected Components Sidebar List (1/3 width) */}
        {!hideSelectedList && (
          <div className="border-t border-border/40 pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <SelectedComponentsList
              selectedComponents={builder.selectedComponents}
              onDeselect={builder.handleDeselect}
              maxComponents={maxComponents}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Ambient Institutional Foundation Ribbon */}
        {governmentComponents && governmentComponents.length > 0 && (
          <InstitutionalFoundationRibbon
            governmentComponents={governmentComponents}
            economicComponents={builder.selectedComponents}
          />
        )}

        {/* Fallback Warning Banner */}
        {isUsingFallback && (
          <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Database className="h-4 w-4 text-amber-400" />
            <AlertDescription className="font-medium">
              Using local component data. Database connection unavailable or empty.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {!builder.validation.valid && builder.validation.errors.length > 0 && (
          <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-400">
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1 text-xs font-semibold">
                {builder.validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics Panel */}
        <MetricsPanel
          metrics={flatMetrics}
          onComponentsClick={() => setSelectedListOpen(true)}
          onEffectivenessClick={() => setEffectivenessOpen(true)}
          onImplementationClick={() => setImplementationOpen(true)}
          onMaintenanceClick={() => setMaintenanceOpen(true)}
          onSynergiesClick={() => setInteractionsOpen(true)}
          onConflictsClick={() => setInteractionsOpen(true)}
        />

        {/* Unified Metric Inspection Modals */}
        <EconomicMetricModals
          selectedListOpen={selectedListOpen}
          setSelectedListOpen={setSelectedListOpen}
          interactionsOpen={interactionsOpen}
          setInteractionsOpen={setInteractionsOpen}
          effectivenessOpen={effectivenessOpen}
          setEffectivenessOpen={setEffectivenessOpen}
          implementationOpen={implementationOpen}
          setImplementationOpen={setImplementationOpen}
          maintenanceOpen={maintenanceOpen}
          setMaintenanceOpen={setMaintenanceOpen}
          selectedComponentTypes={builder.selectedComponents}
          selectedComponentObjects={selectedComponentObjects}
          maxComponents={maxComponents}
          onDeselect={builder.handleDeselect}
          implementationCost={builder.metrics.totalCost}
          maintenanceCost={builder.metrics.maintenanceCost}
          effectiveness={builder.metrics.effectiveness}
          synergies={builder.synergies}
          conflicts={builder.conflicts}
        />

        {/* Main Workspace Card or Standalone */}
        {standalone ? (
          workspaceContent
        ) : (
          <Card className="border-border/40 bg-card/40 shadow-xl backdrop-blur-xl">
            <div className="space-y-6 p-6">{workspaceContent}</div>
          </Card>
        )}
      </div>
    </TooltipProvider>
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
 * Custom builder with interactive MetricsPanel.
 */
export function AtomicEconomicBuilder({
  countryId,
  initialSelection = [],
  maxComponents = 15,
  onSave,
  onCancel,
  isReadOnly = false,
}: AtomicEconomicBuilderProps) {
  // Use the custom hook for all state management
  const builder = useAtomicEconomicBuilder({
    countryId,
    initialSelection,
    maxComponents,
    onSelectionChange: undefined,
  });

  const handleSave = () => {
    if (builder.validation.valid) {
      onSave?.(builder.selectedComponents);
    }
  };

  const handleReset = () => {
    builder.handleClear();
  };

  const categories = useMemo(() => Object.keys(COMPONENT_CATEGORIES), []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    builder.availableComponents.forEach((compType) => {
      const comp = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (comp?.category) {
        counts[comp.category] = (counts[comp.category] ?? 0) + 1;
      }
    });
    return counts;
  }, [builder.availableComponents]);

  return (
    <div className="atomic-economic-builder space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
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
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={!builder.validation.valid}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Build your economy by selecting complementary components. Discover synergies and avoid
            conflicts to maximize effectiveness.
          </p>
        </CardContent>
      </Card>

      {/* Validation Alerts */}
      {!builder.validation.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {builder.validation.errors.map((error, idx) => (
              <div key={idx}>{error}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {builder.validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {builder.validation.warnings.map((warning, idx) => (
              <div key={idx}>{warning}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Panel */}
      {builder.selectedComponents.length > 0 && (
        <MetricsPanel
          metrics={{
            totalComponents: builder.selectedComponents.length,
            totalEffectiveness: builder.metrics.effectiveness.totalEffectiveness,
            implementationCost: builder.metrics.totalCost,
            maintenanceCost: builder.metrics.maintenanceCost,
            synergyCount: builder.synergies.length,
            conflictCount: builder.conflicts.length,
          }}
        />
      )}

      {/* Filter and Search */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <AtomicFilterBar
            searchQuery={builder.search.query}
            onSearchChange={builder.search.setQuery}
            categories={categories}
            selectedCategory={builder.categoryFilter.category}
            onCategoryChange={(cat) => builder.categoryFilter.setCategory(cat as EconomicCategory | null)}
            categoryCounts={categoryCounts}
            templates={ECONOMIC_TEMPLATES}
            onTemplateSelect={builder.templates.load}
            searchPlaceholder="Search economic components..."
          />
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Available Components */}
        <div className="lg:col-span-2">
          <ComponentLibrary
            components={builder.availableComponents}
            onSelect={builder.handleToggle}
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
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {builder.selectedComponents.length} / {maxComponents} components selected
              </div>
              <div className="flex items-center gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button variant="default" onClick={handleSave} disabled={!builder.validation.valid}>
                  <Save className="mr-2 h-4 w-4" />
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

export {
  formatComponentName,
  EconomicComponentType,
  EconomicCategory,
} from "~/lib/economy/atomic-data";

export {
  calculateEconomicEffectiveness,
  checkEconomicSynergy,
  checkEconomicConflict,
} from "~/lib/economy/atomic-utils";

export default AtomicEconomicBuilder;
