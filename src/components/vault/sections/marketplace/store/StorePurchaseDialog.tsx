"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import { cn } from "~/lib/utils";
import type { StoreItem } from "../StoreItemCard";
import { CosmeticStorePreview } from "./CosmeticStorePreview";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

interface StorePurchaseDialogProps {
  item: StoreItem | null;
  isOpen?: boolean;
  currentBalance?: number;
  onClose: () => void;
  onConfirm: () => void;
  isPurchasing: boolean;
}

export function StorePurchaseDialog({
  item,
  currentBalance,
  onClose,
  onConfirm,
  isPurchasing,
  isOpen = true,
}: StorePurchaseDialogProps) {
  if (!item) return null;

  const Icon = item.icon;
  const balanceAfter = currentBalance !== undefined ? currentBalance - item.price : undefined;
  const insufficient = balanceAfter !== undefined && balanceAfter < 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-app="vault" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm purchase</DialogTitle>
          <DialogDescription>Review this item before adding it to your Vault.</DialogDescription>
        </DialogHeader>

        <div
          data-slot="purchase-preview-well"
          className="bg-surface-secondary border-separator rounded-row flex items-center gap-4 border p-4"
        >
          {item.pack ? (
            <div className="facet-recess rounded-row shrink-0 p-1.5">
              <div className="rounded-control-sm relative aspect-[3/4.2] w-12 overflow-hidden">
                <PackHolographicCover
                  packType={item.pack.packType}
                  guaranteedRarity={item.pack.guaranteedRarity}
                  packName={item.pack.name}
                  packArtwork={item.pack.artwork ?? undefined}
                  size="sm"
                  className="h-full w-full"
                />
              </div>
            </div>
          ) : item.cosmetics ? (
            <div className="shrink-0">
              <CosmeticStorePreview cosmetics={item.cosmetics} />
            </div>
          ) : (
            <div className="bg-surface border-separator rounded-row flex size-12 shrink-0 items-center justify-center border">
              <Icon className="text-tint size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-headline text-label">{item.name}</span>
              <Badge variant="secondary">{item.badgeText}</Badge>
            </div>
            <p className="text-footnote text-label-secondary">{item.description}</p>
          </div>
        </div>

        <div
          data-slot="purchase-balance-breakdown"
          className="bg-surface-secondary border-separator rounded-row text-footnote space-y-2 border p-4 tabular-nums"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-label-secondary">Current balance</span>
            <span className="text-label inline-flex items-center gap-1 font-medium">
              {currentBalance !== undefined ? (
                <>
                  <IxCreditsSymbol decorative className="size-3 shrink-0" />
                  {currentBalance.toLocaleString()}
                </>
              ) : (
                <span aria-label="Unavailable">–</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-label-secondary">Price</span>
            <span className="text-label inline-flex items-center gap-1 font-medium">
              -<IxCreditsSymbol decorative className="size-3 shrink-0" />
              {item.price.toLocaleString()}
            </span>
          </div>

          <div className="border-separator flex items-center justify-between gap-3 border-t pt-2">
            <span className="text-label-secondary">Balance after purchase</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                insufficient ? "text-destructive" : "text-label"
              )}
            >
              {balanceAfter !== undefined ? (
                <>
                  <IxCreditsSymbol decorative className="size-3 shrink-0" />
                  {balanceAfter.toLocaleString()}
                </>
              ) : (
                <span aria-label="Unavailable">–</span>
              )}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isPurchasing || insufficient}
          >
            {isPurchasing ? (
              "Buying..."
            ) : (
              <span className="inline-flex items-center gap-1 tabular-nums">
                Buy for <IxCreditsSymbol decorative className="size-3 shrink-0" />
                {item.price.toLocaleString()} IxC
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
