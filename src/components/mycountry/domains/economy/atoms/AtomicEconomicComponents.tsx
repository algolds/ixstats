"use client";

import { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";
import { EconomicMetricModals, type MetricTab } from "./EconomicMetricModals";

import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  ECONOMIC_TEMPLATES,
  type EconomicComponentType,
  EconomicCategory,
} from "~/lib/economy/atomic-data";

import { InstitutionalFoundationRibbon, AtomicFilterBar } from "~/components/shared/atomic-picker";

import { api } from "~/trpc/react";

import { useAtomicEconomicBuilder } from "~/hooks/useAtomicEconomicBuilder";

import {
  ComponentLibrary,
  SelectedComponentsList,
  MetricsPanel,
} from "~/components/mycountry/domains/economy/atomic";
import { Card, CardContent } from "~/components/ui/card";

interface AtomicEconomicComponentSelectorProps {
  selectedComponents: EconomicComponentType[];
  onComponentChange: (components: EconomicComponentType[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
  governmentComponents?: string[];
  hideSelectedList?: boolean;
  standalone?: boolean;
}

/** Atomic economic component selector: foundation ribbon, metrics, search, filters and the component library. */
export function AtomicEconomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  governmentComponents = [],
  hideSelectedList = false,
  standalone = false,
}: AtomicEconomicComponentSelectorProps) {
  // Usage counts for the admin component statistics
  const { mutate: trackUsage } = api.economicComponents.incrementComponentUsage.useMutation();

  // Initialize the economic builder hook
  const builder = useAtomicEconomicBuilder({
    initialSelection: selectedComponents,
    maxComponents,
    onSelectionChange: onComponentChange,
  });

  // Track newly selected components with usage tracking
  const handleComponentSelect = (componentType: EconomicComponentType) => {
    builder.handleToggle(componentType);
    trackUsage({ componentType });
  };

  const [openTab, setOpenTab] = useState<MetricTab | null>(null);

  // Map selected component types to full objects
  const selectedComponentObjects = builder.selectedComponents
    .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type])
    .filter((comp): comp is NonNullable<typeof comp> => comp !== undefined);

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

  const flatMetrics = {
    totalComponents: builder.selectedComponents.length,
    totalEffectiveness: builder.metrics.effectiveness.totalEffectiveness,
    implementationCost: builder.metrics.totalCost,
    maintenanceCost: builder.metrics.maintenanceCost,
    synergyCount: builder.synergies.length,
    conflictCount: builder.conflicts.length,
  };

  const workspaceContent = (
    <div className="space-y-6">
      <div className="border-separator border-b pb-6">
        <AtomicFilterBar
          searchQuery={builder.search.query}
          onSearchChange={builder.search.setQuery}
          categories={categories}
          selectedCategory={builder.categoryFilter.category}
          onCategoryChange={(cat) =>
            builder.categoryFilter.setCategory(cat as EconomicCategory | null)
          }
          categoryCounts={categoryCounts}
          templates={ECONOMIC_TEMPLATES}
          onTemplateSelect={builder.templates.load}
          searchPlaceholder="Search economic components by name or description..."
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={hideSelectedList ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3>
                <span className="text-stat-label text-label-secondary block">
                  Available components
                </span>
              </h3>
              <Badge variant="default" className="tabular-nums">
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
        {!hideSelectedList && (
          <div className="border-separator border-t pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
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
        {governmentComponents && governmentComponents.length > 0 && (
          <InstitutionalFoundationRibbon
            governmentComponents={governmentComponents}
            economicComponents={builder.selectedComponents}
          />
        )}
        {!builder.validation.valid && builder.validation.errors.length > 0 && (
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
          metrics={flatMetrics}
          onComponentsClick={() => setOpenTab("components")}
          onEffectivenessClick={() => setOpenTab("effectiveness")}
          onImplementationClick={() => setOpenTab("costs")}
          onMaintenanceClick={() => setOpenTab("costs")}
          onSynergiesClick={() => setOpenTab("interactions")}
          onConflictsClick={() => setOpenTab("interactions")}
        />
        <EconomicMetricModals
          openTab={openTab}
          onClose={() => setOpenTab(null)}
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
        {standalone ? (
          workspaceContent
        ) : (
          <Card className="rounded-card">
            <CardContent className="space-y-6 p-6">{workspaceContent}</CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

export { EconomicComponentType } from "~/lib/economy/atomic-data";
