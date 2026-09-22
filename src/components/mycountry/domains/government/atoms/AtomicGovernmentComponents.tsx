"use client";

/**
 * Atomic Government Components
 *
 * Main orchestrator component for the atomic government builder system.
 * Uses modular UI components with clean composition.
 *
 * @module AtomicGovernmentComponents
 */

import React, { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import {
  FloppyDisk as Save,
  Undo as RotateCcw,
  InfoCircle as Info,
  Component as Blocks,
  HelpCircle,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { useAtomicGovernmentBuilder } from "~/hooks/useAtomicGovernmentBuilder";
import { ATOMIC_COMPONENTS, GOVERNMENT_TEMPLATES } from "~/lib/government/atomic-data";
import { getCategories } from "~/lib/government/atomic-utils";
import { useGovernmentComponentsData } from "~/hooks/useGovernmentComponentsData";
import {
  ComponentLibrary,
  SelectedComponentsList,
  MetricsPanel,
  AtomicWelcomeModal,
} from "~/components/mycountry/domains/government/atomic";
import { AtomicFilterBar } from "~/components/shared/atomic-picker";
import { ComponentType } from "~/lib/enums";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";
import { GovernmentMetricModals } from "./GovernmentMetricModals";

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
  /** Standalone mode to hide header and global action buttons */
  standalone?: boolean;
  /** Default category to filter by */
  defaultCategoryFilter?: string | null;
  /** Hide the category selector filter */
  hideCategorySelector?: boolean;
  /** Hide the SelectedComponentsList (for use when rendering it externally) */
  hideSelectedList?: boolean;
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
  standalone = false,
  defaultCategoryFilter = null,
  hideCategorySelector = false,
  hideSelectedList = false,
}: AtomicGovernmentComponentsProps) {
  // Fetch component data from database (with fallback)
  const {
    // oxlint-disable-next-line eslint/no-unused-vars
    components: _componentData,
    isLoading: componentsLoading,
    isUsingFallback,
    incrementUsage,
  } = useGovernmentComponentsData();

  // Initialize builder hook
  const builder = useAtomicGovernmentBuilder({
    initialComponents,
    maxComponents,
    isReadOnly,
    onChange,
    defaultCategoryFilter,
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

  // Get unique categories of currently selected components
  const selectedCategories = useMemo(() => {
    const selected = new Set<string>();
    selectedComponentObjects.forEach((comp) => {
      if (comp?.category) {
        selected.add(comp.category.toLowerCase());
      }
    });
    return selected;
  }, [selectedComponentObjects]);

  // Dialog state for active synergies/conflicts & details
  const [interactionsOpen, setInteractionsOpen] = React.useState(false);
  const [selectedListOpen, setSelectedListOpen] = React.useState(false);
  const [effectivenessOpen, setEffectivenessOpen] = React.useState(false);
  const [implementationOpen, setImplementationOpen] = React.useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(false);
  const [welcomeOpen, setWelcomeOpen] = React.useState(true);

  const handleSynergiesClick = React.useCallback(() => {
    setInteractionsOpen(true);
  }, []);

  const handleConflictsClick = React.useCallback(() => {
    setInteractionsOpen(true);
  }, []);

  const handleComponentsClick = React.useCallback(() => {
    setSelectedListOpen(true);
  }, []);

  const handleEffectivenessClick = React.useCallback(() => {
    setEffectivenessOpen(true);
  }, []);

  const handleImplementationClick = React.useCallback(() => {
    setImplementationOpen(true);
  }, []);

  const handleMaintenanceClick = React.useCallback(() => {
    setMaintenanceOpen(true);
  }, []);

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

  const isAllCategoriesSelected = builder.categoryFilter === null;

  // Templates list for AtomicFilterBar
  const templatesList = useMemo(() => {
    return Object.entries(GOVERNMENT_TEMPLATES).map(([id, t]) => ({
      id,
      name: t.name,
      description: t.description,
      components: t.components,
    }));
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
      builder.selectedComponents.forEach((componentType) => {
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
      <div className="flex h-64 items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500"></div>
          <p className="text-sm text-muted-foreground">Loading components...</p>
        </div>
      </div>
    );
  }

  const workspaceContent = (
    <div className="space-y-6">
      {/* Filter and Search Bar */}
      {!hideCategorySelector && (
        <div className="border-b border-border/40 pb-6">
          <AtomicFilterBar
            searchQuery={builder.searchQuery}
            onSearchChange={builder.setSearchQuery}
            categories={categories}
            selectedCategory={builder.categoryFilter}
            onCategoryChange={builder.setCategoryFilter}
            categoryCounts={categoryCounts}
            templates={templatesList}
            onTemplateSelect={handleTemplateSelect}
            searchPlaceholder="Search components by name or description..."
            disabled={isReadOnly}
          />
        </div>
      )}

      {/* Library and Selected list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
              components={builder.filteredComponents}
              selectedIds={builder.selectedComponents}
              onSelect={handleComponentSelect}
              onDeselect={builder.deselectComponent}
              isReadOnly={isReadOnly}
              canSelectMore={builder.canSelectMore}
              enableInlineScroll={true}
            />
          </div>
        </div>

        {!hideSelectedList && (
          <div className="border-t border-border/40 pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <SelectedComponentsList
              selectedComponents={selectedComponentObjects}
              onDeselect={builder.deselectComponent}
              isReadOnly={isReadOnly}
              totalCost={builder.implementationCost}
              totalEffectiveness={builder.effectiveness.totalEffectiveness}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Welcome & Instruction Modal */}
        {!standalone && (
          <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
        )}

        {/* Fallback Warning Banner */}
        {isUsingFallback && (
          <Alert variant="default" className="border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Info className="h-4 w-4 text-amber-400" />
            <AlertDescription className="font-medium">
              Using local component data. Database connection unavailable or empty.
            </AlertDescription>
          </Alert>
        )}

        {/* Header Section */}
        {!standalone && (
          <Card className="border-white/10 shadow-lg backdrop-blur-md">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                    <Blocks className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl font-extrabold text-zinc-100">
                      Atomic Government Builder
                      <button
                        type="button"
                        onClick={() => setWelcomeOpen(true)}
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300 hover:underline"
                      >
                        (Guide)
                      </button>
                    </CardTitle>
                    <p className="text-sm text-zinc-400">
                      Assemble your governance structure from atomic principles
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                {!isReadOnly && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={builder.clearSelection}
                      disabled={builder.selectedComponents.length === 0}
                      className="border-white/10 bg-white/5 hover:bg-white/10"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={!builder.validation.isValid}
                      className="bg-amber-600 font-bold text-white hover:bg-amber-500 shadow-amber-500/20"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Info Alert */}
        {!standalone && (
          <Alert className="border-white/10 bg-white/[0.02] text-zinc-300">
            <Info className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-xs leading-normal">
              Select {maxComponents} government components to build your custom governance system.
              Watch for synergies (bonuses) and conflicts (penalties) between components.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {!builder.validation.isValid && builder.validation.errors.length > 0 && (
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
          metrics={metrics}
          onComponentsClick={handleComponentsClick}
          onEffectivenessClick={handleEffectivenessClick}
          onImplementationClick={handleImplementationClick}
          onMaintenanceClick={handleMaintenanceClick}
          onSynergiesClick={handleSynergiesClick}
          onConflictsClick={handleConflictsClick}
        />

        {/* Metric Modals & Dialogs */}
        <GovernmentMetricModals
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
          selectedComponentObjects={selectedComponentObjects}
          isReadOnly={isReadOnly}
          onDeselect={builder.deselectComponent}
          implementationCost={builder.implementationCost}
          maintenanceCost={builder.maintenanceCost}
          effectiveness={builder.effectiveness}
          synergies={builder.synergies}
          conflicts={builder.conflicts}
        />

        {/* Main Workspace */}
        {standalone ? (
          workspaceContent
        ) : (
          <Card className="border-border/60 bg-card/40 shadow-2xl backdrop-blur-xl">
            <div className="space-y-6 p-6">{workspaceContent}</div>
          </Card>
        )}

        {/* Save Button (Bottom) */}
        {!isReadOnly && !standalone && (
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={builder.clearSelection}
              disabled={builder.selectedComponents.length === 0}
              className="border-white/10 text-zinc-300 hover:bg-white/5"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Selection
            </Button>
            <Button
              onClick={handleSave}
              disabled={!builder.validation.isValid}
              size="lg"
              className="bg-amber-600 font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-500"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Government Configuration
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Re-export types and utilities for convenience
export { ComponentType } from "~/lib/enums";
export { ATOMIC_COMPONENTS, GOVERNMENT_TEMPLATES } from "~/lib/government/atomic-data";
export type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
export {
  calculateGovernmentEffectiveness,
  checkGovernmentSynergy,
  checkGovernmentConflict,
} from "~/lib/government/atomic-utils";

// Export alias for backward compatibility
export { AtomicGovernmentComponents as AtomicComponentSelector };
