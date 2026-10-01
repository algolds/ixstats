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
import { FacetCard } from "~/components/ui/facet-container";
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
import { api } from "~/trpc/react";
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
  // Usage counts for the admin component statistics
  const { mutate: trackUsage } = api.governmentComponents.incrementComponentUsage.useMutation();
  const incrementUsage = (componentType: ComponentType) => trackUsage({ componentType });

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

  const workspaceContent = (
    <div className="space-y-6">
      {/* Filter and Search Bar */}
      {!hideCategorySelector && (
        <div className="border-separator border-b pb-6">
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
              <h3 className="text-label text-headline">Available components</h3>
              <Badge variant="outline" className="text-label-secondary tabular-nums">
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
          <div className="border-separator border-t pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
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
        {!standalone && <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />}

        {/* Header Section */}
        {!standalone && (
          <FacetCard className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Blocks aria-hidden="true" className="text-yellow h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-label text-title-2 flex flex-wrap items-center gap-2">
                    Atomic Government Builder
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setWelcomeOpen(true)}
                      aria-label="Open the atomic government guide"
                    >
                      <HelpCircle className="text-label-secondary h-4 w-4" />
                    </Button>
                  </h2>
                  <p className="text-label-secondary text-body">
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
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!builder.validation.isValid}>
                    <Save className="h-4 w-4" />
                    Save Configuration
                  </Button>
                </div>
              )}
            </div>
          </FacetCard>
        )}

        {/* Info Alert */}
        {!standalone && (
          <Alert>
            <Info className="text-label-secondary h-4 w-4" />
            <AlertDescription className="text-footnote leading-normal">
              Select {maxComponents} government components to build your custom governance system.
              Watch for synergies (bonuses) and conflicts (penalties) between components.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {!builder.validation.isValid && builder.validation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="text-caption list-inside list-disc space-y-1 font-semibold">
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
        {standalone ? workspaceContent : <FacetCard className="p-6">{workspaceContent}</FacetCard>}

        {/* Save Button (Bottom) */}
        {!isReadOnly && !standalone && (
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={builder.clearSelection}
              disabled={builder.selectedComponents.length === 0}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Reset selection
            </Button>
            <Button onClick={handleSave} disabled={!builder.validation.isValid} size="lg">
              <Save aria-hidden="true" className="h-4 w-4" />
              Save government configuration
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
