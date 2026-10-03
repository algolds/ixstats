/**
 * Client-side atomic calculations
 * Pure functions without database dependencies for use in client components
 */

import { ComponentType } from "@prisma/client";
// Component effectiveness lookup table
// Economic component effectiveness lookup table
// Tax component effectiveness lookup table
// Synergy definitions
// Conflict definitions
const CONFLICT_COMBINATIONS: Array<{
  components: ComponentType[];
  economicPenalty: number;
  taxPenalty: number;
  stabilityPenalty: number;
  description: string;
}> = [
  {
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
    economicPenalty: 0.1,
    taxPenalty: 0.05,
    stabilityPenalty: 8,
    description: "Democratic surveillance conflict",
  },
  {
    components: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.ELECTORAL_LEGITIMACY],
    economicPenalty: 0.08,
    taxPenalty: 0.0,
    stabilityPenalty: 12,
    description: "Military-electoral tension",
  },
  {
    components: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.RULE_OF_LAW],
    economicPenalty: 0.15,
    taxPenalty: 0.1,
    stabilityPenalty: 15,
    description: "Partisan capture of institutions",
  },
];

/**
 * Detect conflicts (client-safe)
 */
export function detectConflicts(components: ComponentType[]) {
  return CONFLICT_COMBINATIONS.filter((conflict) =>
    conflict.components.every((comp) => components.includes(comp))
  );
}
