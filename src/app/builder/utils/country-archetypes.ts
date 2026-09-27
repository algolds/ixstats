import type { CountryArchetype } from "./country-selector-utils";
import { economySizeArchetypes } from "./archetype-data/economy-size";
import { regionArchetypes } from "./archetype-data/region";
import { governmentArchetypes } from "./archetype-data/government";

// ─── Consolidated Categories (New - 3 categories) ───

export interface ConsolidatedCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  priority: number;
}

export const consolidatedCategories: ConsolidatedCategory[] = [
  {
    id: "economy-size",
    name: "Economy & Size",
    description: "Filter by economic development level and population size",
    color: "text-emerald-500",
    priority: 1,
  },
  {
    id: "region",
    name: "Region",
    description: "Filter by geographical location",
    color: "text-blue-500",
    priority: 2,
  },
  {
    id: "government",
    name: "Government",
    description: "Filter by political and legal systems",
    color: "text-purple-500",
    priority: 3,
  },
];

// Map old categoryId to new consolidatedCategoryId
const categoryMapping: Record<string, string> = {
  "economic-classifications": "economy-size",
  "population-demographics": "economy-size",
  "geographical-regions": "region",
  "political-systems": "government",
  "legal-systems": "government",
};

// ─── Legacy Categories (kept for backwards compatibility) ───

// Define ArchetypeCategory type to match Prisma schema
export interface ArchetypeCategory {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color class
  priority: number;
  isActive: boolean;
}

// Extend CountryArchetype to include categoryId
export interface CategorizedCountryArchetype extends CountryArchetype {
  priority: number;
  categoryId: string;
  consolidatedCategoryId: string; // New consolidated category
  gradient: string; // Ensure gradient is always present
}

/** An archetype as authored in ./archetype-data, before its consolidated category is derived. */
export type ArchetypeSeed = Omit<CategorizedCountryArchetype, "consolidatedCategoryId">;

export const archetypeCategories: ArchetypeCategory[] = [
  {
    id: "economic-classifications",
    name: "Economic Classifications",
    description: "Archetypes based on economic development and performance indicators.",
    color: "text-blue-500",
    priority: 10,
    isActive: true,
  },
  {
    id: "population-demographics",
    name: "Population Demographics",
    description: "Archetypes based on population size and demographics.",
    color: "text-green-500",
    priority: 20,
    isActive: true,
  },
  {
    id: "geographical-regions",
    name: "Geographical Regions",
    description: "Archetypes based on continental and regional location.",
    color: "text-purple-500",
    priority: 30,
    isActive: true,
  },
  {
    id: "political-systems",
    name: "Political Systems",
    description: "Archetypes based on government type and political structure.",
    color: "text-red-500",
    priority: 40,
    isActive: true,
  },
  {
    id: "legal-systems",
    name: "Legal Systems",
    description: "Archetypes based on legal framework and judicial systems.",
    color: "text-amber-500",
    priority: 50,
    isActive: true,
  },
];

// Helper to add consolidatedCategoryId to archetypes
function withConsolidatedCategory<T extends { categoryId: string }>(
  archetype: T
): T & { consolidatedCategoryId: string } {
  return {
    ...archetype,
    consolidatedCategoryId: categoryMapping[archetype.categoryId] || "economy-size",
  };
}

// ─── Curated Archetypes for the new panel (trimmed for clarity) ───

// Families live in ./archetype-data; order is economy & size, region, government.
const rawArchetypes: ArchetypeSeed[] = [
  ...economySizeArchetypes,
  ...regionArchetypes,
  ...governmentArchetypes,
];

// Add consolidatedCategoryId to all archetypes
export const archetypes: CategorizedCountryArchetype[] =
  rawArchetypes.map(withConsolidatedCategory);

// Helper to get archetypes by consolidated category
export function getArchetypesByConsolidatedCategory(
  categoryId: string
): CategorizedCountryArchetype[] {
  return archetypes.filter((a) => a.consolidatedCategoryId === categoryId);
}

// Helper to get all unique consolidated categories that have archetypes
export function getActiveConsolidatedCategories() {
  const activeCategoryIds = new Set(archetypes.map((a) => a.consolidatedCategoryId));
  return consolidatedCategories.filter((c) => activeCategoryIds.has(c.id));
}
