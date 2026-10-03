import type { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";

interface ParsedComponent {
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
 * Components from the ATOMIC_COMPONENTS code library
 */
export function getLibraryComponents(): ParsedComponent[] {
  return Object.values(ATOMIC_COMPONENTS)
    .filter((comp): comp is NonNullable<typeof comp> => comp !== undefined)
    .map((comp) => ({
      id: comp.id,
      type: comp.type,
      name: comp.name,
      description: comp.description,
      effectiveness: comp.effectiveness,
      synergies: comp.synergies,
      conflicts: comp.conflicts,
      implementationCost: comp.implementationCost,
      maintenanceCost: comp.maintenanceCost,
      requiredCapacity: comp.requiredCapacity,
      category: comp.category,
      prerequisites: comp.prerequisites,
      color: comp.color,
      metadata: comp.metadata,
      usageCount: 0,
      isActive: true,
    }));
}
