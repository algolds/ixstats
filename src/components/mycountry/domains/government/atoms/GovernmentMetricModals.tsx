"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetTabs } from "~/components/ui/facet";
import {
  Package,
  Flash as Zap,
  WarningTriangle as AlertTriangle,
  Archery as Target,
  Dollar as DollarSign,
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
  }, [selectedListOpen, interactionsOpen, effectivenessOpen, implementationOpen, maintenanceOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedListOpen(false);
      setInteractionsOpen(false);
      setEffectivenessOpen(false);
      setImplementationOpen(false);
      setMaintenanceOpen(false);
    }
  };

  const TITLES: Record<MetricTab, { icon: typeof Package; label: string }> = {
    components: {
      icon: Package,
      label: `Selected Components (${selectedComponentObjects.length})`,
    },
    interactions: { icon: Zap, label: "Component Interactions" },
    effectiveness: { icon: Target, label: "Effectiveness Breakdown" },
    costs: { icon: DollarSign, label: "Financial Impact & Costs" },
  };
  const TitleIcon = TITLES[activeTab].icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-border/60 border-b px-6 pt-5 pb-3">
          <DialogTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
            <TitleIcon aria-hidden="true" className="h-5 w-5 text-amber-500" />
            {TITLES[activeTab].label}
          </DialogTitle>

          <FacetTabs
            size="sm"
            tone="mycountry"
            className="mt-3 w-full"
            tabs={[
              { id: "components", label: "Components", icon: Package },
              { id: "interactions", label: "Interactions", icon: Zap },
              { id: "effectiveness", label: "Effectiveness", icon: Target },
              { id: "costs", label: "Costs", icon: DollarSign },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as MetricTab)}
          />
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
              <section>
                <h4 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Zap aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                  Active synergies ({synergies.length})
                </h4>
                {synergies.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No active synergies.</p>
                ) : (
                  <ul className="divide-border/60 border-border/60 divide-y rounded-lg border">
                    {synergies.map(({ comp1, comp2, score }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <li
                          key={`${comp1}-${comp2}-${index}`}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground text-xs font-semibold">
                              {component1.name} + {component2.name}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              Complementary systems boost administrative output.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-emerald-500/30 font-mono text-emerald-600"
                          >
                            +{score}%
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Active Conflicts */}
              <section>
                <h4 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle aria-hidden="true" className="text-destructive h-4 w-4" />
                  Active conflicts ({conflicts.length})
                </h4>
                {conflicts.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No active conflicts.</p>
                ) : (
                  <ul className="divide-border/60 border-border/60 divide-y rounded-lg border">
                    {conflicts.map(({ comp1, comp2 }, index) => {
                      const component1 = ATOMIC_COMPONENTS[comp1];
                      const component2 = ATOMIC_COMPONENTS[comp2];
                      if (!component1 || !component2) return null;
                      return (
                        <li
                          key={`${comp1}-${comp2}-${index}`}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground text-xs font-semibold">
                              {component1.name} vs {component2.name}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              Incompatible policies drag down performance.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-destructive/30 text-destructive shrink-0 font-mono"
                          >
                            -15%
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Enacted Directives */}
              <section>
                <h4 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle aria-hidden="true" className="text-muted-foreground h-4 w-4" />
                  Enacted directives ({directives.length})
                </h4>
                {directives.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No policy directives active. Select components to unlock state directives.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {directives.map((dir) => (
                      <li
                        key={dir.id}
                        className="border-border/60 flex items-center justify-between gap-2 rounded-lg border p-2.5"
                      >
                        <span className="text-foreground truncate text-xs font-medium">
                          {dir.name}
                        </span>
                        <Badge variant="outline" className="text-muted-foreground shrink-0">
                          {dir.category}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* Tab 3: Effectiveness */}
          {activeTab === "effectiveness" && (
            <div className="space-y-6">
              <dl className="border-border/60 grid grid-cols-2 gap-4 rounded-lg border p-4 text-center">
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Base score</Eyebrow>
                  </dt>
                  <dd className="text-foreground font-mono text-xl font-semibold tabular-nums">
                    {effectiveness.baseEffectiveness.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Synergy bonus</Eyebrow>
                  </dt>
                  <dd className="font-mono text-xl font-semibold text-emerald-600 tabular-nums">
                    +{effectiveness.synergyBonus.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Conflict penalty</Eyebrow>
                  </dt>
                  <dd className="text-destructive font-mono text-xl font-semibold tabular-nums">
                    -{effectiveness.conflictPenalty.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Total score</Eyebrow>
                  </dt>
                  <dd className="text-foreground font-mono text-xl font-semibold tabular-nums">
                    {effectiveness.totalEffectiveness.toFixed(1)}%
                  </dd>
                </div>
              </dl>

              <section className="space-y-3">
                <h4 className="text-foreground text-sm font-semibold">Component contributions</h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No components selected.</p>
                ) : (
                  <ul className="divide-border/60 divide-y">
                    {selectedComponentObjects.map((comp) => (
                      <li
                        key={comp.type}
                        className="flex items-center justify-between py-2 text-xs"
                      >
                        <span className="text-foreground font-medium">{comp.name}</span>
                        <span className="text-muted-foreground font-mono font-semibold tabular-nums">
                          {comp.effectiveness}% base
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* Tab 4: Costs */}
          {activeTab === "costs" && (
            <div className="space-y-6">
              <dl className="border-border/60 divide-border/60 grid grid-cols-2 divide-x rounded-lg border text-center">
                <div className="p-4">
                  <dt>
                    <Eyebrow>Total setup cost</Eyebrow>
                  </dt>
                  <dd className="text-foreground mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums">
                    ${implementationCost.toLocaleString()}
                  </dd>
                </div>
                <div className="p-4">
                  <dt>
                    <Eyebrow>Annual maintenance</Eyebrow>
                  </dt>
                  <dd className="text-foreground mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums">
                    ${maintenanceCost.toLocaleString()}/yr
                  </dd>
                </div>
              </dl>

              <section className="space-y-3">
                <h4 className="text-foreground text-sm font-semibold">Per-component breakdown</h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No components selected.</p>
                ) : (
                  <ul className="divide-border/60 divide-y">
                    {selectedComponentObjects.map((comp) => (
                      <li
                        key={comp.type}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground font-medium">{comp.name}</span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <div className="shrink-0 text-right font-mono tabular-nums">
                          <span className="text-foreground font-semibold">
                            ${comp.implementationCost.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground mx-1.5">•</span>
                          <span className="text-muted-foreground">
                            ${comp.maintenanceCost.toLocaleString()}/yr
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
