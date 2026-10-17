// src/lib/cards/face/filters.ts
import type { LoreCategory } from "~/lib/cards/category-enums";
import type { ExploreQuery } from "~/lib/cards/hub/explore";
import type { MineQuery } from "~/lib/cards/hub/mine";
import type { OwnedFilter } from "./explore-options";
import type { CardFinish, CardRarity, CardType } from "./types";

/** The hub's card filters, one shape for Mine and Explore; each tab shows the ones it uses. */
export interface CardFilters {
  search: string;
  realmId: string | null;
  rarities: CardRarity[];
  finishes: CardFinish[];
  types: CardType[];
  category: LoreCategory | null;
  duplicates: boolean;
  owned: OwnedFilter;
  region: string | null;
}

export const EMPTY_CARD_FILTERS: CardFilters = {
  search: "",
  realmId: null,
  rarities: [],
  finishes: [],
  types: [],
  category: null,
  duplicates: false,
  owned: "all",
  region: null,
};

/** How many filters are on (the search box is not one). */
export function activeFilterCount(filters: CardFilters): number {
  return [
    filters.realmId !== null,
    filters.rarities.length > 0,
    filters.finishes.length > 0,
    filters.types.length > 0,
    filters.category !== null,
    filters.duplicates,
    filters.owned !== "all",
    filters.region !== null,
  ].filter(Boolean).length;
}

/** The filters both queries take, typed by both so a change to either schema shows here. */
type SharedKey = "search" | "realmId" | "rarities" | "types" | "categories";
type MineFilterInput = Pick<MineQuery, SharedKey | "finishes" | "duplicates">;
type ExploreFilterInput = Pick<ExploreQuery, SharedKey | "region"> &
  Partial<Pick<ExploreQuery, "owned">>;

function shared(filters: CardFilters): Pick<MineQuery & ExploreQuery, SharedKey> {
  const search = filters.search.trim();
  return {
    ...(search ? { search } : {}),
    ...(filters.realmId ? { realmId: filters.realmId } : {}),
    ...(filters.rarities.length > 0 ? { rarities: filters.rarities } : {}),
    ...(filters.types.length > 0 ? { types: filters.types } : {}),
    ...(filters.category ? { categories: [filters.category] } : {}),
  };
}

/** The Mine query a set of filters means; empty filters are left out. */
export function mineFilterInput(filters: CardFilters): MineFilterInput {
  return {
    ...shared(filters),
    ...(filters.finishes.length > 0 ? { finishes: filters.finishes } : {}),
    ...(filters.duplicates ? { duplicates: true } : {}),
  };
}

/** The Explore query a set of filters means; empty filters are left out. */
export function exploreFilterInput(filters: CardFilters): ExploreFilterInput {
  return {
    ...shared(filters),
    ...(filters.owned !== "all" ? { owned: filters.owned } : {}),
    ...(filters.region ? { region: filters.region } : {}),
  };
}
