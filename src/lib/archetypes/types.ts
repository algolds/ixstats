/**
 * Selectable Archetype Contracts & Types
 */

import type { RealCountryData } from "~/types/builder/country-reference";

export interface EnhancedArchetype {
  id: string;
  name: string;
  description: string;
  category: "economic" | "political" | "cultural" | "geographic" | "development";
  iconName?: string;
  color: string;
  gradient: string;
  filter: (country: RealCountryData) => boolean;
  priority: number;
  isSelectable: boolean;
  tags: string[];
}

export interface ArchetypeCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  maxSelectable: number;
}

export interface ArchetypeConfig {
  maxTotalSelections: number;
  minSelections: number;
  enableCombinations: boolean;
  showCategoryCounts: boolean;
}
