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
  isOpen,
}: StorePurchaseDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-sm p-5 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-500">
            Confirm Purchase
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Are you sure you want to purchase{" "}
            <strong className="text-foreground font-bold">{item.name}</strong> for{" "}
            <strong className="font-bold text-amber-500">{item.price} IxCredits</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 flex justify-center">
          <div className="w-full max-w-[260px]">
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
            {isPurchasing ? "Purchasing..." : `Buy for ${item.price} IxC`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
