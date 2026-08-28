import React from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  EyeClosed as EyeOff,
  Component as Layers,
  ControlSlider as SlidersHorizontal,
} from "iconoir-react";
import { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardRarity } from "@prisma/client";

interface CardExplorerBatchBarProps {
  total: number;
  loadedCount: number;
  isBulkModalOpen: boolean;
  setIsBulkModalOpen: (v: boolean) => void;
  bulkTargetType: "all" | "NS_IMPORT" | "LORE" | "USER_CUSTOM" | "COMMONS_IMPORT";
  setBulkTargetType: (v: "all" | "NS_IMPORT" | "LORE" | "USER_CUSTOM" | "COMMONS_IMPORT") => void;
  bulkCteFilter: "all" | "active" | "cte";
  setBulkCteFilter: (v: "all" | "active" | "cte") => void;
  bulkCategoryFilter: "all" | LoreCategory;
  setBulkCategoryFilter: (v: "all" | LoreCategory) => void;
  bulkSeason: "all" | "1" | "2" | "3";
  setBulkSeason: (v: "all" | "1" | "2" | "3") => void;
  bulkRarity: "all" | CardRarity;
  setBulkRarity: (v: "all" | CardRarity) => void;
  onBulkExecute: (isRetired: boolean) => void;
  isPending: boolean;
}

export const CardExplorerBatchBar = React.memo(function CardExplorerBatchBar({
  total,
  loadedCount,
  isBulkModalOpen,
  setIsBulkModalOpen,
  bulkTargetType,
  setBulkTargetType,
  bulkCteFilter,
  setBulkCteFilter,
  bulkCategoryFilter,
  setBulkCategoryFilter,
  bulkSeason,
  setBulkSeason,
  bulkRarity,
  setBulkRarity,
  onBulkExecute,
  isPending,
}: CardExplorerBatchBarProps) {
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="border-primary/30 bg-primary/10 rounded-xl border p-2.5 backdrop-blur-md">
            <SlidersHorizontal className="text-primary h-5 w-5" />
          </div>
          <div>
            <h3 className="text-foreground text-xl font-bold tracking-tight">Card Explorer</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsBulkModalOpen(true)}
            className="border-primary/30 bg-primary/20 text-primary hover:bg-primary/30 h-8 rounded-xl border text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Bulk Visibility Controls
          </Button>
          <span className="border-border bg-card/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Layers className="text-primary h-3.5 w-3.5" />
            Showing <strong className="text-foreground">{loadedCount}</strong> of{" "}
            <strong className="text-foreground">{total.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="border-border bg-card text-card-foreground max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Bulk Visibility & Takedowns</DialogTitle>
            <DialogDescription className="text-xs">
              Batch update the visibility/retired status of cards matching selected filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Target Category
                </label>
                <select
                  value={bulkCategoryFilter}
                  onChange={(e) => setBulkCategoryFilter(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {Object.values(LoreCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} — {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Source Type
                </label>
                <select
                  value={bulkTargetType}
                  onChange={(e) => setBulkTargetType(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="all">All Sources</option>
                  <option value="LORE">Lore Cards Only</option>
                  <option value="NS_IMPORT">NS Imports Only</option>
                  <option value="USER_CUSTOM">User Custom Only</option>
                  <option value="COMMONS_IMPORT">Commons Imports</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Nation Status
                </label>
                <select
                  value={bulkCteFilter}
                  onChange={(e) => setBulkCteFilter(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="cte">CTE</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Season
                </label>
                <select
                  value={bulkSeason}
                  onChange={(e) => setBulkSeason(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="1">Season 1</option>
                  <option value="2">Season 2</option>
                  <option value="3">Season 3</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Rarity
                </label>
                <select
                  value={bulkRarity}
                  onChange={(e) => setBulkRarity(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent h-8.5 w-full rounded-xl border px-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="COMMON">Common</option>
                  <option value="UNCOMMON">Uncommon</option>
                  <option value="RARE">Rare</option>
                  <option value="ULTRA_RARE">Ultra Rare</option>
                  <option value="EPIC">Epic</option>
                  <option value="LEGENDARY">Legendary</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => onBulkExecute(true)}
              disabled={isPending}
              className="bg-rose-500 font-semibold text-white hover:bg-rose-600"
            >
              Hide Matching Cards
            </Button>
            <Button
              onClick={() => onBulkExecute(false)}
              disabled={isPending}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              Restore Matching Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
