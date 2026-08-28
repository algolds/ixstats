import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import type { CardRarity } from "@prisma/client";
import { LoreCategory, ArtworkSource, BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardInstance } from "~/types/cards-display";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-card/95 text-card-foreground max-w-4xl backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base font-bold">
            <span>Card Studio: Edit Card Details</span>
            <span className="text-muted-foreground font-mono text-xs">
              ID: {selectedCardForEdit.id}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Edit visual appearance, rarity, lore category, artwork source, and visibility state.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Left Column: Live Card Preview */}
          <div className="flex flex-col items-center justify-center md:col-span-5">
            <div className="text-muted-foreground mb-2 text-center text-xs font-semibold">
              Live Real-Time Card Preview
            </div>
            {livePreviewCard && (
              <div className="scale-90 transition-all sm:scale-100">
                <CardDisplay card={livePreviewCard} size="md" />
              </div>
            )}
          </div>

          {/* Right Column: Interactive Editor Form */}
          <div className="space-y-4 md:col-span-7">
            {/* Origin & Title */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Card Origin / Type
                </label>
                <select
                  value={editCardType}
                  onChange={(e) => setEditCardType(e.target.value)}
                  className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="LORE">Wiki Lore Card (Wiki)</option>
                  <option value="NS_IMPORT">NationStates Import (NS Import)</option>
                  <option value="COMMONS_IMPORT">Commons Flag Import (Commons)</option>
                  <option value="USER_CUSTOM">User Custom Import (Custom)</option>
                </select>
              </div>

              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Card Title
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Article title..."
                  className="border-border bg-card text-foreground h-9 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Lore Category */}
            <div>
              <label className="text-foreground mb-1 block flex items-center justify-between text-xs font-semibold">
                <span>Lore Category</span>
                <span className="text-muted-foreground text-[10px] font-normal">
                  Sets background theme & icon watermark
                </span>
              </label>
              <select
                value={editCategory === "NS_IMPORT" ? "" : editCategory}
                onChange={(e) => setEditCategory(e.target.value as LoreCategory)}
                className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
              >
                <option value="">(Default / Unassigned)</option>
                {BROWSABLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} — {getCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>

            {/* Rarity & Market Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Rarity Tier
                </label>
                <select
                  value={editRarity}
                  onChange={(e) => setEditRarity(e.target.value as CardRarity)}
                  className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="COMMON">COMMON</option>
                  <option value="UNCOMMON">UNCOMMON</option>
                  <option value="RARE">RARE</option>
                  <option value="ULTRA_RARE">ULTRA RARE</option>
                  <option value="EPIC">EPIC</option>
                  <option value="LEGENDARY">LEGENDARY</option>
                </select>
              </div>

              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Est. Market Value (IxC)
                </label>
                <Input
                  type="number"
                  value={editMarketValue}
                  onChange={(e) => setEditMarketValue(parseInt(e.target.value, 10) || 0)}
                  className="border-border bg-card text-foreground h-9 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Artwork Source & URL */}
            <div className="space-y-2">
              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Artwork Source Tier
                </label>
                <select
                  value={editArtworkSource}
                  onChange={(e) => setEditArtworkSource(e.target.value as ArtworkSource)}
                  className="border-border bg-card text-foreground hover:bg-accent h-9 w-full rounded-xl border px-3 text-xs font-semibold focus:outline-none"
                >
                  <option value="PROCEDURAL">Tier 1-2: Procedural Icon Emblem (No Image)</option>
                  <option value="WIKI_FETCHED">Tier 3: Wiki Fetched Image</option>
                  <option value="FLAG">Tier 3: National Flag Artwork</option>
                  <option value="UPLOADED">Tier 3: Admin Custom Upload</option>
                </select>
              </div>

              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold">
                  Artwork URL
                </label>
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
                  className="border-border bg-card text-foreground h-9 font-mono text-xs text-[11px]"
                />
              </div>
            </div>

            {/* Visibility / Takedown Toggle */}
            <div className="border-border bg-card/60 flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="text-foreground text-xs font-semibold">Card Visibility Status</div>
                <div className="text-muted-foreground text-[11px]">
                  Hidden cards are retired from packs & marketplace.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditIsRetired(!editIsRetired)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  editIsRetired
                    ? "border border-rose-500/30 bg-rose-500/20 text-rose-500"
                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-500"
                }`}
              >
                {editIsRetired ? "Hidden / Retired" : "Visible"}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isPending}
            className="bg-primary text-primary-foreground font-semibold hover:opacity-90"
          >
            Save Card Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
