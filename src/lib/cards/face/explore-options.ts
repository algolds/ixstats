/** Explore's sorts and the collected/missing switch, shared by the server query and the controls. */
export const EXPLORE_SORTS = ["newest", "rarity", "wanted", "title"] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export const EXPLORE_SORT_OPTIONS: ReadonlyArray<{ value: ExploreSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "rarity", label: "Rarest first" },
  { value: "wanted", label: "Most wanted" },
  { value: "title", label: "Title" },
];

export const OWNED_FILTERS = ["all", "owned", "missing"] as const;
export type OwnedFilter = (typeof OWNED_FILTERS)[number];

export const OWNED_FILTER_LABEL: Record<OwnedFilter, string> = {
  all: "All",
  owned: "Collected",
  missing: "Missing",
};
