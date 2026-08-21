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

export interface StorePurchaseDialogProps {
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
      <DialogContent className="border-border/50 bg-card/90 max-w-sm rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center text-lg font-black tracking-tight">
            Confirm Purchase
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-center text-xs">
            Are you sure you want to purchase{" "}
            <strong className="text-foreground font-bold">{item.name}</strong> for{" "}
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-500">
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
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-input text-foreground hover:bg-accent bg-transparent text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isPurchasing}
            className="border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white"
          >
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
