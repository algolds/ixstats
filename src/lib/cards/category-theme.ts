/**
 * Category labels: the display name of each LoreCategory.
 */

import type { LoreCategory } from "./category-enums";

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
