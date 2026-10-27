// src/app/admin/economic-archetypes/_components/archetype-form-types.ts
import { ComponentType, EconomicComponentType } from "~/lib/enums";
import type { RouterInputs, RouterOutputs } from "~/trpc/react";

export type ArchetypeEra = "modern" | "historical";
export type ArchetypeRecord =
  RouterOutputs["economicArchetypes"]["getAllArchetypes"]["archetypes"][number];
type ArchetypeInput = RouterInputs["economicArchetypes"]["createArchetype"];

export interface ArchetypeFormData {
  key: string;
  name: string;
  description: string;
  region: string;
  era: ArchetypeEra;
  implementationComplexity: string;
  historicalContext: string;
  characteristics: string[];
  economicComponents: string[];
  governmentComponents: string[];
  taxProfile: {
    corporateTax: number;
    incomeTax: number;
    consumptionTax: number;
    taxEfficiency: number;
  };
  sectorFocus: Record<string, number>;
  employmentProfile: {
    unemploymentRate: number;
    laborParticipation: number;
    wageGrowth: number;
  };
  growthMetrics: {
    gdpGrowth: number;
    innovationIndex: number;
    competitiveness: number;
    stability: number;
  };
  strengths: string[];
  challenges: string[];
  culturalFactors: string[];
  modernExamples: string[];
  recommendations: string[];
}

export const COMPLEXITY_LEVELS = ["low", "medium", "high"] as const;

export function complexityLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export const SECTOR_TYPES = [
  "agriculture",
  "manufacturing",
  "services",
  "technology",
  "finance",
  "tourism",
] as const;

/** Component keys, as the builder applies them. */
export const ECONOMIC_COMPONENTS = Object.values(EconomicComponentType);
export const GOVERNMENT_COMPONENTS = Object.values(ComponentType);

export function defaultArchetypeFormData(): ArchetypeFormData {
  return {
    key: "",
    name: "",
    description: "",
    region: "",
    era: "modern",
    implementationComplexity: "medium",
    historicalContext: "",
    characteristics: [],
    economicComponents: [],
    governmentComponents: [],
    taxProfile: {
      corporateTax: 20,
      incomeTax: 25,
      consumptionTax: 10,
      taxEfficiency: 75,
    },
    sectorFocus: {
      agriculture: 10,
      manufacturing: 25,
      services: 35,
      technology: 20,
      finance: 5,
      tourism: 5,
    },
    employmentProfile: {
      unemploymentRate: 5.0,
      laborParticipation: 65.0,
      wageGrowth: 2.5,
    },
    growthMetrics: {
      gdpGrowth: 3.0,
      innovationIndex: 50,
      competitiveness: 50,
      stability: 50,
    },
    strengths: [],
    challenges: [],
    culturalFactors: [],
    modernExamples: [],
    recommendations: [],
  };
}

/** Form state for editing a stored archetype. Revenue efficiency is shown as a percentage. */
export function archetypeToFormData(archetype: ArchetypeRecord): ArchetypeFormData {
  const defaults = defaultArchetypeFormData();
  return {
    key: archetype.key,
    name: archetype.name,
    description: archetype.description,
    region: archetype.region,
    era: archetype.era,
    implementationComplexity: archetype.implementationComplexity.toLowerCase(),
    historicalContext: archetype.historicalContext,
    characteristics: archetype.characteristics ?? [],
    economicComponents: archetype.economicComponents ?? [],
    governmentComponents: archetype.governmentComponents ?? [],
    taxProfile: archetype.taxProfile
      ? {
          corporateTax: archetype.taxProfile.corporateRate,
          incomeTax: archetype.taxProfile.incomeRate,
          consumptionTax: archetype.taxProfile.consumptionRate,
          taxEfficiency: Math.round(archetype.taxProfile.revenueEfficiency * 100),
        }
      : defaults.taxProfile,
    sectorFocus: archetype.sectorFocus ?? defaults.sectorFocus,
    employmentProfile: archetype.employmentProfile ?? defaults.employmentProfile,
    growthMetrics: archetype.growthMetrics ?? defaults.growthMetrics,
    strengths: archetype.strengths ?? [],
    challenges: archetype.challenges ?? [],
    culturalFactors: archetype.culturalFactors ?? [],
    modernExamples: archetype.modernExamples ?? [],
    recommendations: archetype.recommendations ?? [],
  };
}

/** The createArchetype/updateArchetype payload for the form state. */
export function formDataToArchetypeInput(formData: ArchetypeFormData): ArchetypeInput {
  return {
    ...formData,
    key: formData.key.trim(),
    implementationComplexity:
      formData.implementationComplexity.toLowerCase() as ArchetypeInput["implementationComplexity"],
    taxProfile: {
      corporateRate: formData.taxProfile.corporateTax,
      incomeRate: formData.taxProfile.incomeTax,
      consumptionRate: formData.taxProfile.consumptionTax,
      revenueEfficiency: formData.taxProfile.taxEfficiency / 100,
    },
  };
}
