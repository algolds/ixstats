"use client";

import React from "react";
import { Package } from "iconoir-react";
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
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { TYPE_LABEL } from "~/lib/cards/face/labels";
import type { CardType } from "~/lib/cards/face/types";
import { PackOdds } from "./PackOdds";

export interface PackItem {
  id: string;
  name: string;
  description: string | null;
  artwork: string | null;
  packType: string;
  priceCredits: number;
  cardCount: number;
  guaranteedRarity: string | null;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
  season?: number | null;
  cardType?: CardType | null;
}

interface PackHolographicCardProps {
  pack: PackItem;
  onPurchase?: (pack: PackItem) => void;
  isPurchasing?: boolean;
  disabled?: boolean;
}

export function PackHolographicCard({
  pack,
  onPurchase,
  isPurchasing = false,
  disabled = false,
}: PackHolographicCardProps) {
  return (
    <CutoutCard
      data-content="collectible"
      data-slot="pack-store-card"
      className="flex h-full w-full flex-col select-none"
    >
      <CutoutCardHeader
        as="h3"
        icon={<Package />}
        trailing={<Badge variant="secondary">{pack.cardCount.toLocaleString()} cards</Badge>}
      >
        {pack.name}
      </CutoutCardHeader>

      <CutoutCardContent className="flex flex-1 flex-col justify-between gap-4 p-4 pt-3 md:p-5 md:pt-3">
        <div className="space-y-3">
          <div
            data-slot="pack-stage"
            className="pack-stage facet-recess rounded-row flex items-center justify-center py-5"
          >
            <div className="rounded-row shadow-card relative aspect-[3/4.2] w-32 overflow-hidden">
              <PackHolographicCover
                packType={pack.packType}
                guaranteedRarity={pack.guaranteedRarity}
                packName={pack.name}
                packArtwork={pack.artwork || undefined}
                size="md"
                className="h-full w-full"
              />
            </div>
          </div>

          <p className="text-label-secondary text-footnote line-clamp-2 leading-snug">
            {pack.description || `${pack.cardCount.toLocaleString()} cards included in each pack.`}
          </p>
        </div>

        <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-subhead text-label inline-flex items-center gap-1 font-semibold tabular-nums">
            <IxCreditsSymbol decorative className="size-3.5 shrink-0" />
            {pack.priceCredits.toLocaleString()} IxC
          </span>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  Drop odds
                </Button>
              </DialogTrigger>
              <DialogContent data-app="vault" className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>{pack.name}</DialogTitle>
                  <DialogDescription>
                    {pack.description || `${pack.cardCount.toLocaleString()} cards included.`}
                  </DialogDescription>
                </DialogHeader>
                <div className="border-separator text-footnote space-y-2 border-t pt-3 tabular-nums">
                  <div className="flex justify-between gap-3">
                    <span className="text-label-secondary">Price</span>
                    <span className="text-label font-medium">
                      {pack.priceCredits.toLocaleString()} IxC
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-label-secondary">Cards included</span>
                    <span className="text-label font-medium">
                      {pack.cardCount.toLocaleString()} cards
                    </span>
                  </div>
                  {pack.season && (
                    <div className="flex justify-between gap-3">
                      <span className="text-label-secondary">Season</span>
                      <span className="text-label font-medium">Season {pack.season}</span>
                    </div>
                  )}
                  {pack.cardType && (
                    <div className="flex justify-between gap-3">
                      <span className="text-label-secondary">Card type</span>
                      <span className="text-label font-medium">{TYPE_LABEL[pack.cardType]}</span>
                    </div>
                  )}
                  <div className="border-separator border-t pt-3">
                    <PackOdds pack={pack} />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              size="sm"
              disabled={isPurchasing || disabled}
              onClick={() => onPurchase?.(pack)}
            >
              {isPurchasing ? "Buying..." : "Buy"}
            </Button>
          </div>
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
