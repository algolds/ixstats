import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import type { CardRarity } from "@prisma/client";
import { LoreCategory, ArtworkSource, BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardInstance } from "~/types/cards-display";
import { ValueSelect } from "~/components/ui/value-select";

interface CardEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCardForEdit: CardInstance | null;
  livePreviewCard: CardInstance | null;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editCategory: LoreCategory | "";
  setEditCategory: (v: LoreCategory | "") => void;
  editCardType: string;
  setEditCardType: (v: string) => void;
  editRarity: CardRarity;
  setEditRarity: (v: CardRarity) => void;
  editArtworkUrl: string;
  setEditArtworkUrl: (v: string) => void;
  editArtworkSource: ArtworkSource;
  setEditArtworkSource: (v: ArtworkSource) => void;
  editMarketValue: number;
  setEditMarketValue: (v: number) => void;
  editIsRetired: boolean;
  setEditIsRetired: (v: boolean) => void;
  onSave: () => void;
  isPending: boolean;
}

export const CardEditDialog = React.memo(function CardEditDialog({
  isOpen,
  onClose,
  selectedCardForEdit,
  livePreviewCard,
  editTitle,
  setEditTitle,
  editCategory,
  setEditCategory,
  editCardType,
  setEditCardType,
  editRarity,
  setEditRarity,
  editArtworkUrl,
  setEditArtworkUrl,
  editArtworkSource,
  setEditArtworkSource,
  editMarketValue,
  setEditMarketValue,
  editIsRetired,
  setEditIsRetired,
  onSave,
  isPending,
}: CardEditDialogProps) {
  if (!isOpen || !selectedCardForEdit) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Card Studio: Edit Card Details</span>
            <span className="text-label-secondary text-footnote font-mono">
              ID: {selectedCardForEdit.id}
            </span>
          </SheetTitle>
          <SheetDescription>
            Edit visual appearance, rarity, lore category, artwork source, and visibility state.
          </SheetDescription>
        </SheetHeader>

        <div className="my-2 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Left Column: Live Card Preview */}
          <div className="flex flex-col items-center justify-center md:col-span-5">
            <div className="text-label-secondary text-caption mb-2 text-center">Card preview</div>
            {livePreviewCard && (
              <div className="scale-90 transition-[color,background-color,border-color,box-shadow,opacity,transform] sm:scale-100">
                <CardDisplay card={livePreviewCard} size="md" />
              </div>
            )}
          </div>

          {/* Right Column: Interactive Editor Form */}
          <div className="space-y-4 md:col-span-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label text-caption mb-1 block">Card Origin / Type</label>
                <ValueSelect
                  value={editCardType}
                  onValueChange={(v) => setEditCardType(v)}
                  options={[
                    ["LORE", "Wiki Lore Card (Wiki)"],
                    ["NS_IMPORT", "NationStates Import (NS Import)"],
                    ["COMMONS_IMPORT", "Commons Flag Import (Commons)"],
                    ["USER_CUSTOM", "User Custom Import (Custom)"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label text-caption mb-1 block">Card title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Article title..."
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            </div>

            <div>
              <label className="text-label text-caption mb-1 block flex items-center justify-between">
                <span>Lore category</span>
                <span className="text-label-secondary text-footnote font-normal">
                  Sets background theme & icon watermark
                </span>
              </label>
              <ValueSelect
                value={(editCategory === "NS_IMPORT" ? "" : editCategory) || "__none__"}
                onValueChange={(v) => setEditCategory((v === "__none__" ? "" : v) as LoreCategory)}
                options={[
                  ["__none__", "(Default / Unassigned)"],
                  ...BROWSABLE_CATEGORIES.map(
                    (cat) => [cat, `${cat}: ${getCategoryLabel(cat)}`] as const
                  ),
                ]}
                size="sm"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label text-caption mb-1 block">Rarity tier</label>
                <ValueSelect
                  value={editRarity}
                  onValueChange={(v) => setEditRarity(v as CardRarity)}
                  options={[
                    ["COMMON", "COMMON"],
                    ["UNCOMMON", "UNCOMMON"],
                    ["RARE", "RARE"],
                    ["ULTRA_RARE", "ULTRA RARE"],
                    ["EPIC", "EPIC"],
                    ["LEGENDARY", "LEGENDARY"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label text-caption mb-1 block">
                  Est. Market Value (IxC)
                </label>
                <Input
                  type="number"
                  value={editMarketValue}
                  onChange={(e) => setEditMarketValue(parseInt(e.target.value, 10) || 0)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-label text-caption mb-1 block">Artwork source tier</label>
                <ValueSelect
                  value={editArtworkSource}
                  onValueChange={(v) => setEditArtworkSource(v as ArtworkSource)}
                  options={[
                    ["PROCEDURAL", "Tier 1-2: Procedural Icon Emblem (No Image)"],
                    ["WIKI_FETCHED", "Tier 3: Wiki Fetched Image"],
                    ["FLAG", "Tier 3: National Flag Artwork"],
                    ["UPLOADED", "Tier 3: Admin Custom Upload"],
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-label text-caption mb-1 block">Artwork URL</label>
                <Input
                  value={editArtworkUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setEditArtworkUrl(url);
                    if (url.trim() && editArtworkSource === "PROCEDURAL") {
                      setEditArtworkSource("WIKI_FETCHED");
                    }
                  }}
                  placeholder="https://... image URL (optional)"
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                />
              </div>
            </div>

            <div className="border-separator bg-surface rounded-row flex items-center justify-between border p-3">
              <div>
                <div className="text-label text-caption">Card visibility status</div>
                <div className="text-label-secondary text-footnote">
                  Hidden cards are retired from packs & marketplace.
                </div>
              </div>
              <label className="text-footnote text-label-secondary flex items-center gap-2">
                {editIsRetired ? "Hidden / Retired" : "Visible"}
                <Switch
                  checked={!editIsRetired}
                  onCheckedChange={(visible) => setEditIsRetired(!visible)}
                  aria-label="Card visible"
                />
              </label>
            </div>
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            Save card changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
});
