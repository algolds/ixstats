"use client";

/**
 * Synergy Display (Economy Domain)
 *
 * Backed by shared SynergyDisplay primitive.
 */

import React, { useMemo } from "react";
import { formatComponentName, type EconomicComponentType } from "~/lib/economy/atomic-data";
import { SynergyDisplay as SharedSynergyDisplay, type SynergyItem } from "~/components/shared/atomic-picker";

export interface SynergyDisplayProps {
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
  components: EconomicComponentType[];
}

export const SynergyDisplay = React.memo(function SynergyDisplay({
  synergies,
  conflicts,
  components,
}: SynergyDisplayProps) {
  if (components.length === 0) return null;

  const synergyItems: SynergyItem[] = useMemo(() => {
    return synergies.map((s) => ({
      comp1Name: formatComponentName(s.component1),
      comp2Name: formatComponentName(s.component2),
      bonus: s.bonus,
      description: s.description,
      type: "synergy" as const,
    }));
  }, [synergies]);

  const conflictItems: SynergyItem[] = useMemo(() => {
    return conflicts.map((c) => ({
      comp1Name: formatComponentName(c.component1),
      comp2Name: formatComponentName(c.component2),
      penalty: c.penalty,
      description: c.description,
      type: "conflict" as const,
    }));
  }, [conflicts]);

  return <SharedSynergyDisplay synergies={synergyItems} conflicts={conflictItems} />;
});
