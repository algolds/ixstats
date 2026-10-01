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
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
          <div className="border-tint/30 bg-tint-fill rounded-row border p-3">
            <SlidersHorizontal className="text-tint h-5 w-5" />
          </div>
          <div>
            <h3 className="text-label text-title-2">Card Explorer</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="tinted" size="sm" onClick={() => setIsBulkModalOpen(true)}>
            <EyeOff className="mr-2 h-3.5 w-3.5" />
            Bulk Visibility Controls
          </Button>
          <Badge variant="neutral" className="gap-2">
            <Layers className="text-tint h-3.5 w-3.5" />
            Showing <strong className="text-label">{loadedCount}</strong> of{" "}
            <strong className="text-label">{total.toLocaleString()}</strong>
          </Badge>
        </div>
      </div>

      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Visibility & Takedowns</DialogTitle>
            <DialogDescription>
              Batch update the visibility/retired status of cards matching selected filters.
            </DialogDescription>
          </DialogHeader>

          <div className="text-footnote space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Target Category
                </label>
                <Select
                  value={bulkCategoryFilter}
                  onValueChange={(v) => setBulkCategoryFilter(v as any)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.values(LoreCategory).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat} — {getCategoryLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Source Type</label>
                <Select value={bulkTargetType} onValueChange={(v) => setBulkTargetType(v as any)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="LORE">Lore Cards Only</SelectItem>
                    <SelectItem value="NS_IMPORT">NS Imports Only</SelectItem>
                    <SelectItem value="USER_CUSTOM">User Custom Only</SelectItem>
                    <SelectItem value="COMMONS_IMPORT">Commons Imports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Nation Status
                </label>
                <Select value={bulkCteFilter} onValueChange={(v) => setBulkCteFilter(v as any)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cte">CTE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Season</label>
                <Select value={bulkSeason} onValueChange={(v) => setBulkSeason(v as any)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">Season 1</SelectItem>
                    <SelectItem value="2">Season 2</SelectItem>
                    <SelectItem value="3">Season 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Rarity</label>
                <Select value={bulkRarity} onValueChange={(v) => setBulkRarity(v as any)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="COMMON">Common</SelectItem>
                    <SelectItem value="UNCOMMON">Uncommon</SelectItem>
                    <SelectItem value="RARE">Rare</SelectItem>
                    <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
                    <SelectItem value="EPIC">Epic</SelectItem>
                    <SelectItem value="LEGENDARY">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onBulkExecute(true)} disabled={isPending}>
              Hide Matching Cards
            </Button>
            <Button onClick={() => onBulkExecute(false)} disabled={isPending}>
              Restore Matching Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
