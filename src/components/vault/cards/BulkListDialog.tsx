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
import type { DialogFocus } from "~/components/cards/sheet/economy/dialog-focus";
import { parsePrice } from "~/components/cards/sheet/economy/ListCopyDialog";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers, type EconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { listingRefund, MAX_LISTING_PRICE } from "~/lib/cards/market/fees";
import { vaultNotify } from "~/lib/vault/vault-notifications";

export interface BulkListCopy {
  ownershipId: string;
  title: string;
  value: number;
}

interface ListResult {
  ownershipId: string;
  error: string | null;
}

interface BulkListDialogProps {
  open: boolean;
  /** Closing without listing: Cancel, Escape or the close button. */
  onOpenChange: (open: boolean) => void;
  copies: BulkListCopy[];
  /** Every copy is listed; the opener closes the dialog. */
  onDone: () => void;
  /** The dialog has no trigger of its own, so its opener says where focus goes (`useDialogFocus`). */
  focus?: DialogFocus;
}

export const copiesLabel = (n: number) => `${n} ${n === 1 ? "copy" : "copies"}`;

/** A starting price: the copy's value in whole IxC, within the market's range (a retired copy is worth 0). */
const startingPrice = (value: number) =>
  String(Math.min(MAX_LISTING_PRICE, Math.max(1, Math.round(value))));

function FeeNotes({ count, numbers }: { count: number; numbers: EconomyNumbers }) {
  const { listingFee, listingRefundPct, listingDays } = numbers.economy;
  const refund = listingRefund(listingFee, listingRefundPct);
  const total = listingFee * count;
  return (
    <div className="text-footnote text-label-secondary space-y-1">
      <p>
        {total > 0
          ? `Listing ${copiesLabel(count)} costs ${total.toLocaleString()} IxC.`
          : "Listing is free."}
      </p>
      <p>
        {refund > 0
          ? `Each listing stays up for ${listingDays} days, and ${refund} IxC of its fee comes back if the copy does not sell.`
          : `Each listing stays up for ${listingDays} days.`}
      </p>
    </div>
  );
}

/**
 * List several copies at once, each at its own price (each one is its own listing). A copy the market refuses stays in
 * the form with the reason, so listing again sends only the ones still to go.
 */
export function BulkListDialog({ open, onOpenChange, copies, onDone, focus }: BulkListDialogProps) {
  const { data: numbers } = useEconomyNumbers();
  const { listMany } = useCopyActions();
  const id = useId();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(copies.map((c) => [c.ownershipId, startingPrice(c.value)]))
  );
  const [refused, setRefused] = useState<{ tried: number; errors: Map<string, string> } | null>(
    null
  );
  const shown = refused ? copies.filter((c) => refused.errors.has(c.ownershipId)) : copies;
  const items = shown.flatMap((c) => {
    const price = parsePrice(prices[c.ownershipId] ?? "");
    return price === null ? [] : [{ ownershipId: c.ownershipId, price }];
  });
  const ready = numbers !== undefined && items.length === shown.length;

  const settle = (results: ListResult[]) => {
    const errors = new Map(
      results.flatMap((r) => (r.error === null ? [] : [[r.ownershipId, r.error] as const]))
    );
    const listed = results.length - errors.size;
    if (listed > 0) {
      vaultNotify.success(
        `${copiesLabel(listed)} ${listed === 1 ? "is" : "are"} on the market.`,
        "Listed"
      );
    }
    if (errors.size === 0) onDone();
    else setRefused({ tried: results.length, errors });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready) listMany.mutate({ items, isFeatured: false }, { onSuccess: settle });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" {...focus}>
        <DialogHeader>
          <DialogTitle>List {copiesLabel(shown.length)}</DialogTitle>
          <DialogDescription>Each copy becomes its own fixed-price listing.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {refused && (
            <p role="alert" className="text-callout text-destructive">
              {`${refused.errors.size} of ${copiesLabel(refused.tried)} could not be listed.`}
            </p>
          )}
          <ul className="space-y-3">
            {shown.map((c) => (
              <PriceRow
                key={c.ownershipId}
                id={`${id}-${c.ownershipId}`}
                hintId={`${id}-hint`}
                copy={c}
                raw={prices[c.ownershipId] ?? ""}
                error={refused?.errors.get(c.ownershipId) ?? null}
                onChange={(raw) => setPrices((p) => ({ ...p, [c.ownershipId]: raw }))}
              />
            ))}
          </ul>
          <p id={`${id}-hint`} className="text-footnote text-label-secondary">
            {`Whole IxC, from 1 to ${MAX_LISTING_PRICE.toLocaleString("en-US")}.`}
          </p>
          {numbers && <FeeNotes count={shown.length} numbers={numbers} />}
          <DialogFooter>
            <Button type="submit" disabled={!ready || listMany.isPending}>
              List {copiesLabel(shown.length)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PriceRowProps {
  id: string;
  hintId: string;
  copy: BulkListCopy;
  raw: string;
  error: string | null;
  onChange: (raw: string) => void;
}

function PriceRow({ id, hintId, copy, raw, error, onChange }: PriceRowProps) {
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="min-w-0 truncate">
          <span className="sr-only">Price for </span>
          {copy.title}
          <span className="sr-only"> in IxC</span>
        </Label>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          className="w-28 tabular-nums"
          aria-describedby={error ? `${id}-error ${hintId}` : hintId}
          aria-invalid={parsePrice(raw) === null}
          value={raw}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-footnote text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
