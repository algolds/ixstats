"use client";

import React from "react";
import {
  Search,
  Xmark as X,
  Calendar,
  Sparks as Sparkles,
  OpenBook as BookOpen,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { CardRarity } from "@prisma/client";
import type { GallerySource } from "./types";

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
        <p className="text-label-secondary text-eyebrow mb-1.5">Source</p>
        <div className="flex gap-1">
          {(["all", "ns", "lore"] as GallerySource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "rounded-control-sm text-footnote flex flex-1 items-center justify-center gap-1 px-2 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                source === s
                  ? "bg-tint-fill text-tint font-medium"
                  : "text-label-secondary hover:text-label hover:bg-fill-3"
              )}
            >
              {s === "all" ? (
                "All"
              ) : s === "ns" ? (
                <span className="flex items-center gap-1">
                  <NationStatesLogo size="xs" />
                  NS
                </span>
              ) : (
                "Lore"
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="border-separator placeholder:text-label-tertiary bg-fill-4 focus:bg-background text-footnote h-7 pr-6 pl-6.5"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X className="text-label-secondary hover:text-label h-3 w-3 transition-colors" />
          </button>
        )}
      </div>

      {/* Season */}
      <Select
        value={season.toString()}
        onValueChange={(v) => setSeason(v === "all" ? "all" : parseInt(v))}
      >
        <SelectTrigger
          className={cn(
            "text-footnote h-7 w-full px-2",
            season !== "all" && "bg-tint-fill text-tint font-medium"
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

      {/* Rarity */}
      <Select value={rarity} onValueChange={(v) => setRarity(v as CardRarity | "all")}>
        <SelectTrigger
          className={cn(
            "text-footnote h-7 w-full px-2",
            rarity !== "all" && "bg-tint-fill text-tint font-medium"
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

      {/* Nation Status (CTE vs Active) */}
      {setCteFilter && (source === "all" || source === "ns") && (
        <Select
          value={cteFilter || "all"}
          onValueChange={(v) => setCteFilter(v as "all" | "cte_only" | "active_only")}
        >
          <SelectTrigger
            className={cn(
              "text-footnote h-7 w-full px-2",
              cteFilter && cteFilter !== "all" && "bg-tint-fill text-tint font-medium"
            )}
          >
            <SelectValue placeholder="Nation Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Nations</SelectItem>
            <SelectItem value="cte_only">CTE Nations Only</SelectItem>
            <SelectItem value="active_only">Active Nations Only</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Sort */}
      <div>
        <p className="text-label-secondary text-eyebrow mb-1">Sort By</p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="text-footnote h-7 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rarity">Rarity</SelectItem>
            <SelectItem value="marketValue">Market Value</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request Lore Card */}
      {(source === "all" || source === "lore") && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestLoreCard}
          className="border-wiki/30 text-wiki hover:bg-wiki/10 w-full"
        >
          <BookOpen className="mr-1.5 h-3 w-3" /> Request Lore Card
          <span className="bg-yellow/10 text-footnote text-yellow ml-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0 font-semibold">
            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
            50
          </span>
        </Button>
      )}

      {/* Clear */}
      {(search || rarity !== "all" || season !== "all") && (
        <button
          onClick={onClearFilters}
          className="border-separator text-label-secondary hover:text-label hover:bg-fill-3 rounded-control text-footnote flex w-full items-center justify-center gap-1 border py-1.5 font-semibold transition-colors"
        >
          <X className="h-3 w-3" /> Clear Filters
        </button>
      )}
    </div>
  );
}
