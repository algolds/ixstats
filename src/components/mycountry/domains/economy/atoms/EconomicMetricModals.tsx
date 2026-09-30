"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetTabs, type FacetTabItem } from "~/components/ui/facet";
import {
  Package,
  Flash as Zap,
  WarningTriangle as AlertTriangle,
  Archery as Target,
  Dollar as DollarSign,
  StatUp as TrendingUp,
} from "iconoir-react";
import { SelectedComponentsList } from "~/components/mycountry/domains/economy/atomic";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  type AtomicEconomicComponent,
  type EconomicComponentType,
} from "~/lib/economy/atomic-data";

type MetricTab = "components" | "interactions" | "effectiveness" | "costs";

const METRIC_TABS: FacetTabItem[] = [
  { id: "components", label: "Components", icon: Package },
  { id: "interactions", label: "Interactions", icon: Zap },
  { id: "effectiveness", label: "Effectiveness", icon: Target },
  { id: "costs", label: "Costs", icon: DollarSign },
];

interface EconomicMetricModalsProps {
  selectedListOpen: boolean;
  setSelectedListOpen: (open: boolean) => void;
  interactionsOpen: boolean;
  setInteractionsOpen: (open: boolean) => void;
  effectivenessOpen: boolean;
  setEffectivenessOpen: (open: boolean) => void;
  implementationOpen: boolean;
  setImplementationOpen: (open: boolean) => void;
  maintenanceOpen: boolean;
  setMaintenanceOpen: (open: boolean) => void;
  selectedComponentTypes: EconomicComponentType[];
  selectedComponentObjects: AtomicEconomicComponent[];
  maxComponents?: number;
  onDeselect: (type: EconomicComponentType) => void;
  implementationCost: number;
  maintenanceCost: number;
  effectiveness: {
    baseEffectiveness: number;
    synergyBonus: number;
    conflictPenalty: number;
    totalEffectiveness: number;
  };
  synergies: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    bonus: number;
    description: string;
  }>;
  conflicts: Array<{
    component1: EconomicComponentType;
    component2: EconomicComponentType;
    penalty: number;
    description: string;
  }>;
}

