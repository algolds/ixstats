import { TRPCError } from "@trpc/server";
import type { ComponentType, EconomicArchetype as PrismaArchetype } from "@prisma/client";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";

/** The JSON-encoded columns of an archetype row, decoded. Throws INTERNAL_SERVER_ERROR on malformed JSON. */
export function parseArchetypeFields(archetype: PrismaArchetype) {
  try {
    return {
      characteristics: JSON.parse(archetype.characteristics) as string[],
      economicComponents: JSON.parse(archetype.economicComponents) as EconomicComponentType[],
      governmentComponents: JSON.parse(archetype.governmentComponents) as ComponentType[],
      taxProfile: JSON.parse(archetype.taxProfile) as {
        corporateRate: number;
        incomeRate: number;
        consumptionRate: number;
        revenueEfficiency: number;
      },
      sectorFocus: JSON.parse(archetype.sectorFocus) as Record<string, number>,
      employmentProfile: JSON.parse(archetype.employmentProfile) as {
        unemploymentRate: number;
        laborParticipation: number;
        wageGrowth: number;
      },
      growthMetrics: JSON.parse(archetype.growthMetrics) as {
        gdpGrowth: number;
        innovationIndex: number;
        competitiveness: number;
        stability: number;
      },
      strengths: JSON.parse(archetype.strengths) as string[],
      challenges: JSON.parse(archetype.challenges) as string[],
      culturalFactors: JSON.parse(archetype.culturalFactors) as string[],
      modernExamples: JSON.parse(archetype.modernExamples) as string[],
      recommendations: JSON.parse(archetype.recommendations) as string[],
    };
  } catch (error) {
    console.error("Failed to parse archetype JSON:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to parse archetype data",
    });
  }
}
