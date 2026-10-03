"use client";

/**
 * Shared Synergy Display
 *
 * Displays discovered synergies (bonuses) and conflicts (penalties) between components.
 * Replaces domain-specific duplicates with a clean, semantic token-driven UI.
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import {
  Flash as Zap,
  WarningTriangle as AlertTriangle,
  StatUp as TrendingUp,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

export interface SynergyItem {
  id?: string;
  comp1Name: string;
  comp2Name: string;
  bonus?: number | string;
  penalty?: number | string;
  description?: string;
  type?: "synergy" | "conflict";
}

export interface SynergyDisplayProps {
  synergies: SynergyItem[];
  conflicts: SynergyItem[];
  className?: string;
}

export const SynergyDisplay = React.memo(function SynergyDisplay({
  synergies,
  conflicts,
  className,
}: SynergyDisplayProps) {
  const hasSynergies = synergies.length > 0;
  const hasConflicts = conflicts.length > 0;

  if (!hasSynergies && !hasConflicts) {
    return (
      <Card
        className={cn(
          "rounded-row flex flex-col items-center justify-center border-dashed px-4 py-8 text-center",
          className
        )}
      >
        <TrendingUp aria-hidden="true" className="text-label-secondary mb-2 h-6 w-6" />
        <p className="text-label text-headline">No synergies or conflicts detected yet</p>
        <p className="text-label-secondary text-footnote mt-0.5 max-w-xs">
          Select complementary components to unlock compounding synergies, and watch out for
          conflicting doctrines.
        </p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {hasSynergies && (
        <InteractionSection
          kind="synergy"
          title={`Active synergies (${synergies.length})`}
          items={synergies}
        />
      )}
      {hasConflicts && (
        <InteractionSection
          kind="conflict"
          title={`Active conflicts (${conflicts.length})`}
          items={conflicts}
        />
      )}
    </div>
  );
});

const SECTION_TONE = {
  synergy: { icon: Zap, text: "text-green", joiner: "+" },
  conflict: { icon: AlertTriangle, text: "text-destructive", joiner: "↔" },
} as const;

function InteractionSection({
  kind,
  title,
  items,
}: {
  kind: keyof typeof SECTION_TONE;
  title: string;
  items: SynergyItem[];
}) {
  const tone = SECTION_TONE[kind];
  const Icon = tone.icon;

  return (
    <section className="space-y-2">
      <h3 className="text-label text-headline flex items-center gap-2">
        <Icon aria-hidden="true" className={cn("h-4 w-4", tone.text)} />
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, idx) => {
          const delta =
            kind === "synergy"
              ? item.bonus
                ? `+${item.bonus}%`
                : null
              : item.penalty
                ? `-${item.penalty}%`
                : null;

          return (
            <Card key={item.id || idx} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-label text-caption truncate font-semibold">
                  {item.comp1Name} {tone.joiner} {item.comp2Name}
                </h4>
                {delta && (
                  <Badge variant="outline" className={cn("tabular-nums", tone.text)}>
                    {delta}
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className="text-label-secondary text-footnote mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
