/**
 * Types and builders for the government synergy table (`synergy-table.ts`). The pairs live in
 * `synergy-pairs-1.ts` and `synergy-pairs-2.ts`, split only to keep each file small.
 */

import type { ComponentType } from "@prisma/client";

export type SynergyType = "ADDITIVE" | "MULTIPLICATIVE" | "CONFLICTING";

export interface SynergyData {
  type: SynergyType;
  multiplier: number;
  description: string;
}

export interface SynergyPair extends SynergyData {
  a: ComponentType;
  b: ComponentType;
}

export function helps(a: ComponentType, b: ComponentType, description: string): SynergyPair {
  return { a, b, type: "ADDITIVE", multiplier: 1, description };
}

export function hurts(a: ComponentType, b: ComponentType, description: string): SynergyPair {
  return { a, b, type: "CONFLICTING", multiplier: 1, description };
}
