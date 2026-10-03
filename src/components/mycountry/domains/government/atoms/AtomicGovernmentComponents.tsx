"use client";

import React, { useMemo } from "react";
import { Button } from "~/components/ui/button";
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
import { GovernmentMetricModals, type MetricTab } from "./GovernmentMetricModals";
import { Card } from "~/components/ui/card";

interface AtomicGovernmentComponentsProps {
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
  const { mutate: trackUsage } = api.governmentComponents.incrementComponentUsage.useMutation();
  const incrementUsage = (componentType: ComponentType) => trackUsage({ componentType });

  const builder = useAtomicGovernmentBuilder({
    initialComponents,
    maxComponents,
    isReadOnly,
    onChange,
    defaultCategoryFilter,
  });

  const categories = useMemo(() => getCategories(ATOMIC_COMPONENTS), []);

  // Category counts for the filtered components
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(builder.filteredComponents).forEach((comp) => {
      if (comp?.category) {
        counts[comp.category] = (counts[comp.category] ?? 0) + 1;
      }
    });
    return counts;
  }, [builder.filteredComponents]);

  const selectedComponentObjects = builder.selectedComponents
    .map((type) => ATOMIC_COMPONENTS[type])
    .filter((comp) => comp !== undefined);

  const [openTab, setOpenTab] = React.useState<MetricTab | null>(null);
  const [welcomeOpen, setWelcomeOpen] = React.useState(true);

  const metrics = {
    totalComponents: builder.selectedComponents.length,
    totalEffectiveness: builder.effectiveness.totalEffectiveness,
    implementationCost: builder.implementationCost,
    maintenanceCost: builder.maintenanceCost,
    synergyCount: builder.synergies.length,
    conflictCount: builder.conflicts.length,
  };

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

  const handleSave = () => {
    if (builder.validation.isValid) {
      builder.selectedComponents.forEach((componentType) => {
        incrementUsage(componentType);
      });
      onSave?.(builder.selectedComponents);
    }
  };

  const handleComponentSelect = (componentType: ComponentType) => {
    builder.selectComponent(componentType);
    incrementUsage(componentType);
  };

  const workspaceContent = (
    <div className="space-y-6">
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
        {!standalone && <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />}
        {!standalone && (
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Blocks aria-hidden="true" className="text-yellow h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-label text-title-2 flex flex-wrap items-center gap-2">
                    Atomic government builder
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
                    Save configuration
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
        {!standalone && (
          <Alert>
            <Info className="text-label-secondary h-4 w-4" />
            <AlertDescription className="text-footnote leading-normal">
              Select {maxComponents} government components to build your custom governance system.
              Watch for synergies (bonuses) and conflicts (penalties) between components.
            </AlertDescription>
          </Alert>
        )}
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
        <MetricsPanel
          metrics={metrics}
          onComponentsClick={() => setOpenTab("components")}
          onEffectivenessClick={() => setOpenTab("effectiveness")}
          onImplementationClick={() => setOpenTab("costs")}
          onMaintenanceClick={() => setOpenTab("costs")}
          onSynergiesClick={() => setOpenTab("interactions")}
          onConflictsClick={() => setOpenTab("interactions")}
        />
        <GovernmentMetricModals
          openTab={openTab}
          onClose={() => setOpenTab(null)}
          selectedComponentObjects={selectedComponentObjects}
          isReadOnly={isReadOnly}
          onDeselect={builder.deselectComponent}
          implementationCost={builder.implementationCost}
          maintenanceCost={builder.maintenanceCost}
          effectiveness={builder.effectiveness}
          synergies={builder.synergies}
          conflicts={builder.conflicts}
        />
        {standalone ? workspaceContent : <Card className="p-6">{workspaceContent}</Card>}
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

export { ComponentType } from "~/lib/enums";
export { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
