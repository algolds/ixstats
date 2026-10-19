"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Signal } from "~/components/ui/signal";
import { useMarketActions } from "~/hooks/cards/useMarketActions";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { SheetListing } from "~/lib/cards/hub/sheet";
import { buyFailureMessage, listingGone, type BuyFailure } from "~/lib/cards/market/buy-failure";
import type { DialogFocus } from "./dialog-focus";

interface BuyListingDialogProps {
  /** Closing without buying: Not now, Escape. */
  onOpenChange: (open: boolean) => void;
  /** The purchase went through; the opener closes the dialog. */
  onDone: () => void;
  cardId: string;
  cardTitle: string;
  listing: SheetListing;
  /** The dialog has no trigger of its own, so its opener says where focus goes (`useDialogFocus`). */
  focus?: DialogFocus;
}

/**
 * Confirm buying another player's fixed-price listing; the copy moves at once. It mounts only while open and stays
 * open until the purchase goes through, saying why one did not: a race to try again, or a listing that has gone.
 */
export function BuyListingDialog({
  onOpenChange,
  onDone,
  cardId,
  cardTitle,
  listing,
  focus,
}: BuyListingDialogProps) {
  const { buy } = useMarketActions(cardId);
  const [failure, setFailure] = useState<BuyFailure | null>(null);
  // A listing that has gone has nothing left to buy
  const gone = failure !== null && listingGone(failure);
  const copy = `${FINISH_LABEL[listing.finish]} #${listing.serialNumber}`;

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent {...focus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Buy ${cardTitle} for ${listing.price.toLocaleString()} IxC?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {`${copy} from ${listing.sellerName ?? "a player"}. The copy moves to your collection straight away.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure && (
          <Signal tone="destructive" title="Not bought">
            {buyFailureMessage(failure)}
          </Signal>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction
            disabled={buy.isPending || gone}
            onClick={(event) => {
              event.preventDefault();
              setFailure(null);
              buy.mutate({ listingId: listing.id }, { onSuccess: onDone, onError: setFailure });
            }}
          >
            Buy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
