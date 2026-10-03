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
import { ValueSelect } from "~/components/ui/value-select";

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
            <h3 className="text-label text-title-2">Card explorer</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsBulkModalOpen(true)}>
            <EyeOff className="mr-2 h-3.5 w-3.5" />
            Bulk visibility controls
          </Button>
          <Badge variant="default" className="gap-2">
            <Layers className="text-tint h-3.5 w-3.5" />
            Showing <strong className="text-label">{loadedCount}</strong> of{" "}
            <strong className="text-label">{total.toLocaleString()}</strong>
          </Badge>
        </div>
      </div>

      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk visibility & takedowns</DialogTitle>
            <DialogDescription>
              Batch update the visibility/retired status of cards matching selected filters.
            </DialogDescription>
          </DialogHeader>

          <div className="text-footnote space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Target category
                </label>
                <ValueSelect
                  value={bulkCategoryFilter}
                  onValueChange={(v) => setBulkCategoryFilter(v as any)}
                  options={[
                    ["all", "All categories"],
                    ...Object.values(LoreCategory).map(
                      (cat) => [cat, `${cat}: ${getCategoryLabel(cat)}`] as const
                    ),
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Source type</label>
                <ValueSelect
                  value={bulkTargetType}
                  onValueChange={(v) => setBulkTargetType(v as any)}
                  options={[
                    ["all", "All sources"],
                    ["LORE", "Lore cards only"],
                    ["NS_IMPORT", "NS Imports Only"],
                    ["USER_CUSTOM", "User custom only"],
                    ["COMMONS_IMPORT", "Commons imports"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Nation status
                </label>
                <ValueSelect
                  value={bulkCteFilter}
                  onValueChange={(v) => setBulkCteFilter(v as any)}
                  options={[
                    ["all", "All"],
                    ["active", "Active"],
                    ["cte", "CTE"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Season</label>
                <ValueSelect
                  value={bulkSeason}
                  onValueChange={(v) => setBulkSeason(v as any)}
                  options={[
                    ["all", "All"],
                    ["1", "Season 1"],
                    ["2", "Season 2"],
                    ["3", "Season 3"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label-secondary text-caption mb-1 block">Rarity</label>
                <ValueSelect
                  value={bulkRarity}
                  onValueChange={(v) => setBulkRarity(v as any)}
                  options={[
                    ["all", "All"],
                    ["COMMON", "Common"],
                    ["UNCOMMON", "Uncommon"],
                    ["RARE", "Rare"],
                    ["ULTRA_RARE", "Ultra rare"],
                    ["EPIC", "Epic"],
                    ["LEGENDARY", "Legendary"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onBulkExecute(true)} disabled={isPending}>
              Hide matching cards
            </Button>
            <Button onClick={() => onBulkExecute(false)} disabled={isPending}>
              Restore matching cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
