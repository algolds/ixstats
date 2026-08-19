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

import React, { useMemo } from "react";
import { Button } from "~/components/ui/button";
// eslint-disable-next-line unused-imports/no-unused-imports
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Save,
  RotateCcw,
  Info,
  Blocks,
  Zap,
  AlertTriangle,
  Package,
  HelpCircle,
  Target,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useAtomicGovernmentBuilder } from "~/hooks/useAtomicGovernmentBuilder";
import { ATOMIC_COMPONENTS, GOVERNMENT_TEMPLATES } from "~/lib/government/atomic-data";
import { getCategories } from "~/lib/government/atomic-utils";
import { useGovernmentComponentsData } from "~/hooks/useGovernmentComponentsData";
import { GlassCard } from "~/components/ui/enhanced-card";
import {
  ComponentLibrary,
  SelectedComponentsList,
  CategoryFilter,
  ComponentSearch,
  MetricsPanel,
  AtomicWelcomeModal,
} from "~/components/mycountry/domains/government/atomic";
import { ComponentType } from "~/lib/enums";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";

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
    components: componentData,
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

  // Dialog state for active synergies/conflicts
  const [interactionsOpen, setInteractionsOpen] = React.useState(false);
  const [selectedListOpen, setSelectedListOpen] = React.useState(false);
  const [effectivenessOpen, setEffectivenessOpen] = React.useState(false);
  const [implementationOpen, setImplementationOpen] = React.useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(false);
  const [welcomeOpen, setWelcomeOpen] = React.useState(false);

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
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Welcome & Instruction Modal */}
        {!standalone && <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />}

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
          <GlassCard
            variant="glass"
            glow={false}
            className="border-white/10 shadow-lg backdrop-blur-md"
          >
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-2">
                    <Blocks className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl font-extrabold text-zinc-100">
                      Atomic Government Builder
                      <button
                        onClick={() => setWelcomeOpen(true)}
                        className="cursor-pointer text-zinc-400 transition-colors hover:text-cyan-400"
                        title="Open Help Guide"
                      >
                        <HelpCircle className="h-5 w-5" />
                      </button>
                    </CardTitle>
                    <p className="mt-1 text-sm text-zinc-400">
                      Build your government from modular components
                      {isUsingFallback && " (Local Mode)"}
                    </p>
                  </div>
                </div>
                {!isReadOnly && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={builder.clearSelection}
                      disabled={builder.selectedComponents.length === 0}
                      className="border-white/10 text-zinc-300 hover:bg-white/5"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!builder.validation.isValid}
                      className="bg-cyan-600 font-bold text-white shadow-md shadow-cyan-500/10 hover:bg-cyan-500"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </GlassCard>
        )}

        {/* Info Alert */}
        {!standalone && (
          <Alert className="border-white/10 bg-white/[0.02] text-zinc-300">
            <Info className="h-4 w-4 text-cyan-400" />
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

        {/* Selected Components Dialog */}
        <Dialog open={selectedListOpen} onOpenChange={setSelectedListOpen}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Selected Components ({selectedComponentObjects.length})
              </DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <SelectedComponentsList
                selectedComponents={selectedComponentObjects}
                onDeselect={(type) => {
                  builder.deselectComponent(type);
                }}
                isReadOnly={isReadOnly}
                totalCost={builder.implementationCost}
                totalEffectiveness={builder.effectiveness.totalEffectiveness}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Component Interactions Dialog */}
        <Dialog open={interactionsOpen} onOpenChange={setInteractionsOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Government Interactions
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Active Synergies */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-green-600 uppercase dark:text-green-400">
                  <Zap className="h-4 w-4" />
                  Active Synergies ({builder.synergies.length})
                </h4>
                {builder.synergies.length === 0 ? (
                  <p className="pl-6 text-xs text-zinc-500 italic">No active synergies.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {builder.synergies.map(({ comp1, comp2, score }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${comp1}-${comp2}-${index}`}
                          className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 transition-colors hover:bg-green-500/10 dark:hover:bg-green-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="dark:text-foreground text-xs font-semibold text-zinc-900">
                                {component1.name} + {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-green-600 dark:text-green-400/90">
                                Complementary systems boost administrative output.
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border border-green-500/20 bg-green-600/10 font-bold text-green-600 dark:text-green-400"
                            >
                              +{score}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Conflicts */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-red-600 uppercase dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Active Conflicts ({builder.conflicts.length})
                </h4>
                {builder.conflicts.length === 0 ? (
                  <p className="pl-6 text-xs text-zinc-500 italic">No active conflicts.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {builder.conflicts.map(({ comp1, comp2 }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${comp1}-${comp2}-${index}`}
                          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="dark:text-foreground text-xs font-semibold text-zinc-900">
                                {component1.name} vs {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400/90">
                                Incompatible policies drag down performance.
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border border-red-500/20 bg-red-600/10 font-bold text-red-600 dark:text-red-400"
                            >
                              -15%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Effectiveness Detail Dialog */}
        <Dialog open={effectivenessOpen} onOpenChange={setEffectivenessOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Government Effectiveness Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-white/[0.02]">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Base Score
                  </p>
                  <p className="text-xl font-extrabold text-zinc-800 dark:text-zinc-300">
                    {builder.effectiveness.baseEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Synergy Bonus
                  </p>
                  <p className="text-xl font-extrabold text-green-600 dark:text-green-400">
                    +{builder.effectiveness.synergyBonus.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Conflict Penalty
                  </p>
                  <p className="text-xl font-extrabold text-red-600 dark:text-red-400">
                    -{builder.effectiveness.conflictPenalty.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Total Score
                  </p>
                  <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                    {builder.effectiveness.totalEffectiveness.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  Component Contributions
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.type}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {comp.name}
                        </span>
                        <span className="font-mono font-bold text-zinc-500 dark:text-zinc-400">
                          {comp.effectiveness}% base
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Implementation Cost Detail Dialog */}
        <Dialog open={implementationOpen} onOpenChange={setImplementationOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Implementation Cost Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-[10px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                  Total Implementation Cost
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-100">
                  ${builder.implementationCost.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  Cost per Component
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.type}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {comp.name}
                          </span>
                          <span className="text-[9px] text-zinc-400 capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${comp.implementationCost.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Maintenance Cost Detail Dialog */}
        <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-zinc-200 bg-white/95 text-zinc-900 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Annual Maintenance Cost Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                <p className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                  Total Annual Maintenance Cost
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-100">
                  ${builder.maintenanceCost.toLocaleString()}/yr
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  Maintenance per Component
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.type}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {comp.name}
                          </span>
                          <span className="text-[9px] text-zinc-400 capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          ${comp.maintenanceCost.toLocaleString()}/yr
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Workspace wrapped in a single premium GlassCard */}
        <GlassCard
          variant="glass"
          glow={false}
          className="border-white/10 bg-white/[0.01] shadow-2xl backdrop-blur-xl dark:bg-black/20"
        >
          <div className="space-y-6 p-6">
            {/* Filter, Search and Template Row */}
            <div className="flex flex-col gap-4 border-b border-white/5 pb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Search Bar & Template Selector unified */}
                <div className="w-full">
                  <ComponentSearch
                    value={builder.searchQuery}
                    onChange={builder.setSearchQuery}
                    placeholder="Search components by name or description..."
                    templates={GOVERNMENT_TEMPLATES}
                    onTemplateSelect={handleTemplateSelect}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Category tabs underneath */}
              {!hideCategorySelector && (
                <div className="pt-2">
                  <CategoryFilter
                    categories={categories}
                    selectedCategory={builder.categoryFilter}
                    onChange={builder.setCategoryFilter}
                    categoryCounts={categoryCounts}
                    selectedCategories={selectedCategories}
                  />
                </div>
              )}
            </div>

            {/* Library and Selected list */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Component Library (2/3 width on large screens) */}
              <div className={hideSelectedList ? "lg:col-span-3" : "lg:col-span-2"}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                      Available Components
                    </h3>
                  </div>

                  <ComponentLibrary
                    components={builder.filteredComponents}
                    selectedIds={builder.selectedComponents}
                    onSelect={handleComponentSelect}
                    onDeselect={builder.deselectComponent}
                    isReadOnly={isReadOnly}
                    canSelectMore={builder.canSelectMore}
                    enableInlineScroll={isAllCategoriesSelected}
                  />
                </div>
              </div>

              {/* Selected Components List (1/3 width on large screens) */}
              {!hideSelectedList && (
                <div className="border-t border-white/5 pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:border-white/5 lg:pt-0 lg:pl-6">
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
        </GlassCard>

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
              className="bg-cyan-600 font-bold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500"
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
