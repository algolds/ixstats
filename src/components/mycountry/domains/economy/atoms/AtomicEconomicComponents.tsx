"use client";

/**
 * Atomic Economic Components - Main Orchestrator
 *
 * Refactored modular version using composition pattern.
 * Supports interactive metrics dashboard and side-by-side selected list.
 */

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Dollar as DollarSign, WarningTriangle as AlertTriangle, FloppyDisk as Save, Undo as RotateCcw, Database, Package, Archery as Target, StatUp as TrendingUp, Flash as Zap } from "iconoir-react";

// Data imports
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  type EconomicComponentType,
} from "~/lib/economy/atomic-data";

// Hook import for database integration
import { useEconomicComponentsData } from "~/hooks/useEconomicComponentsData";

// Hook import
import { useAtomicEconomicBuilder } from "~/hooks/useAtomicEconomicBuilder";

// UI Component imports
import {
  ComponentLibrary,
  SelectedComponentsList,
  CategoryFilter,
  ComponentSearch,
  MetricsPanel,
  TemplateSelector,
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
}

// ============================================================================
// Main Component - Unified Selector Version
// ============================================================================

/**
 * Atomic Economic Component Selector (Unified/Modular)
 *
 * Structured like AtomicGovernmentComponents with an interactive dashboard,
 * metrics detail dialogs, search, category filters, and component lists.
 */
export function AtomicEconomicComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  isReadOnly = false,
  governmentComponents = [],
  hideSelectedList = false,
}: AtomicEconomicComponentSelectorProps) {
  // Use database hook for component data
  const {
    components: dbComponents,
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
      .filter((comp) => comp !== undefined);
  }, [builder.selectedComponents]);

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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
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
                selectedComponents={builder.selectedComponents}
                onDeselect={builder.handleDeselect}
                maxComponents={maxComponents}
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
                Economic Interactions
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
                    {builder.synergies.map((synergy, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${synergy.component1}-${synergy.component2}-${index}`}
                          className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 transition-colors hover:bg-green-500/10 dark:hover:bg-green-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="dark:text-foreground text-xs font-semibold text-zinc-900">
                                {component1.name} + {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-green-600 dark:text-green-400/90">
                                {synergy.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border border-green-500/20 bg-green-600/10 font-bold text-green-600 dark:text-green-400"
                            >
                              +{synergy.bonus}%
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
                    {builder.conflicts.map((conflict, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${conflict.component1}-${conflict.component2}-${index}`}
                          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="dark:text-foreground text-xs font-semibold text-zinc-900">
                                {component1.name} vs {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400/90">
                                {conflict.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border border-red-500/20 bg-red-600/10 font-bold text-red-600 dark:text-red-400"
                            >
                              -{conflict.penalty}%
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
                Economic Effectiveness Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-white/[0.02]">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Base Score
                  </p>
                  <p className="text-xl font-extrabold text-zinc-800 dark:text-zinc-300">
                    {builder.metrics.effectiveness.baseEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Synergy Bonus
                  </p>
                  <p className="text-xl font-extrabold text-green-600 dark:text-green-400">
                    +{builder.metrics.effectiveness.synergyBonus.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Conflict Penalty
                  </p>
                  <p className="text-xl font-extrabold text-red-600 dark:text-red-400">
                    -{builder.metrics.effectiveness.conflictPenalty.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Total Score
                  </p>
                  <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                    {builder.metrics.effectiveness.totalEffectiveness.toFixed(1)}%
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
                        key={comp.id}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <span className="font-medium font-semibold text-zinc-700 dark:text-zinc-300">
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
                  ${builder.metrics.totalCost.toLocaleString()}
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
                        key={comp.id}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium font-semibold text-zinc-700 dark:text-zinc-300">
                            {comp.name}
                          </span>
                          <span className="text-left text-[9px] text-zinc-400 capitalize">
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
                  ${builder.metrics.maintenanceCost.toLocaleString()}/yr
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
                        key={comp.id}
                        className="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs dark:border-white/5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium font-semibold text-zinc-700 dark:text-zinc-300">
                            {comp.name}
                          </span>
                          <span className="text-left text-[9px] text-zinc-400 capitalize">
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

        {/* Main Workspace wrapped in a single premium Card */}
        <Card
          className="border-white/10 bg-white/[0.01] shadow-2xl backdrop-blur-xl dark:bg-black/20"
        >
          <div className="space-y-6 p-6">
            {/* Filter, Search and Template Selector Row */}
            <div className="flex flex-col gap-4 border-b border-white/5 pb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Search Bar */}
                <div className="w-full">
                  <ComponentSearch
                    query={builder.search.query}
                    setQuery={builder.search.setQuery}
                    placeholder="Search economic components by name or description..."
                  />
                </div>
              </div>

              {/* Category tabs */}
              <div className="pt-2">
                <CategoryFilter
                  category={builder.categoryFilter.category}
                  setCategory={builder.categoryFilter.setCategory}
                  componentCounts={categoryCounts}
                />
              </div>
            </div>

            {/* Library and Selected sidebar list */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Component Library (2/3 width) */}
              <div className={hideSelectedList ? "lg:col-span-3" : "lg:col-span-2"}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                      Available Components
                    </h3>
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
                <div className="border-t border-white/5 pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:border-white/5 lg:pt-0 lg:pl-6">
                  <SelectedComponentsList
                    selectedComponents={builder.selectedComponents}
                    onDeselect={builder.handleDeselect}
                    maxComponents={maxComponents}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
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
 * Custom builder with restructured interactive MetricsPanel.
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

  const selectedComponentObjects = useMemo(() => {
    return builder.selectedComponents
      .map((type) => ATOMIC_ECONOMIC_COMPONENTS[type])
      .filter((comp) => comp !== undefined);
  }, [builder.selectedComponents]);

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

      {/* Filters and Search */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <CategoryFilter
            category={builder.categoryFilter.category}
            setCategory={builder.categoryFilter.setCategory}
            componentCounts={categoryCounts}
          />
          <ComponentSearch
            query={builder.search.query}
            setQuery={builder.search.setQuery}
            placeholder="Search economic components..."
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

// Re-export types and utilities for external use
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

// Default export for convenience
export default AtomicEconomicBuilder;
