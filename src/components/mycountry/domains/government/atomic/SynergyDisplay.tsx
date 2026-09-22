"use client";

/**
 * Synergy Display (Government Domain)
 *
 * Backed by shared SynergyDisplay primitive.
 */

import React, { useMemo } from "react";
import type { AtomicGovernmentComponent } from "~/lib/government/atomic-data";
import { ComponentType } from "~/lib/enums";
import { SynergyDisplay as SharedSynergyDisplay, type SynergyItem } from "~/components/shared/atomic-picker";

export interface SynergyDisplayProps {
  synergies: Array<{ comp1: ComponentType; comp2: ComponentType; score: number }>;
  conflicts: Array<{ comp1: ComponentType; comp2: ComponentType }>;
  components: Partial<Record<ComponentType, AtomicGovernmentComponent>>;
}

function formatTypeName(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export const SynergyDisplay = React.memo<SynergyDisplayProps>(function SynergyDisplay({
  synergies,
  conflicts,
  components,
}) {
  const synergyItems: SynergyItem[] = useMemo(() => {
    return synergies.map((s) => ({
      comp1Name: components[s.comp1]?.name || formatTypeName(s.comp1),
      comp2Name: components[s.comp2]?.name || formatTypeName(s.comp2),
      bonus: s.score,
      description: "Compounding institutional efficiency bonus between complementary branches of power.",
      type: "synergy" as const,
    }));
  }, [synergies, components]);

  const conflictItems: SynergyItem[] = useMemo(() => {
    return conflicts.map((c) => ({
      comp1Name: components[c.comp1]?.name || formatTypeName(c.comp1),
      comp2Name: components[c.comp2]?.name || formatTypeName(c.comp2),
      penalty: 15,
      description: "Constitutional and operational friction between opposing doctrines of state authority.",
      type: "conflict" as const,
    }));
  }, [conflicts, components]);

  return <SharedSynergyDisplay synergies={synergyItems} conflicts={conflictItems} />;
});
