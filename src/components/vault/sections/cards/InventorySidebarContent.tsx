"use client";

import React from "react";
import {
  Component as Layers,
  Search,
  Xmark as X,
  Sparks as Sparkles,
  Page as FileText,
  Calendar,
  ViewGrid as Grid3x3,
  List,
  Expand as Maximize2,
  Copy,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FacetCard } from "~/components/ui/facet-container";
import NumberFlow from "~/components/ui/number-flow";
import type { CardRarity, CardType } from "@prisma/client";
import type { FilterState, ViewMode } from "./types";

export function InventorySidebarContent({
  totalCards,
  totalValue,
  capacityBoost,
  filters,
  setFilters,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  selectMode,
  setSelectMode,
  hideValue,
  setHideValue,
  onResetFilters,
}: {
  totalCards: number;
  totalValue: number;
  capacityBoost: number;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sortBy: string;
  setSortBy: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  hideValue: boolean;
  setHideValue: (v: boolean) => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Stats */}
      <FacetCard className="rounded-row bg-teal/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">My Cards</span>
          <Layers className="text-teal h-3.5 w-3.5" />
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-title-2 text-teal tabular-nums">
            {totalCards} / {150 + capacityBoost}
          </span>
          <span className="text-label-secondary text-footnote">cards</span>
        </div>
        <div className="text-footnote mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <IxCreditsSymbol className="text-yellow h-3 w-3 shrink-0" />
            <span className="text-yellow font-semibold">
              <NumberFlow value={totalValue} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Copy className="text-indigo h-3 w-3 shrink-0" />
            <span className="text-indigo font-semibold">0</span>
          </div>
        </div>
      </FacetCard>

      {/* Search */}
      <div className="relative">
        <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search cards..."
          className="border-separator placeholder:text-label-tertiary bg-fill-4 focus:bg-background text-footnote h-7 pr-6 pl-6"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
            className="text-label-secondary absolute top-1/2 right-1 size-5 -translate-y-1/2"
          >
            <X className="text-label-secondary hover:text-label h-3 w-3 transition-colors" />
          </Button>
        )}
      </div>

      {/* Rarity */}
      <Select
        value={filters.rarity}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, rarity: val as CardRarity | "all" }))
        }
      >
        <SelectTrigger
          className={cn(
            "text-footnote h-7 w-full px-2",
            filters.rarity !== "all" && "bg-tint-fill text-tint font-medium"
          )}
        >
          <Sparkles className="mr-2 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Rarity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Rarities</SelectItem>
          <SelectItem value="COMMON">Common</SelectItem>
          <SelectItem value="UNCOMMON">Uncommon</SelectItem>
          <SelectItem value="RARE">Rare</SelectItem>
          <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
          <SelectItem value="EPIC">Epic</SelectItem>
          <SelectItem value="LEGENDARY">Legendary</SelectItem>
        </SelectContent>
      </Select>

      {/* Card Type */}
      <Select
        value={filters.cardType}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, cardType: val as CardType | "all" }))
        }
      >
        <SelectTrigger
          className={cn(
            "text-footnote h-7 w-full px-2",
            filters.cardType !== "all" && "border-teal/30 bg-teal/20 text-teal font-semibold"
          )}
        >
          <FileText className="mr-2 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="NS_IMPORT">NationStates Import</SelectItem>
          <SelectItem value="LORE_CARD">Lore Card</SelectItem>
          <SelectItem value="EVENT_CARD">Event Card</SelectItem>
        </SelectContent>
      </Select>

      {/* Season */}
      <Select
        value={filters.season.toString()}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, season: val === "all" ? "all" : parseInt(val) }))
        }
      >
        <SelectTrigger
          className={cn(
            "text-footnote h-7 w-full px-2",
            filters.season !== "all" && "bg-tint-fill text-tint font-medium"
          )}
        >
          <Calendar className="mr-2 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          <SelectItem value="1">Season 1</SelectItem>
          <SelectItem value="2">Season 2</SelectItem>
          <SelectItem value="3">Season 3</SelectItem>
        </SelectContent>
      </Select>

      <div className="border-separator space-y-3 border-t pt-3">
        {/* Sort */}
        <div>
          <p className="text-label-secondary text-eyebrow mb-1">Sort By</p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="text-footnote h-7 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acquired">Recently Acquired</SelectItem>
              <SelectItem value="rarity">Rarity (High to Low)</SelectItem>
              <SelectItem value="value">Market Value (High to Low)</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode */}
        <div>
          <p className="text-label-secondary text-eyebrow mb-1">View</p>
          <div className="flex gap-1">
            {(["grid", "list", "compact"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="text-footnote h-6 flex-1 font-semibold"
              >
                {mode === "grid" ? (
                  <>
                    <Grid3x3 className="mr-1 h-3 w-3" /> Grid
                  </>
                ) : mode === "list" ? (
                  <>
                    <List className="mr-1 h-3 w-3" /> List
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-1 h-3 w-3" /> Cmpt
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Multi-Select & Hide Value */}
        <div className="flex flex-col gap-1">
          <label className="hover:bg-fill-3 rounded-control flex cursor-pointer items-center gap-2 p-2 transition-colors">
            <Checkbox
              checked={selectMode}
              onCheckedChange={(checked) => setSelectMode(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-footnote font-medium">Multi-Select Mode</span>
          </label>
          <label className="hover:bg-fill-3 rounded-control flex cursor-pointer items-center gap-2 p-2 transition-colors">
            <Checkbox
              checked={hideValue}
              onCheckedChange={(checked) => setHideValue(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-footnote font-medium">Hide Card Values</span>
          </label>
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.search ||
        filters.rarity !== "all" ||
        filters.cardType !== "all" ||
        filters.season !== "all") && (
        <Button
          variant="bordered"
          size="sm"
          onClick={onResetFilters}
          className="text-label-secondary w-full"
        >
          <X className="h-3 w-3" /> Clear Filters
        </Button>
      )}
    </div>
  );
}
