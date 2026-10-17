// src/lib/cards/face/mine-options.ts
/** Mine's sorts (spec §2.3 Mine), shared by the server query and the sort menu. */
export const MINE_SORTS = ["acquired", "rarity", "value", "title", "level"] as const;
export type MineSort = (typeof MINE_SORTS)[number];

export const MINE_SORT_OPTIONS: ReadonlyArray<{ value: MineSort; label: string }> = [
  { value: "acquired", label: "Newest first" },
  { value: "rarity", label: "Rarest first" },
  { value: "value", label: "Most valuable" },
  { value: "title", label: "Title" },
  { value: "level", label: "Highest level" },
];
