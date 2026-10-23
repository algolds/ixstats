/**
 * Category labels: the display name of each LoreCategory.
 */

import { UNCATEGORISED, type CategoryFilterValue, type LoreCategory } from "./category-enums";

const CATEGORY_LABELS: Record<LoreCategory, string> = {
  MILITARY: "Military",
  DIPLOMACY: "Diplomacy",
  GEOGRAPHY: "Geography",
  RELIGION: "Religion",
  CULTURE: "Culture",
  GOVERNMENT: "Government",
  PEOPLE: "People",
  ECONOMY: "Economy",
  SCIENCE: "Science",
  HISTORY: "History",
  NATION: "Nation",
  SPECIAL: "Special",
};

export function getCategoryLabel(category: LoreCategory): string {
  return CATEGORY_LABELS[category];
}

/** What the filters call a lore card with no category. */
export const UNCATEGORISED_LABEL = "Uncategorised";

/** A category filter choice's label: the category's own, else Uncategorised. */
export function getCategoryFilterLabel(value: CategoryFilterValue): string {
  return value === UNCATEGORISED ? UNCATEGORISED_LABEL : getCategoryLabel(value);
}
