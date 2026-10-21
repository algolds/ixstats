/** The cards admin's nine flat tabs (cards refresh spec §2.4), and the `?tab=` values older links used. */
export const CARDS_ADMIN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "library", label: "Library" },
  { id: "imports", label: "Imports" },
  { id: "curation", label: "Curation" },
  { id: "packs", label: "Packs" },
  { id: "economy", label: "Economy" },
  { id: "seasons", label: "Seasons" },
  { id: "compliance", label: "Compliance" },
  { id: "designer", label: "Designer" },
] as const;

export type CardsAdminTab = (typeof CARDS_ADMIN_TABS)[number]["id"];

/** A Map, so a `?tab=` naming an Object prototype key ("constructor") opens nothing. */
const LEGACY_TABS: ReadonlyMap<string, CardsAdminTab> = new Map<string, CardsAdminTab>([
  ["explorer", "library"],
  ["import", "imports"],
  ["lore", "imports"],
  ["commons", "imports"],
  ["sync", "imports"],
  ["wiki", "imports"],
  ["ns", "imports"],
  ["general", "economy"],
  ["market", "economy"],
  ["rarity", "economy"],
  ["valuation", "economy"],
  ["takedowns", "compliance"],
  ["requests", "curation"],
]);

const tabNamed = (value: string | null | undefined): CardsAdminTab | undefined =>
  value
    ? (CARDS_ADMIN_TABS.find((tab) => tab.id === value)?.id ?? LEGACY_TABS.get(value))
    : undefined;

/** The tab a `?tab=` (and the old `?tab=settings&subtab=`) link opens. */
export function cardsAdminTabFromParam(
  tab: string | null | undefined,
  subtab?: string | null
): CardsAdminTab {
  if (tab === "settings") return tabNamed(subtab) ?? "economy";
  return tabNamed(tab) ?? "overview";
}
