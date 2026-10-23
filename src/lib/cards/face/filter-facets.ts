// src/lib/cards/face/filter-facets.ts
/**
 * The hub's filter choices: only the types and categories that have cards (card categories design, decision 4), and
 * Uncategorised when a lore card has no category. NationStates cards carry no category, so they never offer it.
 */
import {
  BROWSABLE_CATEGORIES,
  UNCATEGORISED,
  type CategoryFilterValue,
  type LoreCategory,
} from "~/lib/cards/category-enums";
import { TYPE_ORDER } from "./labels";
import type { CardType } from "./types";

export interface FilterFacets {
  types: CardType[];
  categories: CategoryFilterValue[];
}

/** The types and categories the rows hold, in the enums' order, Uncategorised last. */
export function filterFacets(
  rows: Iterable<{ cardType: CardType; category: LoreCategory | null }>
): FilterFacets {
  const types = new Set<CardType>();
  const categories = new Set<CategoryFilterValue>();
  for (const { cardType, category } of rows) {
    types.add(cardType);
    if (category !== null) categories.add(category);
    else if (cardType === "LORE") categories.add(UNCATEGORISED);
  }
  return {
    types: TYPE_ORDER.filter((type) => types.has(type)),
    categories: [...BROWSABLE_CATEGORIES, UNCATEGORISED].filter((c) => categories.has(c)),
  };
}

/** The types to offer: a picked type that has no cards any more stays listed, so it can be turned off. */
export function listedTypes(
  available: readonly CardType[],
  picked: readonly CardType[]
): CardType[] {
  return [...available, ...picked.filter((type) => !available.includes(type))];
}

/** The categories to offer: a picked category that has no cards any more stays listed, so it can be turned off. */
export function listedCategories(
  available: readonly CategoryFilterValue[],
  picked: CategoryFilterValue | null
): CategoryFilterValue[] {
  return picked === null || available.includes(picked) ? [...available] : [...available, picked];
}
