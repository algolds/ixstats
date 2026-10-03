import type { CountryArchetype } from "./country-selector-utils";
import { economySizeArchetypes } from "./archetype-data/economy-size";
import { regionArchetypes } from "./archetype-data/region";
import { governmentArchetypes } from "./archetype-data/government";

// Map old categoryId to new consolidatedCategoryId
const categoryMapping: Record<string, string> = {
  "economic-classifications": "economy-size",
  "population-demographics": "economy-size",
  "geographical-regions": "region",
  "political-systems": "government",
  "legal-systems": "government",
};

// Extend CountryArchetype to include categoryId
interface CategorizedCountryArchetype extends CountryArchetype {
  priority: number;
  categoryId: string;
  consolidatedCategoryId: string; // New consolidated category
}

/** An archetype as authored in ./archetype-data, before its consolidated category is derived. */
export type ArchetypeSeed = Omit<CategorizedCountryArchetype, "consolidatedCategoryId">;
// Helper to add consolidatedCategoryId to archetypes
function withConsolidatedCategory<T extends { categoryId: string }>(
  archetype: T
): T & { consolidatedCategoryId: string } {
  return {
    ...archetype,
    consolidatedCategoryId: categoryMapping[archetype.categoryId] || "economy-size",
  };
}

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
// Helper to get all unique consolidated categories that have archetypes
