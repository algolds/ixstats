"use client";

import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
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
import { SegmentedControl } from "~/components/ui/segmented-control";

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
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-separator border-b px-6 pt-5 pb-3">
          <SheetTitle className="text-label text-title-3 flex items-center gap-2">
            <TitleIcon aria-hidden="true" className="text-yellow h-5 w-5" />
            {TITLES[activeTab].label}
          </SheetTitle>

          <SegmentedControl
            size="sm"
            className="mt-3 w-full"
            options={[
              { value: "components", label: "Components", icon: <Package /> },
              { value: "interactions", label: "Interactions", icon: <Zap /> },
              { value: "effectiveness", label: "Effectiveness", icon: <Target /> },
              { value: "costs", label: "Costs", icon: <DollarSign /> },
            ]}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as MetricTab)}
            asTabs
          />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
                <h4 className="text-label text-headline mb-3 flex items-center gap-2">
                  <Zap aria-hidden="true" className="text-green h-4 w-4" />
                  Active synergies ({synergies.length})
                </h4>
                {synergies.length === 0 ? (
                  <p className="text-label-secondary text-footnote">No active synergies.</p>
                ) : (
                  <ul className="divide-separator border-separator rounded-control divide-y border">
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
                            <p className="text-label text-caption font-semibold">
                              {component1.name} + {component2.name}
                            </p>
                            <p className="text-label-secondary text-footnote mt-0.5">
                              Complementary systems boost administrative output.
                            </p>
                          </div>
                          <Badge variant="success" className="shrink-0 tabular-nums">
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
                <h4 className="text-label text-headline mb-3 flex items-center gap-2">
                  <AlertTriangle aria-hidden="true" className="text-destructive h-4 w-4" />
                  Active conflicts ({conflicts.length})
                </h4>
                {conflicts.length === 0 ? (
                  <p className="text-label-secondary text-footnote">No active conflicts.</p>
                ) : (
                  <ul className="divide-separator border-separator rounded-control divide-y border">
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
                            <p className="text-label text-caption font-semibold">
                              {component1.name} vs {component2.name}
                            </p>
                            <p className="text-label-secondary text-footnote mt-0.5">
                              Incompatible policies drag down performance.
                            </p>
                          </div>
                          <Badge variant="destructive" className="shrink-0 tabular-nums">
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
                <h4 className="text-label text-headline mb-3 flex items-center gap-2">
                  <CheckCircle aria-hidden="true" className="text-label-secondary h-4 w-4" />
                  Enacted directives ({directives.length})
                </h4>
                {directives.length === 0 ? (
                  <p className="text-label-secondary text-footnote">
                    No policy directives active. Select components to unlock state directives.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {directives.map((dir) => (
                      <li
                        key={dir.id}
                        className="border-separator rounded-control flex items-center justify-between gap-2 border p-2"
                      >
                        <span className="text-label text-caption truncate">{dir.name}</span>
                        <Badge variant="outline" className="text-label-secondary shrink-0">
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
              <dl className="border-separator rounded-control grid grid-cols-2 gap-4 border p-4 text-center">
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Base score</Eyebrow>
                  </dt>
                  <dd className="text-label text-title-2 tabular-nums">
                    {effectiveness.baseEffectiveness.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Synergy bonus</Eyebrow>
                  </dt>
                  <dd className="text-title-2 text-green tabular-nums">
                    +{effectiveness.synergyBonus.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Conflict penalty</Eyebrow>
                  </dt>
                  <dd className="text-destructive text-title-2 tabular-nums">
                    -{effectiveness.conflictPenalty.toFixed(1)}%
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt>
                    <Eyebrow>Total score</Eyebrow>
                  </dt>
                  <dd className="text-label text-title-2 tabular-nums">
                    {effectiveness.totalEffectiveness.toFixed(1)}%
                  </dd>
                </div>
              </dl>

              <section className="space-y-3">
                <h4 className="text-label text-headline">Component contributions</h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-label-secondary text-footnote">No components selected.</p>
                ) : (
                  <ul className="divide-separator divide-y">
                    {selectedComponentObjects.map((comp) => (
                      <li
                        key={comp.type}
                        className="text-footnote flex items-center justify-between py-2"
                      >
                        <span className="text-label font-medium">{comp.name}</span>
                        <span className="text-label-secondary font-semibold tabular-nums">
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
              <dl className="border-separator divide-separator rounded-control grid grid-cols-2 divide-x border text-center">
                <div className="p-4">
                  <dt>
                    <Eyebrow>Total setup cost</Eyebrow>
                  </dt>
                  <dd className="text-label text-title-2 mt-1 tabular-nums">
                    ${implementationCost.toLocaleString()}
                  </dd>
                </div>
                <div className="p-4">
                  <dt>
                    <Eyebrow>Annual maintenance</Eyebrow>
                  </dt>
                  <dd className="text-label text-title-2 mt-1 tabular-nums">
                    ${maintenanceCost.toLocaleString()}/yr
                  </dd>
                </div>
              </dl>

              <section className="space-y-3">
                <h4 className="text-label text-headline">Per-component breakdown</h4>
                {selectedComponentObjects.length === 0 ? (
                  <p className="text-label-secondary text-footnote">No components selected.</p>
                ) : (
                  <ul className="divide-separator divide-y">
                    {selectedComponentObjects.map((comp) => (
                      <li
                        key={comp.type}
                        className="text-footnote flex items-center justify-between gap-3 py-2"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-label font-medium">{comp.name}</span>
                          <span className="text-label-secondary text-footnote capitalize">
                            {comp.category}
                          </span>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <span className="text-label font-semibold">
                            ${comp.implementationCost.toLocaleString()}
                          </span>
                          <span className="text-label-secondary mx-2">•</span>
                          <span className="text-label-secondary">
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
      </SheetContent>
    </Sheet>
  );
}
