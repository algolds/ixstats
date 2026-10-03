"use client";

import React from "react";
import { Calendar, Sparks as Sparkles, OpenBook as BookOpen } from "iconoir-react";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { Button } from "~/components/ui/button";
import type { CardRarity } from "@prisma/client";
import type { GallerySource } from "./types";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  ClearFiltersButton,
  RARITY_OPTIONS,
  SEASON_OPTIONS,
  SidebarSearch,
  SidebarSelect,
  SidebarSort,
} from "./SidebarFilterControls";

export function GallerySidebarContent({
  source,
  setSource,
  search,
  setSearch,
  season,
  setSeason,
  rarity,
  setRarity,
  cteFilter,
  setCteFilter,
  sortBy,
  setSortBy,
  onClearFilters,
  onRequestLoreCard,
}: {
  source: GallerySource;
  setSource: (v: GallerySource) => void;
  search: string;
  setSearch: (v: string) => void;
  season: number | "all";
  setSeason: (v: number | "all") => void;
  rarity: CardRarity | "all";
  setRarity: (v: CardRarity | "all") => void;
  cteFilter?: "all" | "cte_only" | "active_only";
  setCteFilter?: (v: "all" | "cte_only" | "active_only") => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  onClearFilters: () => void;
  onRequestLoreCard: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Source Toggle */}
      <div>
        <p className="text-label-secondary text-eyebrow mb-2">Source</p>
        <SegmentedControl
          size="sm"
          fullWidth
          aria-label="Card source"
          value={source}
          onValueChange={setSource}
          options={[
            { value: "all" as GallerySource, label: "All" },
            {
              value: "ns" as GallerySource,
              label: (
                <span className="flex items-center gap-1">
                  <NationStatesLogo size="xs" />
                  NS
                </span>
              ),
              "aria-label": "NationStates",
            },
            { value: "lore" as GallerySource, label: "Lore" },
          ]}
        />
      </div>

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarSelect
        value={season.toString()}
        onValueChange={(v) => setSeason(v === "all" ? "all" : parseInt(v))}
        options={SEASON_OPTIONS}
        placeholder="Season"
        icon={Calendar}
        active={season !== "all"}
      />

      <SidebarSelect
        value={rarity}
        onValueChange={(v) => setRarity(v as CardRarity | "all")}
        options={RARITY_OPTIONS}
        placeholder="Rarity"
        icon={Sparkles}
        active={rarity !== "all"}
      />

      {/* Nation status (CTE vs active) */}
      {setCteFilter && (source === "all" || source === "ns") && (
        <SidebarSelect
          value={cteFilter || "all"}
          onValueChange={(v) => setCteFilter(v as "all" | "cte_only" | "active_only")}
          options={[
            ["all", "All nations"],
            ["cte_only", "CTE nations only"],
            ["active_only", "Active nations only"],
          ]}
          placeholder="Nation status"
          active={Boolean(cteFilter && cteFilter !== "all")}
        />
      )}

      <SidebarSort
        value={sortBy}
        onValueChange={setSortBy}
        options={[
          ["rarity", "Rarity"],
          ["marketValue", "Market value"],
          ["recent", "Recent"],
          ["name", "Name"],
        ]}
      />

      {/* Request Lore Card */}
      {(source === "all" || source === "lore") && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestLoreCard}
          className="border-wiki/30 text-wiki hover:bg-wiki/10 w-full"
        >
          <BookOpen className="mr-2 h-3 w-3" /> Request Lore Card
          <span className="bg-yellow/10 text-footnote text-yellow ml-2 flex items-center gap-0.5 rounded-full px-2 py-0 font-semibold">
            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
            50
          </span>
        </Button>
      )}

      {(search || rarity !== "all" || season !== "all") && (
        <ClearFiltersButton onClick={onClearFilters} />
      )}
    </div>
  );
}
