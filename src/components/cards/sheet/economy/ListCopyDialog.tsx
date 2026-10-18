"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useEconomyNumbers, type EconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { listingFeeNote, MAX_LISTING_PRICE, saleFee } from "~/lib/cards/market/fees";
import type { DialogFocus } from "./dialog-focus";

export interface CopyDialogProps {
  open: boolean;
  /** Closing without acting: Cancel, Escape or the close button. */
  onOpenChange: (open: boolean) => void;
  /** The action went through; the opener closes the dialog. */
  onDone: () => void;
  cardTitle: string;
  ownershipId: string;
  /** The dialog has no trigger of its own, so its opener says where focus goes (`useDialogFocus`). */
  focus?: DialogFocus;
}

/** A whole-IxC price in range, or null. */
export function parsePrice(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_LISTING_PRICE ? value : null;
}

/** What the seller receives: the price less the market fee, which a sale at or under the threshold does not pay. */
function receivedNote(price: number, numbers: EconomyNumbers): string {
  const fee = saleFee(price, {
    ratePct: numbers.feeRatePct,
    threshold: numbers.economy.saleFeeThreshold,
  });
  return fee > 0
    ? `You receive ${(price - fee).toLocaleString()} IxC after the market fee.`
    : `You receive ${price.toLocaleString()} IxC.`;
}

function FeeNotes({
  numbers,
  featured,
  price,
}: {
  numbers: EconomyNumbers;
  featured: boolean;
  price: number | null;
}) {
  const { economy } = numbers;
  const fee = featured ? economy.listingFeeFeatured : economy.listingFee;
  return (
    <div className="text-footnote text-label-secondary space-y-1">
      <p>{`${listingFeeNote(fee, economy.listingRefundPct)} It stays up for ${economy.listingDays} days.`}</p>
      {price !== null && <p>{receivedNote(price, numbers)}</p>}
    </div>
  );
}

/** List one copy at a fixed price, with the listing fee, the refund and what the seller receives spelled out. */
export function ListCopyDialog({
  suggestedPrice,
  ...props
}: CopyDialogProps & { suggestedPrice: number }) {
  const { data: numbers } = useEconomyNumbers();
  const { list } = useCopyActions();
  const [raw, setRaw] = useState(String(Math.max(1, Math.round(suggestedPrice))));
  const [featured, setFeatured] = useState(false);
  const price = parsePrice(raw);
  const id = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (price === null) return;
    list.mutate(
      { ownershipId: props.ownershipId, price, isFeatured: featured },
      { onSuccess: props.onDone }
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md" {...props.focus}>
        <DialogHeader>
          <DialogTitle>List {props.cardTitle}</DialogTitle>
          <DialogDescription>Sell this copy at a fixed price.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-price`}>Price in IxC</Label>
            <Input
              id={`${id}-price`}
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={`${id}-hint`}
              aria-invalid={price === null}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
            />
            <p id={`${id}-hint`} className="text-footnote text-label-secondary">
              {`A whole number of IxC, from 1 to ${MAX_LISTING_PRICE.toLocaleString("en-US")}.`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-featured`}>Feature it at the top of Browse</Label>
            <Switch id={`${id}-featured`} checked={featured} onCheckedChange={setFeatured} />
          </div>
          {numbers && <FeeNotes numbers={numbers} featured={featured} price={price} />}
          <DialogFooter>
            <Button type="submit" disabled={price === null || list.isPending}>
              {price === null ? "Enter a price" : `List for ${price.toLocaleString()} IxC`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
