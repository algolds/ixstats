"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
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
  synergies: Array<{ component1: EconomicComponentType; component2: EconomicComponentType; bonus: number; description: string }>;
  conflicts: Array<{ component1: EconomicComponentType; component2: EconomicComponentType; penalty: number; description: string }>;
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

  useEffect(() => {
    if (selectedListOpen) setActiveTab("components");
    else if (interactionsOpen) setActiveTab("interactions");
    else if (effectivenessOpen) setActiveTab("effectiveness");
    else if (implementationOpen || maintenanceOpen) setActiveTab("costs");
  }, [
    selectedListOpen,
    interactionsOpen,
    effectivenessOpen,
    implementationOpen,
    maintenanceOpen,
  ]);

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
        return <Package className="h-5 w-5 text-emerald-500" />;
      case "interactions":
        return <Zap className="h-5 w-5 text-emerald-500" />;
      case "effectiveness":
        return <Target className="h-5 w-5 text-emerald-500" />;
      case "costs":
        return <DollarSign className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-hidden border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="border-b border-border/40 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            {getTabIcon()}
            {getTabTitle()}
          </DialogTitle>

          {/* Segmented Control Header */}
          <div className="mt-3 flex items-center rounded-lg border border-border/40 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("components")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "components"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Components
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("interactions")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "interactions"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Interactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("effectiveness")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "effectiveness"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              Effectiveness
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("costs")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "costs"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Costs
            </button>
          </div>
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
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-green-500 uppercase">
                  <Zap className="h-4 w-4" />
                  Active Synergies ({synergies.length})
                </h4>
                {synergies.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No active synergies.</p>
                ) : (
                  <div className="space-y-2">
                    {synergies.map((synergy, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[synergy.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${synergy.component1}-${synergy.component2}-${index}`}
                          className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 transition-colors hover:bg-green-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground">
                                {component1.name} + {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-green-500">
                                {synergy.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border-green-500/30 bg-green-500/10 font-bold text-green-500"
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
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-red-500 uppercase">
                  <AlertTriangle className="h-4 w-4" />
                  Active Conflicts ({conflicts.length})
                </h4>
                {conflicts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No active conflicts.</p>
                ) : (
                  <div className="space-y-2">
                    {conflicts.map((conflict, index) => {
                      const component1 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component1];
                      const component2 = ATOMIC_ECONOMIC_COMPONENTS[conflict.component2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${conflict.component1}-${conflict.component2}-${index}`}
                          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground">
                                {component1.name} vs {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-red-500">
                                {conflict.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border-red-500/30 bg-red-500/10 font-bold text-red-500"
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
          )}

          {/* Tab 3: Effectiveness */}
          {activeTab === "effectiveness" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Base Score
                  </p>
                  <p className="text-xl font-extrabold text-foreground">
                    {effectiveness.baseEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Synergy Bonus
                  </p>
                  <p className="text-xl font-extrabold text-green-500">
                    +{effectiveness.synergyBonus.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Conflict Penalty
                  </p>
                  <p className="text-xl font-extrabold text-red-500">
                    -{effectiveness.conflictPenalty.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Total Score
                  </p>
                  <p className="text-xl font-extrabold text-emerald-500">
                    {effectiveness.totalEffectiveness.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Component Contributions
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between border-b border-border/40 pb-2 text-xs"
                      >
                        <span className="font-semibold text-foreground">
                          {comp.name}
                        </span>
                        <span className="font-mono font-bold text-muted-foreground">
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
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
                    Implementation
                  </p>
                  <p className="font-mono text-xl font-bold text-foreground tabular-nums">
                    ${implementationCost.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">
                    Annual Maintenance
                  </p>
                  <p className="font-mono text-xl font-bold text-foreground tabular-nums">
                    ${maintenanceCost.toLocaleString()}/yr
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Expenditure Breakdown by Component
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No components selected.</p>
                ) : (
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between border-b border-border/40 pb-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {comp.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="text-emerald-500">
                            ${comp.implementationCost.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-amber-500">
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
