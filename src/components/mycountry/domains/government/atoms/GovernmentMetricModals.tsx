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
  CheckCircle,
} from "iconoir-react";
import { SelectedComponentsList } from "~/components/mycountry/domains/government/atomic";
import { ATOMIC_COMPONENTS, type AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { getDirectivesForComponents } from "~/lib/government/spending-defaults";
import type { ComponentType } from "~/lib/enums";

type MetricTab = "components" | "interactions" | "effectiveness" | "costs";

interface GovernmentMetricModalsProps {
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
  selectedComponentObjects: AtomicGovernmentComponent[];
  isReadOnly: boolean;
  onDeselect: (type: ComponentType) => void;
  implementationCost: number;
  maintenanceCost: number;
  effectiveness: {
    baseEffectiveness: number;
    synergyBonus: number;
    conflictPenalty: number;
    totalEffectiveness: number;
  };
  synergies: Array<{ comp1: ComponentType; comp2: ComponentType; score: number }>;
  conflicts: Array<{ comp1: ComponentType; comp2: ComponentType }>;
}

export function GovernmentMetricModals({
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
  selectedComponentObjects,
  isReadOnly,
  onDeselect,
  implementationCost,
  maintenanceCost,
  effectiveness,
  synergies,
  conflicts,
}: GovernmentMetricModalsProps) {
  const isOpen =
    selectedListOpen ||
    interactionsOpen ||
    effectivenessOpen ||
    implementationOpen ||
    maintenanceOpen;

  const [activeTab, setActiveTab] = useState<MetricTab>("components");

  const directives = React.useMemo(
    () => getDirectivesForComponents(selectedComponentObjects.map((c) => c.type)),
    [selectedComponentObjects]
  );

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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-hidden border-border bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur-2xl sm:max-w-xl">
        <DialogHeader className="border-b border-border/50 px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            {activeTab === "components" && (
              <>
                <Package className="h-5 w-5 text-blue-500" />
                Selected Components ({selectedComponentObjects.length})
              </>
            )}
            {activeTab === "interactions" && (
              <>
                <Zap className="h-5 w-5 text-amber-500" />
                Component Interactions
              </>
            )}
            {activeTab === "effectiveness" && (
              <>
                <Target className="h-5 w-5 text-indigo-500" />
                Effectiveness Breakdown
              </>
            )}
            {activeTab === "costs" && (
              <>
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Financial Impact & Costs
              </>
            )}
          </DialogTitle>

          {/* Segmented Tab Navigation */}
          <div className="mt-3 flex rounded-lg border border-border/60 bg-muted/30 p-1">
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
              selectedComponents={selectedComponentObjects}
              onDeselect={onDeselect}
              isReadOnly={isReadOnly}
              totalCost={implementationCost}
              totalEffectiveness={effectiveness.totalEffectiveness}
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
                    {synergies.map(({ comp1, comp2, score }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${comp1}-${comp2}-${index}`}
                          className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 transition-colors hover:bg-green-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground">
                                {component1.name} + {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-green-500">
                                Complementary systems boost administrative output.
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border-green-500/30 bg-green-500/10 font-bold text-green-500"
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
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-red-500 uppercase">
                  <AlertTriangle className="h-4 w-4" />
                  Active Conflicts ({conflicts.length})
                </h4>
                {conflicts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No active conflicts.</p>
                ) : (
                  <div className="space-y-2">
                    {conflicts.map(({ comp1, comp2 }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <div
                          key={`${comp1}-${comp2}-${index}`}
                          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground">
                                {component1.name} vs {component2.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-red-500">
                                Incompatible policies drag down performance.
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border-red-500/30 bg-red-500/10 font-bold text-red-500"
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

              {/* Enacted Directives */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-primary uppercase">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Enacted Directives ({directives.length})
                </h4>
                {directives.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No policy directives active. Select components to unlock state directives.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {directives.map((dir) => (
                      <div
                        key={dir.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-colors hover:bg-muted/30"
                      >
                        <span className="truncate text-xs font-medium text-foreground">
                          {dir.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-border/40 text-[10px] text-muted-foreground"
                        >
                          {dir.category}
                        </Badge>
                      </div>
                    ))}
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
                  <p className="text-xl font-extrabold text-indigo-500">
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
                  <div className="space-y-2">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.type}
                        className="flex items-center justify-between border-b border-border/40 pb-2 text-xs"
                      >
                        <span className="font-medium text-foreground">{comp.name}</span>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <p className="text-[10px] font-semibold tracking-wider text-emerald-500 uppercase">
                    Total Setup Cost
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground tabular-nums">
                    ${implementationCost.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <p className="text-[10px] font-semibold tracking-wider text-amber-500 uppercase">
                    Annual Maintenance
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground tabular-nums">
                    ${maintenanceCost.toLocaleString()}/yr
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Per-Component Breakdown
                </h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No components selected.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedComponentObjects.map((comp) => (
                      <div
                        key={comp.type}
                        className="flex items-center justify-between border-b border-border/40 pb-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{comp.name}</span>
                          <span className="text-[9px] text-muted-foreground capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-500">
                            ${comp.implementationCost.toLocaleString()}
                          </span>
                          <span className="mx-1.5 text-muted-foreground">•</span>
                          <span className="font-mono font-medium text-amber-500">
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
