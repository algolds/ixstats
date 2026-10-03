"use client";

import React from "react";
import {
  Component as Layers,
  Sparks as Sparkles,
  Page as FileText,
  Calendar,
  ViewGrid as Grid3x3,
  List,
  Expand as Maximize2,
} from "iconoir-react";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import type { CardRarity, CardType } from "@prisma/client";
import type { FilterState, ViewMode } from "./types";
import {
  ClearFiltersButton,
  RARITY_OPTIONS,
  SEASON_OPTIONS,
  SidebarSearch,
  SidebarSelect,
  SidebarSort,
} from "./SidebarFilterControls";
import { Card } from "~/components/ui/card";

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
      <Card className="rounded-row bg-teal/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-label-secondary text-eyebrow">My cards</span>
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
              <NumberFlowDisplay value={totalValue} />
            </span>
          </div>
        </div>
      </Card>

      <SidebarSearch
        value={filters.search}
        onChange={(search) => setFilters((prev) => ({ ...prev, search }))}
      />

      <SidebarSelect
        value={filters.rarity}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, rarity: val as CardRarity | "all" }))
        }
        options={RARITY_OPTIONS}
        placeholder="Rarity"
        icon={Sparkles}
        active={filters.rarity !== "all"}
      />

      <SidebarSelect
        value={filters.cardType}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, cardType: val as CardType | "all" }))
        }
        options={[
          ["all", "All types"],
          ["NS_IMPORT", "NationStates import"],
          ["LORE_CARD", "Lore card"],
          ["EVENT_CARD", "Event card"],
        ]}
        placeholder="Type"
        icon={FileText}
        active={filters.cardType !== "all"}
        activeClass="border-teal/30 bg-teal/20 text-teal font-semibold"
      />

      <SidebarSelect
        value={filters.season.toString()}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, season: val === "all" ? "all" : parseInt(val) }))
        }
        options={SEASON_OPTIONS}
        placeholder="Season"
        icon={Calendar}
        active={filters.season !== "all"}
      />

      <div className="border-separator space-y-3 border-t pt-3">
        <SidebarSort
          value={sortBy}
          onValueChange={setSortBy}
          options={[
            ["acquired", "Recently acquired"],
            ["rarity", "Rarity (High to Low)"],
            ["value", "Market Value (High to Low)"],
            ["name", "Alphabetical"],
          ]}
        />

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
            <span className="text-footnote font-medium">Hide card values</span>
          </label>
        </div>
      </div>

      {(filters.search ||
        filters.rarity !== "all" ||
        filters.cardType !== "all" ||
        filters.season !== "all") && <ClearFiltersButton onClick={onResetFilters} />}
    </div>
  );
}