export function EconomicMetricModals({
  selectedListOpen,
  setSelectedListOpen,
  interactionsOpen,
  setInteractionsOpen,
  effectivenessOpen,
  setEffectivenessOpen,
  implementationOpen,
  setImplementationOpen,
  maintenanceOpen,
  setMaintenanceOpen,
  selectedComponentTypes,
  selectedComponentObjects,
  maxComponents,
  onDeselect,
  implementationCost,
  maintenanceCost,
  effectiveness,
  synergies,
  conflicts,
}: EconomicMetricModalsProps) {
  const isOpen =
    selectedListOpen ||
    interactionsOpen ||
    effectivenessOpen ||
    implementationOpen ||
    maintenanceOpen;

  const [activeTab, setActiveTab] = useState<MetricTab>("components");

  // Open on the tab for whichever metric was clicked (adjusted during render, not in an effect).
  const requestedTab: MetricTab | null = selectedListOpen
    ? "components"
    : interactionsOpen
      ? "interactions"
      : effectivenessOpen
        ? "effectiveness"
        : implementationOpen || maintenanceOpen
          ? "costs"
          : null;
  const [lastRequestedTab, setLastRequestedTab] = useState<MetricTab | null>(null);
  if (requestedTab !== lastRequestedTab) {
    setLastRequestedTab(requestedTab);
    if (requestedTab) setActiveTab(requestedTab);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedListOpen(false);
      setInteractionsOpen(false);
      setEffectivenessOpen(false);
      setImplementationOpen(false);
      setMaintenanceOpen(false);
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "components":
        return `Selected Components (${selectedComponentObjects.length})`;
      case "interactions":
        return `Economic Interactions (${synergies.length} Synergies, ${conflicts.length} Conflicts)`;
      case "effectiveness":
        return "Economic Effectiveness Breakdown";
      case "costs":
        return "Economic Expenditure Breakdown";
    }
  };

  const getTabIcon = () => {
    switch (activeTab) {
      case "components":
        return <Package aria-hidden="true" className="text-muted-foreground h-5 w-5" />;
      case "interactions":
        return <Zap aria-hidden="true" className="text-muted-foreground h-5 w-5" />;
      case "effectiveness":
        return <Target aria-hidden="true" className="text-muted-foreground h-5 w-5" />;
      case "costs":
        return <DollarSign aria-hidden="true" className="text-muted-foreground h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-border/60 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
            {getTabIcon()}
            {getTabTitle()}
          </DialogTitle>

          <FacetTabs
            tabs={METRIC_TABS}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as MetricTab)}
            size="sm"
            tone="neutral"
            className="mt-3 w-full"
          />
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* Tab 1: Components */}
          {activeTab === "components" && (
            <SelectedComponentsList
              selectedComponents={selectedComponentTypes}
              onDeselect={onDeselect}
              maxComponents={maxComponents}
            />
          )}

          {/* Tab 2: Interactions */}
          {activeTab === "interactions" && (
            <div className="space-y-6">
              {/* Active Synergies */}
              <div>
                <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Zap aria-hidden="true" className="h-4 w-4 text-emerald-500" />
                  Active synergies ({synergies.length})
                </h3>
                {synergies.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No active synergies.</p>
                ) : (
                  <div className="space-y-2">
                    {synergies.map((synergy, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <FacetCard
                          key={`${synergy.component1}-${synergy.component2}-${index}`}
                          surface="solid"
                          className="rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground text-xs font-semibold">
                                {component1.name} + {component2.name}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {synergy.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 text-emerald-500 tabular-nums"
                            >
                              +{synergy.bonus}%
                            </Badge>
                          </div>
                        </FacetCard>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Conflicts */}
              <div>
                <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle aria-hidden="true" className="text-destructive h-4 w-4" />
                  Active conflicts ({conflicts.length})
                </h3>
                {conflicts.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No active conflicts.</p>
                ) : (
                  <div className="space-y-2">
                    {conflicts.map((conflict, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <FacetCard
                          key={`${conflict.component1}-${conflict.component2}-${index}`}
                          surface="solid"
                          className="rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground text-xs font-semibold">
                                {component1.name} vs {component2.name}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {conflict.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-destructive shrink-0 tabular-nums"
                            >
                              -{conflict.penalty}%
                            </Badge>
                          </div>
                        </FacetCard>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Effectiveness */}
          {activeTab === "effectiveness" && (
            <div className="space-y-6">
              <FacetCard
                surface="solid"
                className="grid grid-cols-2 gap-4 rounded-xl p-4 text-center"
              >
                <div className="space-y-1">
                  <Eyebrow className="block">Base score</Eyebrow>
                  <p className="text-foreground text-xl font-semibold tabular-nums">
                    {effectiveness.baseEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <Eyebrow className="block">Synergy bonus</Eyebrow>
                  <p className="text-xl font-semibold text-emerald-500 tabular-nums">
                    +{effectiveness.synergyBonus.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <Eyebrow className="block">Conflict penalty</Eyebrow>
                  <p className="text-destructive text-xl font-semibold tabular-nums">
                    -{effectiveness.conflictPenalty.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <Eyebrow className="block">Total score</Eyebrow>
                  <p className="text-foreground text-xl font-semibold tabular-nums">
                    {effectiveness.totalEffectiveness.toFixed(1)}%
                  </p>
                </div>
              </FacetCard>

              <div className="space-y-3">
                <Eyebrow className="block">Component contributions</Eyebrow>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.id}
                        className="border-border/40 flex items-center justify-between border-b pb-2 text-xs"
                      >
                        <span className="text-foreground font-semibold">{comp.name}</span>
                        <span className="text-muted-foreground font-mono font-bold">
                          {comp.effectiveness}% base
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Costs */}
          {activeTab === "costs" && (
            <div className="space-y-6">
              <FacetCard
                surface="solid"
                className="grid grid-cols-2 gap-4 rounded-xl p-4 text-center"
              >
                <div className="space-y-1">
                  <Eyebrow className="block">Implementation</Eyebrow>
                  <p className="text-foreground font-mono text-xl font-bold tabular-nums">
                    ${implementationCost.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <Eyebrow className="block">Annual maintenance</Eyebrow>
                  <p className="text-foreground font-mono text-xl font-bold tabular-nums">
                    ${maintenanceCost.toLocaleString()}/yr
                  </p>
                </div>
              </FacetCard>

              <div className="space-y-3">
                <Eyebrow className="block">Expenditure by component</Eyebrow>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.id}
                        className="border-border/40 flex items-center justify-between border-b pb-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">{comp.name}</span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="text-foreground">
                            ${comp.implementationCost.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">
                            ${comp.maintenanceCost.toLocaleString()}/yr
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
