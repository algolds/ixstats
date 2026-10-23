/**
 * Card category taxonomy: each lore category's fixed subcategories (client-safe).
 *
 * Filters and sets rely on these lists, so every write path validates a subcategory against them
 * (`CategoryChoiceSchema`). A country is a Nation card, so Geography lists no country.
 */

import { z } from "zod";

import { LoreCategory } from "./category-enums";
import { UNCATEGORISED_LABEL, getCategoryLabel } from "./category-theme";

export interface Subcategory {
  id: string;
  label: string;
}

/** A subcategory's id is its label in kebab case ("River, lake or sea" is `river-lake-or-sea`). */
function fromLabels(...labels: string[]): readonly Subcategory[] {
  return labels.map((label) => ({
    id: label.toLowerCase().replace(/[^a-z]+/g, "-"),
    label,
  }));
}

export const SUBCATEGORIES: Readonly<Record<LoreCategory, readonly Subcategory[]>> = {
  MILITARY: fromLabels("Army", "Navy", "Air force", "Battle or war", "Weapon or vehicle", "Unit"),
  DIPLOMACY: fromLabels("Treaty", "Alliance or organisation", "Embassy or envoy", "Conference"),
  GEOGRAPHY: fromLabels(
    "Region or province",
    "City or settlement",
    "River, lake or sea",
    "Mountain or island",
    "Landmark"
  ),
  RELIGION: fromLabels("Faith", "Clergy", "Holy site", "Order or sect"),
  CULTURE: fromLabels(
    "Art or literature",
    "Music",
    "Sport",
    "Festival or tradition",
    "Language",
    "Media"
  ),
  GOVERNMENT: fromLabels(
    "Office or post",
    "Legislature or body",
    "Party",
    "Agency or ministry",
    "Constitution or law"
  ),
  PEOPLE: fromLabels(
    "Ruler or royal",
    "Politician",
    "Military figure",
    "Religious figure",
    "Artist or writer",
    "Scientist",
    "Family or dynasty"
  ),
  ECONOMY: fromLabels("Company", "Currency or bank", "Industry", "Trade route or market"),
  SCIENCE: fromLabels("Technology", "Discovery", "Institution"),
  HISTORY: fromLabels("Era or period", "Event", "Dynasty or state", "Document"),
  NATION: fromLabels("Nation", "Former state"),
  SPECIAL: [],
};

export function subcategoriesOf(category: LoreCategory): readonly Subcategory[] {
  return SUBCATEGORIES[category];
}

/** The label of a category's subcategory, or null when the category does not list it. */
export function subcategoryLabel(category: LoreCategory, id: string): string | null {
  return SUBCATEGORIES[category].find((s) => s.id === id)?.label ?? null;
}

/** A null subcategory is always valid; a non-null one needs a category that lists it. */
export function isSubcategoryOf(
  category: LoreCategory | null,
  subcategory: string | null
): boolean {
  if (subcategory === null) return true;
  return category !== null && subcategoryLabel(category, subcategory) !== null;
}

/** "History · Event", "Military", or "Uncategorised". */
export function categoryLine(category: LoreCategory | null, subcategory: string | null): string {
  if (category === null) return UNCATEGORISED_LABEL;
  const sub = subcategory === null ? null : subcategoryLabel(category, subcategory);
  return sub === null ? getCategoryLabel(category) : `${getCategoryLabel(category)} · ${sub}`;
}

export interface CategoryChoice {
  category: LoreCategory | null;
  subcategory: string | null;
}

/** The category choice every write path parses. */
export const CategoryChoiceSchema = z
  .object({
    category: z.enum(LoreCategory).nullable(),
    subcategory: z.string().trim().min(1).max(40).nullable(),
  })
  .refine((choice) => isSubcategoryOf(choice.category, choice.subcategory), {
    message: "That subcategory is not in that category",
    path: ["subcategory"],
  });
