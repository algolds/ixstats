import React from "react";
import { Search } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { FacetContainer } from "~/components/ui/facet-container";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardRarity } from "@prisma/client";

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
    <FacetContainer
      depth={1}
      enableRefraction={true}
      className="bg-card/60 border-border flex flex-wrap items-center gap-2.5 rounded-2xl border p-3.5 shadow-sm backdrop-blur-xl"
    >
      {/* Search Input */}
      <div className="relative max-w-md min-w-[220px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search title, nation, or keyword..."
          className="border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-8.5 rounded-xl pl-8 text-xs transition-all focus:ring-1"
        />
      </div>

      {/* Card Source / Importer Filter */}
      <select
        value={cardTypeFilter}
        onChange={(e) => {
          setCardTypeFilter(e.target.value as CardTypeFilter);
          setOffset(0);
        }}
        className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
      >
        <option value="all" className="bg-background text-foreground">
          All Card Sources
        </option>
        <option value="LORE_BATCH" className="bg-background text-foreground">
          Wiki Lore Cards
        </option>
        <option value="NS_IMPORT" className="bg-background text-foreground">
          NS Official Imports
        </option>
        <option value="USER_CUSTOM" className="bg-background text-foreground">
          User Imported / Custom
        </option>
        <option value="COMMONS_IMPORT" className="bg-background text-foreground">
          Commons Flag Imports
        </option>
      </select>

      {/* Lore Category Filter */}
      {cardTypeFilter !== "NS_IMPORT" && (
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as any);
            setOffset(0);
          }}
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Lore Categories
          </option>
          {Object.values(LoreCategory).map((cat) => (
            <option key={cat} value={cat} className="bg-background text-foreground">
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
          className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
        >
          <option value="all" className="bg-background text-foreground">
            All Nation States
          </option>
          <option value="active_only" className="bg-background text-foreground">
            Active Nations Only
          </option>
          <option value="cte_only" className="bg-background text-foreground">
            CTE / Defunct Only
          </option>
        </select>
      )}

      {/* Takedown Filter */}
      <select
        value={takedownFilter}
        onChange={(e) => {
          setTakedownFilter(e.target.value as any);
          setOffset(0);
        }}
        className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
      >
        <option value="all" className="bg-background text-foreground">
          All Visibility
        </option>
        <option value="visible" className="bg-background text-foreground">
          Visible Cards
        </option>
        <option value="takedown" className="bg-background text-foreground">
          Hidden / Retired
        </option>
      </select>

      {/* Season Filter */}
      <select
        value={season}
        onChange={(e) => {
          const val = e.target.value;
          setSeason(val === "all" ? "all" : parseInt(val, 10));
          setOffset(0);
        }}
        className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
      >
        <option value="all" className="bg-background text-foreground">
          All Seasons
        </option>
        <option value="1" className="bg-background text-foreground">
          Season 1
        </option>
        <option value="2" className="bg-background text-foreground">
          Season 2
        </option>
        <option value="3" className="bg-background text-foreground">
          Season 3
        </option>
      </select>

      {/* Rarity Filter */}
      <select
        value={rarity}
        onChange={(e) => {
          setRarity(e.target.value as any);
          setOffset(0);
        }}
        className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
      >
        <option value="all" className="bg-background text-foreground">
          All Rarities
        </option>
        <option value="COMMON" className="bg-background text-foreground">
          Common
        </option>
        <option value="UNCOMMON" className="bg-background text-foreground">
          Uncommon
        </option>
        <option value="RARE" className="bg-background text-foreground">
          Rare
        </option>
        <option value="ULTRA_RARE" className="bg-background text-foreground">
          Ultra Rare
        </option>
        <option value="EPIC" className="bg-background text-foreground">
          Epic
        </option>
        <option value="LEGENDARY" className="bg-background text-foreground">
          Legendary
        </option>
      </select>

      {/* Sort Option */}
      <select
        value={sortBy}
        onChange={(e) => {
          setSortBy(e.target.value as SortByOption);
          setOffset(0);
        }}
        className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-medium shadow-xs transition-all focus:outline-none"
      >
        <option value="recent" className="bg-background text-foreground">
          Sort: Most Recent
        </option>
        <option value="marketValue" className="bg-background text-foreground">
          Sort: Value (High to Low)
        </option>
        <option value="marketValue_asc" className="bg-background text-foreground">
          Sort: Value (Low to High)
        </option>
        <option value="name" className="bg-background text-foreground">
          Sort: Name (A-Z)
        </option>
        <option value="rarity" className="bg-background text-foreground">
          Sort: Rarity Tier
        </option>
      </select>
    </FacetContainer>
  );
});
