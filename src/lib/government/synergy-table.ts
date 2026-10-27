/**
 * Government component synergy table (spec D13, §5)
 *
 * The one list of government component pairs that help or hurt each other. The picker
 * (`atomic-utils.ts`), the per-component `synergies`/`conflicts` arrays on
 * `ATOMIC_COMPONENTS`, and the server save (`syncGovernmentComponents`) all read it, so the
 * synergies a player sees are the ones that are saved and scored.
 *
 * Every pair is unordered: `a`/`b` order carries no meaning and each pair appears once.
 * Every component named here is defined in `ATOMIC_COMPONENTS` (enforced by a test).
 *
 * Scoring, shared by client and server:
 * - ADDITIVE: +10 effectiveness
 * - MULTIPLICATIVE: +10 × multiplier
 * - CONFLICTING: -15 effectiveness
 */

import type { ComponentType } from "@prisma/client";
import { SYNERGY_PAIRS_1 } from "./synergy-pairs-1";
import { SYNERGY_PAIRS_2 } from "./synergy-pairs-2";
import type { SynergyData, SynergyPair } from "./synergy-types";

export type { SynergyData, SynergyPair, SynergyType } from "./synergy-types";

/** Effectiveness points per synergy type. */
export const SYNERGY_BONUS = 10;
export const CONFLICT_PENALTY = 15;

export const GOVERNMENT_SYNERGY_TABLE: readonly SynergyPair[] = [
  ...SYNERGY_PAIRS_1,
  ...SYNERGY_PAIRS_2,
];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

const PAIR_INDEX = new Map<string, SynergyPair>(
  GOVERNMENT_SYNERGY_TABLE.map((pair) => [pairKey(pair.a, pair.b), pair])
);

/** The table entry for two components in either order, or null when they do not interact. */
export function findSynergyPair(type1: string, type2: string): SynergyPair | null {
  if (type1 === type2) return null;
  return PAIR_INDEX.get(pairKey(type1, type2)) ?? null;
}

/**
 * Check if two government components have synergy or conflict.
 *
 * @returns SynergyData if synergy/conflict exists, null otherwise
 */
export function checkComponentSynergy(
  type1: ComponentType,
  type2: ComponentType
): SynergyData | null {
  const pair = findSynergyPair(type1, type2);
  return pair
    ? { type: pair.type, multiplier: pair.multiplier, description: pair.description }
    : null;
}

/** Effectiveness change for one interaction: positive for synergies, negative for conflicts. */
export function synergyScoreDelta(type: string, multiplier: number): number {
  if (type === "CONFLICTING") return -CONFLICT_PENALTY;
  if (type === "ADDITIVE") return SYNERGY_BONUS;
  return type === "MULTIPLICATIVE" ? multiplier * SYNERGY_BONUS : 0;
}

/** Components that help (`synergies`) or hurt (`conflicts`) the given component. */
export function getSynergyPartners(type: ComponentType): {
  synergies: ComponentType[];
  conflicts: ComponentType[];
} {
  const synergies: ComponentType[] = [];
  const conflicts: ComponentType[] = [];
  for (const pair of GOVERNMENT_SYNERGY_TABLE) {
    const other = pair.a === type ? pair.b : pair.b === type ? pair.a : null;
    if (!other) continue;
    (pair.type === "CONFLICTING" ? conflicts : synergies).push(other);
  }
  return { synergies, conflicts };
}
