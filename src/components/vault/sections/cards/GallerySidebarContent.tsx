"use client";

import React from "react";
import { Search, X, Calendar, Sparkles, BookOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
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
        <p className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-widest uppercase">
          Source
        </p>
        <div className="flex gap-1">
          {(["all", "ns", "lore"] as GallerySource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-all",
                source === s
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {s === "all" ? "All" : s === "ns" ? "NS" : "Lore"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="border-border/50 placeholder:text-muted-foreground/50 h-7 bg-transparent pr-6 pl-6.5 text-xs"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
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
            "h-7 w-full px-2 text-xs",
            season !== "all" && "border-purple-500/30 bg-purple-500/20 text-purple-100"
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
            "h-7 w-full px-2 text-xs",
            rarity !== "all" && "border-amber-500/30 bg-amber-500/20 text-amber-100"
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
              "h-7 w-full px-2 text-xs",
              cteFilter && cteFilter !== "all" && "border-amber-500/30 bg-amber-500/20 text-amber-100"
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
        <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
          Sort By
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 w-full text-xs">
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
          className="h-8 w-full border-purple-500/30 text-xs text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
        >
          <BookOpen className="mr-1.5 h-3 w-3" /> Request Lore Card
          <span className="ml-1.5 flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
            50
          </span>
        </Button>
      )}

      {/* Clear */}
      {(search || rarity !== "all" || season !== "all") && (
        <button
          onClick={onClearFilters}
          className="border-border/50 text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
        >
          <X className="h-3 w-3" /> Clear Filters
        </button>
      )}
    </div>
  );
}
