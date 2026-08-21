/**
 * Economic Archetype Type Definitions
 *
 * Contains type definitions for economic archetypes.
 *
 * @module archetype-types
 */

import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import type { ComponentType } from "@prisma/client";

export interface EconomicArchetype {
  id: string;
  name: string;
  description: string;
  region: string;
  characteristics: string[];
  economicComponents: EconomicComponentType[];
  governmentComponents: ComponentType[];
  taxProfile: {
    corporateRate: number;
    incomeRate: number;
    consumptionRate: number;
    revenueEfficiency: number;
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
  implementationComplexity: "low" | "medium" | "high";
  culturalFactors: string[];
  historicalContext: string;
  modernExamples: string[];
  recommendations: string[];
}

export interface ArchetypeComparison {
  archetypes: EconomicArchetype[];
  comparisonMetrics: {
    gdpGrowth: Record<string, number>;
    innovationIndex: Record<string, number>;
    competitiveness: Record<string, number>;
    stability: Record<string, number>;
    taxEfficiency: Record<string, number>;
  };
  recommendations: string[];
}

export enum ArchetypeCategory {
  MODERN = "MODERN",
  HISTORICAL = "HISTORICAL",
  REGIONAL = "REGIONAL",
  EXPERIMENTAL = "EXPERIMENTAL",
  EMERGING = "EMERGING",
  TRADITIONAL = "TRADITIONAL",
}
