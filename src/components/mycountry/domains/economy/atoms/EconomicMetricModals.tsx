"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Package,
  Flash as Zap,
  WarningTriangle as AlertTriangle,
  Archery as Target,
  Dollar as DollarSign,
} from "iconoir-react";
import { SelectedComponentsList } from "~/components/mycountry/domains/economy/atomic";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  type AtomicEconomicComponent,
  type EconomicComponentType,
} from "~/lib/economy/atomic-data";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

export type MetricTab = "components" | "interactions" | "effectiveness" | "costs";

const METRIC_TABS = [
  { value: "components", label: "Components", icon: <Package /> },
  { value: "interactions", label: "Interactions", icon: <Zap /> },
  { value: "effectiveness", label: "Effectiveness", icon: <Target /> },
  { value: "costs", label: "Costs", icon: <DollarSign /> },
];

interface EconomicMetricModalsProps {
  /** The tab to show, or null when the sheet is closed. */
  openTab: MetricTab | null;
  onClose: () => void;
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

type Effectiveness = EconomicMetricModalsProps["effectiveness"];
type TabIcon = typeof Package;

const TAB_ICONS: Record<MetricTab, TabIcon> = {
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
    <div>
      <h3 className="text-label text-headline mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className={cn("h-4 w-4", iconClass)} />
        {title} ({count})
      </h3>
      {count === 0 ? (
        <p className="text-label-secondary text-footnote italic">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function InteractionCard({
  components,
  joiner,
  description,
  badge,
}: {
  components: [EconomicComponentType, EconomicComponentType];
  joiner: string;
  description: string;
  badge: React.ReactNode;
}) {
  const [component1, component2] = components.map((c) => ATOMIC_ECONOMIC_COMPONENTS[c]);
  if (!component1 || !component2) return null;
  return (
    <Card variant="inset" className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label text-caption font-semibold">
            {component1.name} {joiner} {component2.name}
          </p>
          <p className="text-label-secondary text-footnote mt-0.5">{description}</p>
        </div>
        {badge}
      </div>
    </Card>
  );
}

function InteractionsTab({
  synergies,
  conflicts,
}: Pick<EconomicMetricModalsProps, "synergies" | "conflicts">) {
  return (
    <div className="space-y-6">
      <InteractionSection
        icon={Zap}
        iconClass="text-green"
        title="Active synergies"
        count={synergies.length}
        empty="No active synergies."
      >
        {synergies.map((s, index) => (
          <InteractionCard
            key={`${s.component1}-${s.component2}-${index}`}
            components={[s.component1, s.component2]}
            joiner="+"
            description={s.description}
            badge={
              <Badge variant="success" className="shrink-0 tabular-nums">
                +{s.bonus}%
              </Badge>
            }
          />
        ))}
      </InteractionSection>

      <InteractionSection
        icon={AlertTriangle}
        iconClass="text-destructive"
        title="Active conflicts"
        count={conflicts.length}
        empty="No active conflicts."
      >
        {conflicts.map((c, index) => (
          <InteractionCard
            key={`${c.component1}-${c.component2}-${index}`}
            components={[c.component1, c.component2]}
            joiner="vs"
            description={c.description}
            badge={
              <Badge variant="outline" className="text-destructive shrink-0 tabular-nums">
                -{c.penalty}%
              </Badge>
            }
          />
        ))}
      </InteractionSection>
    </div>
  );
}

function StatsCard({ cells }: { cells: [label: string, value: string, className?: string][] }) {
  return (
    <Card variant="inset" className="grid grid-cols-2 gap-4 p-4 text-center">
      {cells.map(([label, value, className], i) => (
        <div key={label} className={cn("space-y-1", i > 1 && "mt-2")}>
          <span className="text-stat-label text-label-secondary block">{label}</span>
          <p className={cn("text-title-2 tabular-nums", className ?? "text-label")}>{value}</p>
        </div>
      ))}
    </Card>
  );
}

function ComponentRows({
  title,
  components,
  renderRow,
}: {
  title: string;
  components: AtomicEconomicComponent[];
  renderRow: (comp: AtomicEconomicComponent) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Eyebrow className="block">{title}</Eyebrow>
      {components.length === 0 ? (
        <p className="text-label-secondary text-footnote italic">No components selected.</p>
      ) : (
        <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
          {components.map((comp) => (
            <div
              key={comp.id}
              className="border-separator text-footnote flex items-center justify-between border-b pb-2"
            >
              {renderRow(comp)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EffectivenessTab({
  effectiveness: e,
  components,
}: {
  effectiveness: Effectiveness;
  components: AtomicEconomicComponent[];
}) {
  return (
    <div className="space-y-6">
      <StatsCard
        cells={[
          ["Base score", `${e.baseEffectiveness.toFixed(1)}%`],
          ["Synergy bonus", `+${e.synergyBonus.toFixed(1)}%`, "text-green"],
          ["Conflict penalty", `-${e.conflictPenalty.toFixed(1)}%`, "text-destructive"],
          ["Total score", `${e.totalEffectiveness.toFixed(1)}%`],
        ]}
      />
      <ComponentRows
        title="Component contributions"
        components={components}
        renderRow={(comp) => (
          <>
            <span className="text-label font-semibold">{comp.name}</span>
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
  components: AtomicEconomicComponent[];
}) {
  return (
    <div className="space-y-6">
      <StatsCard
        cells={[
          ["Implementation", dollars(implementationCost)],
          ["Annual maintenance", `${dollars(maintenanceCost)}/yr`],
        ]}
      />
      <ComponentRows
        title="Expenditure by component"
        components={components}
        renderRow={(comp) => (
          <>
            <div className="flex flex-col">
              <span className="text-label font-semibold">{comp.name}</span>
              <span className="text-label-secondary text-footnote capitalize">{comp.category}</span>
            </div>
            <div className="text-footnote flex items-center gap-3 tabular-nums">
              <span className="text-label">{dollars(comp.implementationCost)}</span>
              <span className="text-label-secondary">/</span>
              <span className="text-label-secondary">{dollars(comp.maintenanceCost)}/yr</span>
            </div>
          </>
        )}
      />
    </div>
  );
}

export function EconomicMetricModals({
  openTab,
  onClose,
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
  const [activeTab, setActiveTab] = useState<MetricTab>("components");

  // Open on the tab for whichever metric was clicked (adjusted during render, not in an effect).
  const [lastOpenTab, setLastOpenTab] = useState<MetricTab | null>(null);
  if (openTab !== lastOpenTab) {
    setLastOpenTab(openTab);
    if (openTab) setActiveTab(openTab);
  }

  const titles: Record<MetricTab, string> = {
    components: `Selected Components (${selectedComponentObjects.length})`,
    interactions: `Economic Interactions (${synergies.length} Synergies, ${conflicts.length} Conflicts)`,
    effectiveness: "Economic Effectiveness Breakdown",
    costs: "Economic Expenditure Breakdown",
  };
  const TitleIcon = TAB_ICONS[activeTab];

  return (
    <Sheet open={openTab !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <SheetHeader className="border-separator border-b px-6 pt-6 pb-4">
          <SheetTitle className="text-label text-title-3 flex items-center gap-2">
            <TitleIcon aria-hidden="true" className="text-label-secondary h-5 w-5" />
            {titles[activeTab]}
          </SheetTitle>

          <SegmentedControl
            options={METRIC_TABS}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as MetricTab)}
            size="sm"
            className="mt-3 w-full"
            asTabs
          />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "components" && (
            <SelectedComponentsList
              selectedComponents={selectedComponentTypes}
              onDeselect={onDeselect}
              maxComponents={maxComponents}
            />
          )}
          {activeTab === "interactions" && (
            <InteractionsTab synergies={synergies} conflicts={conflicts} />
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
