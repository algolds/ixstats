"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { StoreItemCard, type StoreItem } from "../StoreItemCard";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

interface StorePurchaseDialogProps {
  item: StoreItem | null;
  isOpen?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPurchasing: boolean;
}

export function StorePurchaseDialog({
  item,
  onClose,
  onConfirm,
  isPurchasing,
  isOpen = true,
}: StorePurchaseDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-separator bg-surface rounded-sheet shadow-card max-w-sm p-6">
        <DialogHeader>
          <DialogTitle className="text-label text-title-3 text-center">
            Confirm purchase
          </DialogTitle>
          <DialogDescription className="text-label-secondary text-footnote text-center">
            Are you sure you want to purchase{" "}
            <strong className="text-label font-semibold">{item.name}</strong> for{" "}
            <span className="text-yellow inline-flex items-center gap-0.5 font-semibold">
              <IxCreditsSymbol className="h-3 w-3 shrink-0" />
              {item.price}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 flex justify-center">
          <div className="w-full max-w-xs">
            <StoreItemCard item={item} onPurchase={() => {}} isPurchasing={false} isOwned={false} />
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} className="bg-transparent">
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isPurchasing}>
            {isPurchasing ? (
              "Purchasing..."
            ) : (
              <span className="inline-flex items-center gap-1">
                Buy for <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                {item.price}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
