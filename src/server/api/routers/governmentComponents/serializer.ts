import { ComponentType } from "@prisma/client";

export interface ParsedComponent {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: string;
  prerequisites: string[];
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
    console.warn("[governmentComponents] Failed to parse JSON:", error);
    return fallback;
  }
}

/**
 * Transform database component to parsed format with nullish fallbacks
 */
export function transformDatabaseComponent(dbComp: any): ParsedComponent {
  const synergies = safeJSONParse<ComponentType[]>(dbComp.synergies, []);
  const conflicts = safeJSONParse<ComponentType[]>(dbComp.conflicts, []);
  const prerequisites = safeJSONParse<string[]>(dbComp.prerequisites, []);
  const metadata = safeJSONParse<ParsedComponent["metadata"]>(dbComp.metadata, {
    complexity: "Medium",
    timeToImplement: "12-18 months",
    staffRequired: 10,
    technologyRequired: false,
  });

  return {
    id: dbComp.id || (typeof dbComp.componentType === "string" ? dbComp.componentType.toLowerCase() : ""),
    type: dbComp.componentType,
    name: dbComp.name,
    description: dbComp.description ?? "",
    effectiveness: dbComp.effectiveness ?? 50,
    synergies,
    conflicts,
    implementationCost: dbComp.implementationCost ?? 0,
    maintenanceCost: dbComp.maintenanceCost ?? 0,
    requiredCapacity: dbComp.requiredCapacity ?? 50,
    category: dbComp.category ?? "general",
    prerequisites,
    color: dbComp.color ?? "blue",
    metadata,
    usageCount: dbComp.usageCount ?? 0,
    isActive: dbComp.isActive ?? true,
  };
}
