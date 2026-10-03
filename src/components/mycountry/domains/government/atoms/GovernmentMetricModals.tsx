"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
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
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

export type MetricTab = "components" | "interactions" | "effectiveness" | "costs";

interface GovernmentMetricModalsProps {
  /** The tab to show, or null when the sheet is closed. */
  openTab: MetricTab | null;
  onClose: () => void;
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

type Effectiveness = GovernmentMetricModalsProps["effectiveness"];
type TabIcon = typeof Package;

const TAB_OPTIONS: { value: MetricTab; label: string; icon: React.ReactElement }[] = [
  { value: "components", label: "Components", icon: <Package /> },
  { value: "interactions", label: "Interactions", icon: <Zap /> },
  { value: "effectiveness", label: "Effectiveness", icon: <Target /> },
  { value: "costs", label: "Costs", icon: <DollarSign /> },
];

const TAB_TITLE_ICONS: Record<MetricTab, TabIcon> = {
  components: Package,
  interactions: Zap,
  effectiveness: Target,
  costs: DollarSign,
};

const dollars = (n: number) => `$${n.toLocaleString()}`;

function InteractionSection({
  icon: Icon,
  iconClass,
  title,
  count,
  empty,
  children,
}: {
  icon: TabIcon;
  iconClass: string;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-label text-headline mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className={cn("h-4 w-4", iconClass)} />
        {title} ({count})
      </h4>
      {count === 0 ? <p className="text-label-secondary text-footnote">{empty}</p> : children}
    </section>
  );
}

function ComponentPairList({
  pairs,
  joiner,
  blurb,
  badge,
}: {
  pairs: { comp1: ComponentType; comp2: ComponentType; badge: string }[];
  joiner: string;
  blurb: string;
  badge: "success" | "destructive";
}) {
  return (
    <ul className="divide-separator border-separator rounded-control divide-y border">
      {pairs.map(({ comp1, comp2, badge: text }, index) => {
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
                {component1.name} {joiner} {component2.name}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">{blurb}</p>
            </div>
            <Badge variant={badge} className="shrink-0 tabular-nums">
              {text}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function InteractionsTab({
  synergies,
  conflicts,
  directives,
}: Pick<GovernmentMetricModalsProps, "synergies" | "conflicts"> & {
  directives: ReturnType<typeof getDirectivesForComponents>;
}) {
  return (
    <div className="space-y-6">
      <InteractionSection
        icon={Zap}
        iconClass="text-green"
        title="Active synergies"
        count={synergies.length}
        empty="No active synergies."
      >
        <ComponentPairList
          pairs={synergies.map((s) => ({ ...s, badge: `+${s.score}%` }))}
          joiner="+"
          blurb="Complementary systems boost administrative output."
          badge="success"
        />
      </InteractionSection>

      <InteractionSection
        icon={AlertTriangle}
        iconClass="text-destructive"
        title="Active conflicts"
        count={conflicts.length}
        empty="No active conflicts."
      >
        <ComponentPairList
          pairs={conflicts.map((c) => ({ ...c, badge: "-15%" }))}
          joiner="vs"
          blurb="Incompatible policies drag down performance."
          badge="destructive"
        />
      </InteractionSection>

      <InteractionSection
        icon={CheckCircle}
        iconClass="text-label-secondary"
        title="Enacted directives"
        count={directives.length}
        empty="No policy directives are active. Select components to enable state directives."
      >
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
      </InteractionSection>
    </div>
  );
}

function ComponentListSection({
  title,
  components,
  renderRow,
}: {
  title: string;
  components: AtomicGovernmentComponent[];
  renderRow: (comp: AtomicGovernmentComponent) => React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-label text-headline">{title}</h4>
      {components.length === 0 ? (
        <p className="text-label-secondary text-footnote">No components selected.</p>
      ) : (
        <ul className="divide-separator divide-y">
          {components.map((comp) => (
            <li
              key={comp.type}
              className="text-footnote flex items-center justify-between gap-3 py-2"
            >
              {renderRow(comp)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EffectivenessTab({
  effectiveness,
  components,
}: {
  effectiveness: Effectiveness;
  components: AtomicGovernmentComponent[];
}) {
  const cells: [label: string, value: string, className: string][] = [
    ["Base score", `${effectiveness.baseEffectiveness.toFixed(1)}%`, "text-label"],
    ["Synergy bonus", `+${effectiveness.synergyBonus.toFixed(1)}%`, "text-green"],
    ["Conflict penalty", `-${effectiveness.conflictPenalty.toFixed(1)}%`, "text-destructive"],
    ["Total score", `${effectiveness.totalEffectiveness.toFixed(1)}%`, "text-label"],
  ];
  return (
    <div className="space-y-6">
      <dl className="border-separator rounded-control grid grid-cols-2 gap-4 border p-4 text-center">
        {cells.map(([label, value, className]) => (
          <div key={label} className="space-y-1">
            <dt>
              <span className="text-stat-label text-label-secondary">{label}</span>
            </dt>
            <dd className={cn("text-title-2 tabular-nums", className)}>{value}</dd>
          </div>
        ))}
      </dl>

      <ComponentListSection
        title="Component contributions"
        components={components}
        renderRow={(comp) => (
          <>
            <span className="text-label font-medium">{comp.name}</span>
            <span className="text-label-secondary font-semibold tabular-nums">
              {comp.effectiveness}% base
            </span>
          </>
        )}
      />
    </div>
  );
}

function CostsTab({
  implementationCost,
  maintenanceCost,
  components,
}: {
  implementationCost: number;
  maintenanceCost: number;
  components: AtomicGovernmentComponent[];
}) {
  return (
    <div className="space-y-6">
      <dl className="border-separator divide-separator rounded-control grid grid-cols-2 divide-x border text-center">
        {[
          ["Total setup cost", dollars(implementationCost)],
          ["Annual maintenance", `${dollars(maintenanceCost)}/yr`],
        ].map(([label, value]) => (
          <div key={label} className="p-4">
            <dt>
              <span className="text-stat-label text-label-secondary">{label}</span>
            </dt>
            <dd className="text-label text-title-2 mt-1 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <ComponentListSection
        title="Per-component breakdown"
        components={components}
        renderRow={(comp) => (
          <>
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-medium">{comp.name}</span>
              <span className="text-label-secondary text-footnote capitalize">{comp.category}</span>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <span className="text-label font-semibold">{dollars(comp.implementationCost)}</span>
              <span className="text-label-secondary mx-2">•</span>
              <span className="text-label-secondary">{dollars(comp.maintenanceCost)}/yr</span>
            </div>
          </>
        )}
      />
    </div>
  );
}

export function GovernmentMetricModals({
  openTab,
  onClose,
  selectedComponentObjects,
  isReadOnly,
  onDeselect,
  implementationCost,
  maintenanceCost,
  effectiveness,
  synergies,
  conflicts,
}: GovernmentMetricModalsProps) {
  const [activeTab, setActiveTab] = useState<MetricTab>("components");

  const directives = getDirectivesForComponents(selectedComponentObjects.map((c) => c.type));

  // Open on the tab for whichever metric was clicked (adjusted during render, not in an effect).
  const [lastOpenTab, setLastOpenTab] = useState<MetricTab | null>(null);
  if (openTab !== lastOpenTab) {
    setLastOpenTab(openTab);
    if (openTab) setActiveTab(openTab);
  }

  const TitleIcon = TAB_TITLE_ICONS[activeTab];
  const titles: Record<MetricTab, string> = {
    components: `Selected Components (${selectedComponentObjects.length})`,
    interactions: "Component interactions",
    effectiveness: "Effectiveness breakdown",
    costs: "Financial impact & costs",
  };

  return (
    <Sheet open={openTab !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-separator border-b px-6 pt-5 pb-3">
          <SheetTitle className="text-label text-title-3 flex items-center gap-2">
            <TitleIcon aria-hidden="true" className="text-yellow h-5 w-5" />
            {titles[activeTab]}
          </SheetTitle>

          <SegmentedControl
            size="sm"
            className="mt-3 w-full"
            options={TAB_OPTIONS}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as MetricTab)}
            asTabs
          />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "components" && (
            <SelectedComponentsList
              selectedComponents={selectedComponentObjects}
              onDeselect={onDeselect}
              isReadOnly={isReadOnly}
              totalCost={implementationCost}
              totalEffectiveness={effectiveness.totalEffectiveness}
            />
          )}
          {activeTab === "interactions" && (
            <InteractionsTab synergies={synergies} conflicts={conflicts} directives={directives} />
          )}
          {activeTab === "effectiveness" && (
            <EffectivenessTab effectiveness={effectiveness} components={selectedComponentObjects} />
          )}
          {activeTab === "costs" && (
            <CostsTab
              implementationCost={implementationCost}
              maintenanceCost={maintenanceCost}
              components={selectedComponentObjects}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
