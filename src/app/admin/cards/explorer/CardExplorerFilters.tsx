import React from "react";
import { Search } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardRarity } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
    <Card className="flex flex-wrap items-center gap-2 p-4">
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
      <Select
        value={cardTypeFilter}
        onValueChange={(v) => {
          setCardTypeFilter(v as CardTypeFilter);
          setOffset(0);
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All card sources</SelectItem>
          <SelectItem value="LORE_BATCH">Wiki lore cards</SelectItem>
          <SelectItem value="NS_IMPORT">NS Official Imports</SelectItem>
          <SelectItem value="USER_CUSTOM">User Imported / Custom</SelectItem>
          <SelectItem value="COMMONS_IMPORT">Commons flag imports</SelectItem>
        </SelectContent>
      </Select>

      {cardTypeFilter !== "NS_IMPORT" && (
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v as any);
            setOffset(0);
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lore categories</SelectItem>
            {Object.values(LoreCategory).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}: {getCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {cardTypeFilter !== "LORE_BATCH" && (
        <Select
          value={cteFilter}
          onValueChange={(v) => {
            setCteFilter(v as any);
            setOffset(0);
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All nation states</SelectItem>
            <SelectItem value="active_only">Active nations only</SelectItem>
            <SelectItem value="cte_only">CTE / Defunct Only</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select
        value={takedownFilter}
        onValueChange={(v) => {
          setTakedownFilter(v as any);
          setOffset(0);
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All visibility</SelectItem>
          <SelectItem value="visible">Visible cards</SelectItem>
          <SelectItem value="takedown">Hidden / Retired</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={String(season)}
        onValueChange={(v) => {
          const val = v;
          setSeason(val === "all" ? "all" : parseInt(val, 10));
          setOffset(0);
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All seasons</SelectItem>
          <SelectItem value="1">Season 1</SelectItem>
          <SelectItem value="2">Season 2</SelectItem>
          <SelectItem value="3">Season 3</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={rarity}
        onValueChange={(v) => {
          setRarity(v as any);
          setOffset(0);
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All rarities</SelectItem>
          <SelectItem value="COMMON">Common</SelectItem>
          <SelectItem value="UNCOMMON">Uncommon</SelectItem>
          <SelectItem value="RARE">Rare</SelectItem>
          <SelectItem value="ULTRA_RARE">Ultra rare</SelectItem>
          <SelectItem value="EPIC">Epic</SelectItem>
          <SelectItem value="LEGENDARY">Legendary</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={sortBy}
        onValueChange={(v) => {
          setSortBy(v as SortByOption);
          setOffset(0);
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Sort: Most Recent</SelectItem>
          <SelectItem value="marketValue">Sort: Value (High to Low)</SelectItem>
          <SelectItem value="marketValue_asc">Sort: Value (Low to High)</SelectItem>
          <SelectItem value="name">Sort: Name (A-Z)</SelectItem>
          <SelectItem value="rarity">Sort: Rarity Tier</SelectItem>
        </SelectContent>
      </Select>
    </Card>
  );
});
