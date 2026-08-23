"use client";

import React from "react";
import { Component as Layers, Search, Xmark as X, Sparks as Sparkles, Page as FileText, Calendar, ViewGrid as Grid3x3, List, Expand as Maximize2, Copy } from "iconoir-react";
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
      <FacetCard
        depth={1}
        className="border-border rounded-xl bg-cyan-500/10 p-3 dark:bg-cyan-500/10"
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            My Cards
          </span>
          <Layers className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-xl font-bold tracking-tight text-cyan-600 tabular-nums dark:text-cyan-400">
            {totalCards} / {150 + capacityBoost}
          </span>
          <span className="text-muted-foreground text-[10px]">cards</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <IxCreditsSymbol className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-amber-600 dark:text-amber-400">
              <NumberFlow value={totalValue} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Copy className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
            <span className="font-bold text-purple-600 dark:text-purple-400">0</span>
          </div>
        </div>
      </FacetCard>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search cards..."
          className="border-border/50 placeholder:text-muted-foreground/50 bg-muted/30 focus:bg-background h-7 pr-6 pl-6.5 text-xs"
        />
        {filters.search && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
          </button>
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
            "h-7 w-full px-2 text-xs",
            filters.rarity !== "all" &&
              "border-amber-500/30 bg-amber-500/20 font-bold text-amber-600 dark:text-amber-300"
          )}
        >
          <Sparkles className="mr-1.5 h-3 w-3 shrink-0" />
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
            "h-7 w-full px-2 text-xs",
            filters.cardType !== "all" &&
              "border-cyan-500/30 bg-cyan-500/20 font-bold text-cyan-600 dark:text-cyan-300"
          )}
        >
          <FileText className="mr-1.5 h-3 w-3 shrink-0" />
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
            "h-7 w-full px-2 text-xs",
            filters.season !== "all" &&
              "border-purple-500/30 bg-purple-500/20 font-bold text-purple-600 dark:text-purple-300"
          )}
        >
          <Calendar className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          <SelectItem value="1">Season 1</SelectItem>
          <SelectItem value="2">Season 2</SelectItem>
          <SelectItem value="3">Season 3</SelectItem>
        </SelectContent>
      </Select>

      <div className="border-border/40 space-y-3 border-t pt-3">
        {/* Sort */}
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
            Sort By
          </p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-7 w-full text-xs">
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
          <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
            View
          </p>
          <div className="flex gap-1">
            {(["grid", "list", "compact"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="h-6 flex-1 text-[10px] font-semibold"
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
          <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors">
            <Checkbox
              checked={selectMode}
              onCheckedChange={(checked) => setSelectMode(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-medium">Multi-Select Mode</span>
          </label>
          <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors">
            <Checkbox
              checked={hideValue}
              onCheckedChange={(checked) => setHideValue(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-medium">Hide Card Values</span>
          </label>
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.search ||
        filters.rarity !== "all" ||
        filters.cardType !== "all" ||
        filters.season !== "all") && (
        <button
          onClick={onResetFilters}
          className="border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors"
        >
          <X className="h-3 w-3" /> Clear Filters
        </button>
      )}
    </div>
  );
}
