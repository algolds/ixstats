import { EconomicComponentType } from "@prisma/client";

export interface ParsedEconomicComponent {
  id: string;
  type: EconomicComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: EconomicComponentType[];
  conflicts: EconomicComponentType[];
  governmentSynergies: string[];
  governmentConflicts: string[];
  taxImpact: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: Record<string, number>;
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
  color: string;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
  usageCount?: number;
  isActive?: boolean;
}

/**
 * Parse JSON field safely with fallback
 */
export function safeJSONParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn("[economicComponents] Failed to parse JSON:", error);
    return fallback;
  }
}

/**
 * Transform database component to parsed format with 7-field JSON parsing and nullish fallbacks
 */
export function transformDatabaseComponent(dbComp: any): ParsedEconomicComponent {
  // Parse all JSON fields
  const synergies = safeJSONParse<EconomicComponentType[]>(dbComp.synergies, []);
  const conflicts = safeJSONParse<EconomicComponentType[]>(dbComp.conflicts, []);
  const governmentSynergies = safeJSONParse<string[]>(dbComp.governmentSynergies, []);
  const governmentConflicts = safeJSONParse<string[]>(dbComp.governmentConflicts, []);
  const taxImpact = safeJSONParse<ParsedEconomicComponent["taxImpact"]>(dbComp.taxImpact, {
    optimalCorporateRate: 20,
    optimalIncomeRate: 25,
    revenueEfficiency: 0.75,
  });
  const sectorImpact = safeJSONParse<Record<string, number>>(dbComp.sectorImpact, {});
  const employmentImpact = safeJSONParse<ParsedEconomicComponent["employmentImpact"]>(
    dbComp.employmentImpact,
    { unemploymentModifier: 0, participationModifier: 1, wageGrowthModifier: 1 }
  );
  const metadata = safeJSONParse<ParsedEconomicComponent["metadata"]>(dbComp.metadata, {
    complexity: "Medium",
    timeToImplement: "2-3 years",
    staffRequired: 150,
    technologyRequired: true,
  });

  return {
    id:
      dbComp.id ||
      (typeof dbComp.componentType === "string" ? dbComp.componentType.toLowerCase() : ""),
    type: dbComp.componentType,
    name: dbComp.name,
    description: dbComp.description ?? "",
    effectiveness: dbComp.effectiveness ?? dbComp.effectivenessScore ?? 75,
    synergies,
    conflicts,
    governmentSynergies,
    governmentConflicts,
    taxImpact,
    sectorImpact,
    employmentImpact,
    implementationCost: dbComp.implementationCost ?? 100000,
    maintenanceCost: dbComp.maintenanceCost ?? 50000,
    requiredCapacity: dbComp.requiredCapacity ?? 75,
    category: dbComp.category ?? "Economic Model",
    color: dbComp.color ?? "emerald",
    metadata,
    usageCount: dbComp.usageCount ?? 0,
    isActive: dbComp.isActive ?? true,
  };
}
