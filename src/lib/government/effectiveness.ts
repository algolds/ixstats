/**
 * Government effectiveness from a nation's government components: the mean effectiveness score
 * plus the synergy table's adjustment for every interacting pair, clamped to 0 to 100.
 *
 * `syncGovernmentComponents` writes this when components are saved, and the country editor shows
 * it before saving, so the consequence line the player reads is the number that is stored.
 */

import type { ComponentType } from "@prisma/client";
import { findSynergyPair, synergyScoreDelta, type SynergyType } from "./synergy-table";

/** The score a component starts with when it is added to a nation that did not have it. */
export const NEW_COMPONENT_EFFECTIVENESS = 50;

export interface ScoredComponent {
  componentType: string;
  effectivenessScore: number;
}

export interface ComponentInteraction {
  a: ComponentType;
  b: ComponentType;
  type: SynergyType;
  multiplier: number;
  description: string;
}

/** Every pair among `types` that the synergy table lists, in list order. */
export function componentInteractions(types: readonly string[]): ComponentInteraction[] {
  const unique = [...new Set(types)];
  return unique.flatMap((a, i) =>
    unique.slice(i + 1).flatMap((b) => {
      const pair = findSynergyPair(a, b);
      return pair
        ? [
            {
              a: a as ComponentType,
              b: b as ComponentType,
              type: pair.type,
              multiplier: pair.multiplier,
              description: pair.description,
            },
          ]
        : [];
    })
  );
}

/** Mean score plus synergy adjustments, clamped to 0 to 100; 0 components score the base alone. */
export function governmentEffectiveness(records: readonly ScoredComponent[]): number {
  const types = records.map((r) => r.componentType);
  const synergyDelta = componentInteractions(types).reduce(
    (sum, s) => sum + synergyScoreDelta(s.type, s.multiplier),
    0
  );
  const base = records.reduce((sum, r) => sum + r.effectivenessScore, 0) / (records.length || 1);
  return Math.max(0, Math.min(100, base + synergyDelta));
}

/**
 * The component rows a save of `selected` leaves: a component the nation already has keeps its row
 * (and score), a new one starts at `NEW_COMPONENT_EFFECTIVENESS`, duplicates are dropped. Mirrors
 * `syncGovernmentComponents`.
 */
export function projectComponentRecords(
  existing: readonly ScoredComponent[],
  selected: readonly string[]
): ScoredComponent[] {
  const kept = new Map<string, ScoredComponent>();
  for (const row of existing) if (!kept.has(row.componentType)) kept.set(row.componentType, row);
  const out: ScoredComponent[] = [];
  for (const type of selected) {
    if (out.some((r) => r.componentType === type)) continue;
    out.push(
      kept.get(type) ?? { componentType: type, effectivenessScore: NEW_COMPONENT_EFFECTIVENESS }
    );
  }
  return out;
}
