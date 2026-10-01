import React from "react";
import { Search } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardRarity } from "@prisma/client";
import { fieldStyles } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type CardTypeFilter = "all" | "NS_IMPORT" | "USER_CUSTOM" | "LORE_BATCH" | "COMMONS_IMPORT";
export type SortByOption = "recent" | "marketValue" | "marketValue_asc" | "name" | "rarity";

interface CardExplorerFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  cardTypeFilter: CardTypeFilter;
  setCardTypeFilter: (v: CardTypeFilter) => void;
  categoryFilter: LoreCategory | "all";
  setCategoryFilter: (v: LoreCategory | "all") => void;
  cteFilter: "all" | "cte_only" | "active_only";
  setCteFilter: (v: "all" | "cte_only" | "active_only") => void;
  takedownFilter: "all" | "visible" | "takedown";
  setTakedownFilter: (v: "all" | "visible" | "takedown") => void;
  season: number | "all";
  setSeason: (v: number | "all") => void;
  rarity: CardRarity | "all";
  setRarity: (v: CardRarity | "all") => void;
  sortBy: SortByOption;
  setSortBy: (v: SortByOption) => void;
  setOffset: (v: number) => void;
}

export const CardExplorerFilters = React.memo(function CardExplorerFilters({
  search,
  setSearch,
  cardTypeFilter,
  setCardTypeFilter,
  categoryFilter,
  setCategoryFilter,
  cteFilter,
  setCteFilter,
  takedownFilter,
  setTakedownFilter,
  season,
  setSeason,
  rarity,
  setRarity,
  sortBy,
  setSortBy,
  setOffset,
}: CardExplorerFiltersProps) {
  return (
    <FacetCard className="flex flex-wrap items-center gap-2.5 p-3.5">
      {/* Search Input */}
      <div className="relative max-w-md min-w-[220px] flex-1">
        <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search title, nation, or keyword..."
          className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
        />
      </div>

      {/* Card Source / Importer Filter */}
      <select
        value={cardTypeFilter}
        onChange={(e) => {
          setCardTypeFilter(e.target.value as CardTypeFilter);
          setOffset(0);
        }}
        className={cn(
          fieldStyles,
          "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
        )}
      >
        <option value="all">All Card Sources</option>
        <option value="LORE_BATCH">Wiki Lore Cards</option>
        <option value="NS_IMPORT">NS Official Imports</option>
        <option value="USER_CUSTOM">User Imported / Custom</option>
        <option value="COMMONS_IMPORT">Commons Flag Imports</option>
      </select>

      {/* Lore Category Filter */}
      {cardTypeFilter !== "NS_IMPORT" && (
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as any);
            setOffset(0);
          }}
          className={cn(
            fieldStyles,
            "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
          )}
        >
          <option value="all">All Lore Categories</option>
          {Object.values(LoreCategory).map((cat) => (
            <option key={cat} value={cat}>
              {cat} — {getCategoryLabel(cat)}
            </option>
          ))}
        </select>
      )}

      {/* CTE Status Filter */}
      {cardTypeFilter !== "LORE_BATCH" && (
        <select
          value={cteFilter}
          onChange={(e) => {
            setCteFilter(e.target.value as any);
            setOffset(0);
          }}
          className={cn(
            fieldStyles,
            "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
          )}
        >
          <option value="all">All Nation States</option>
          <option value="active_only">Active Nations Only</option>
          <option value="cte_only">CTE / Defunct Only</option>
        </select>
      )}

      {/* Takedown Filter */}
      <select
        value={takedownFilter}
        onChange={(e) => {
          setTakedownFilter(e.target.value as any);
          setOffset(0);
        }}
        className={cn(
          fieldStyles,
          "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
        )}
      >
        <option value="all">All Visibility</option>
        <option value="visible">Visible Cards</option>
        <option value="takedown">Hidden / Retired</option>
      </select>

      {/* Season Filter */}
      <select
        value={season}
        onChange={(e) => {
          const val = e.target.value;
          setSeason(val === "all" ? "all" : parseInt(val, 10));
          setOffset(0);
        }}
        className={cn(
          fieldStyles,
          "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
        )}
      >
        <option value="all">All Seasons</option>
        <option value="1">Season 1</option>
        <option value="2">Season 2</option>
        <option value="3">Season 3</option>
      </select>

      {/* Rarity Filter */}
      <select
        value={rarity}
        onChange={(e) => {
          setRarity(e.target.value as any);
          setOffset(0);
        }}
        className={cn(
          fieldStyles,
          "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
        )}
      >
        <option value="all">All Rarities</option>
        <option value="COMMON">Common</option>
        <option value="UNCOMMON">Uncommon</option>
        <option value="RARE">Rare</option>
        <option value="ULTRA_RARE">Ultra Rare</option>
        <option value="EPIC">Epic</option>
        <option value="LEGENDARY">Legendary</option>
      </select>

      {/* Sort Option */}
      <select
        value={sortBy}
        onChange={(e) => {
          setSortBy(e.target.value as SortByOption);
          setOffset(0);
        }}
        className={cn(
          fieldStyles,
          "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
        )}
      >
        <option value="recent">Sort: Most Recent</option>
        <option value="marketValue">Sort: Value (High to Low)</option>
        <option value="marketValue_asc">Sort: Value (Low to High)</option>
        <option value="name">Sort: Name (A-Z)</option>
        <option value="rarity">Sort: Rarity Tier</option>
      </select>
    </FacetCard>
  );
});
