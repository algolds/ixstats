/**
 * Atomic Government Component Data
 *
 * Pure data definitions for all government components, categories, and templates.
 * This file contains NO business logic - only TypeScript types and constants.
 *
 * @module atomic-government-data
 */

import { ComponentType } from "@prisma/client";

/**
 * Atomic Government Component Definition
 */
export interface AtomicGovernmentComponent {
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
  icon: React.ComponentType<{ className?: string }>;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
}

