/**
 * Economic Archetype Seed Rows
 *
 * The built-in archetypes (./modern, ./historical) as EconomicArchetype table rows. Used by
 * prisma/seeds/economic-archetypes.ts and by the economicArchetypes router, which seeds an
 * empty table on first read (db:seed doesn't run in production).
 *
 * @module archetype-seed
 */

import type { EconomicArchetype } from "./types";
import { modernArchetypes } from "./modern";
import { historicalArchetypes } from "./historical";

export type ArchetypeEra = "modern" | "historical";

interface ArchetypeSeedRow {
  key: string;
  name: string;
  description: string;
  region: string;
  era: ArchetypeEra;
  characteristics: string;
  economicComponents: string;
  governmentComponents: string;
  taxProfile: string;
  sectorFocus: string;
  employmentProfile: string;
  growthMetrics: string;
  strengths: string;
  challenges: string;
  culturalFactors: string;
  modernExamples: string;
  recommendations: string;
  implementationComplexity: string;
  historicalContext: string;
  isActive: boolean;
  isCustom: boolean;
}

/** The built-in archetypes with their era; `id` is the table's `key`. */
export function builtinArchetypes(): Array<EconomicArchetype & { era: ArchetypeEra }> {
  return [
    ...Array.from(modernArchetypes.values()).map((a) => ({ ...a, era: "modern" as const })),
    ...Array.from(historicalArchetypes.values()).map((a) => ({ ...a, era: "historical" as const })),
  ];
}

export function buildArchetypeSeedRows(): ArchetypeSeedRow[] {
  return builtinArchetypes().map((archetype) => ({
    key: archetype.id,
    name: archetype.name,
    description: archetype.description,
    region: archetype.region,
    era: archetype.era,
    characteristics: JSON.stringify(archetype.characteristics),
    economicComponents: JSON.stringify(archetype.economicComponents),
    governmentComponents: JSON.stringify(archetype.governmentComponents),
    taxProfile: JSON.stringify(archetype.taxProfile),
    sectorFocus: JSON.stringify(archetype.sectorFocus),
    employmentProfile: JSON.stringify(archetype.employmentProfile),
    growthMetrics: JSON.stringify(archetype.growthMetrics),
    strengths: JSON.stringify(archetype.strengths),
    challenges: JSON.stringify(archetype.challenges),
    culturalFactors: JSON.stringify(archetype.culturalFactors),
    modernExamples: JSON.stringify(archetype.modernExamples),
    recommendations: JSON.stringify(archetype.recommendations),
    implementationComplexity: archetype.implementationComplexity,
    historicalContext: archetype.historicalContext,
    isActive: true,
    isCustom: false,
  }));
}
