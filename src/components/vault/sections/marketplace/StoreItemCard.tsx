"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CutoutCard, CutoutCardContent, CutoutCardHeader } from "~/components/ui/cutout-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import type { PublicCosmetics } from "~/lib/vault/public-cosmetics";
import type { PackItem } from "./store/PackHolographicCard";
import { CosmeticStorePreview } from "./store/CosmeticStorePreview";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ComponentType<{ className?: string }>;
  quality: string;
  badgeText: string;
  category?: string;
  /** Resolved cosmetic treatment shown on the live store preview stage. */
  cosmetics?: PublicCosmetics | null;
  /** Populated when confirming a card pack purchase through `StorePurchaseDialog`. */
  pack?: PackItem;
}

interface StoreItemCardProps {
  item: StoreItem;
  onPurchase: (item: StoreItem) => void;
  isPurchasing: boolean;
  isOwned: boolean;
  purchaseCount?: number;
  maxPurchases?: number;
  isPreviewing?: boolean;
  onPreview?: (item: StoreItem) => void;
}

function resolveCategoryLabel(item: StoreItem): string {
  if (item.cosmetics?.neonFrame.enabled) return "Frame";
  if (item.cosmetics?.avatarGlow.enabled) return "Avatar glow";
  if (item.cosmetics?.chatBadge.enabled) return "Name badge";
  return item.badgeText || "Cosmetic";
}

/** Synthesises a live treatment preview for custom cosmetic rows whose DB effects have no preset entry. */
function resolveLiveCosmetics(item: StoreItem): PublicCosmetics {
  if (item.cosmetics) return item.cosmetics;
  const probe = `${item.id} ${item.name} ${item.badgeText}`.toLowerCase();
  const isFrame = probe.includes("frame") || probe.includes("border") || probe.includes("banner");
  const isGlow = probe.includes("glow") || probe.includes("aura") || probe.includes("theme");
  return {
    equipped: [item.id],
    avatarGlow: {
      enabled: isGlow,
      color: "var(--tint)",
      intensity: "15px",
    },
    chatBadge: {
      enabled: !isFrame && !isGlow,
      icon: "Crown",
      color: "var(--tint)",
    },
    neonFrame: {
      enabled: isFrame,
      color: "var(--color-cyan)",
      style: "pulse",
    },
  };
}

export function StoreItemCard({
  item,
  onPurchase,
  isPurchasing,
  isOwned,
  isPreviewing = false,
  onPreview,
}: StoreItemCardProps) {
  const categoryLabel = resolveCategoryLabel(item);
  const liveCosmetics = resolveLiveCosmetics(item);

  return (
    <CutoutCard
      data-content="collectible"
      data-slot="store-item-card"
      className={cn("flex h-full w-full flex-col select-none", isPreviewing && "ring-tint ring-2")}
    >
      <CutoutCardHeader as="h3" trailing={<Badge variant="secondary">{categoryLabel}</Badge>}>
        {item.name}
      </CutoutCardHeader>

      <CutoutCardContent className="flex flex-1 flex-col justify-between gap-4 p-4 pt-3 md:p-5 md:pt-3">
        <div className="space-y-3">
          <div
            data-slot="cosmetic-preview-well"
            className="facet-recess rounded-row flex min-h-28 items-center justify-center p-4"
          >
            <CosmeticStorePreview cosmetics={liveCosmetics} />
          </div>

          <p className="text-label-secondary text-footnote line-clamp-2 leading-snug">
            {item.description}
          </p>
        </div>

        <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-subhead text-label inline-flex items-center gap-1 font-semibold tabular-nums">
            <IxCreditsSymbol decorative className="size-3.5 shrink-0" />
            {item.price.toLocaleString()} IxC
          </span>

          <div className="flex items-center gap-2">
            {onPreview ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onPreview(item)}>
                {isPreviewing ? "Previewing" : "Preview"}
              </Button>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="secondary" size="sm">
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent data-app="vault" className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{item.name}</DialogTitle>
                    <DialogDescription>{item.description}</DialogDescription>
                  </DialogHeader>
                  <div className="facet-recess rounded-row flex min-h-36 items-center justify-center p-6">
                    <CosmeticStorePreview cosmetics={liveCosmetics} />
                  </div>
                  <p className="text-footnote text-label-secondary">
                    Equip purchased cosmetics anytime from Settings under Cosmetics.
                  </p>
                </DialogContent>
              </Dialog>
            )}

            {isOwned ? (
              <Badge variant="success">Owned</Badge>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isPurchasing}
                onClick={() => onPurchase(item)}
                className={cn(isPurchasing && "cursor-wait")}
              >
                {isPurchasing ? "Buying..." : "Buy"}
              </Button>
            )}
          </div>
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
