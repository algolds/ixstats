"use client";

import { useRef, useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { CardFace } from "~/components/cards/face/CardFace";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { MineRow } from "~/lib/cards/hub/mine";
import { vaultNotify } from "~/lib/vault/vault-notifications";

type Duration = "30" | "60";

const DURATIONS: ReadonlyArray<{ value: Duration; label: string }> = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
];

interface CreateAuctionModalProps {
  open: boolean;
  onClose: () => void;
  /** A copy picked already (from the sheet's "Sell at auction"). */
  initialOwnershipId?: string | null;
}

/** A whole number of IxC typed into a field, or null. */
const credits = (text: string) => {
  const value = Number(text);
  return text !== "" && Number.isInteger(value) ? value : null;
};

interface CopyPickerProps {
  rows: readonly MineRow[];
  loading: boolean;
  picked: string | null;
  onPick: (ownershipId: string) => void;
}

/** The copies the player can list, one row per copy. */
function CopyPicker({ rows, loading, picked, onPick }: CopyPickerProps) {
  if (loading) return <Skeleton className="rounded-row h-40" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title="No cards to sell"
        message="Cards already listed or in a trade, and bound cards, cannot be listed."
      />
    );
  }
  return (
    <ul aria-label="Your cards" className="max-h-64 space-y-1 overflow-y-auto">
      {rows.map(({ face }) => {
        const copy = face.copy;
        if (!copy) return null;
        const chosen = picked === copy.ownershipId;
        return (
          <li key={copy.ownershipId}>
            <Button
              variant={chosen ? "secondary" : "ghost"}
              aria-pressed={chosen}
              className="h-auto w-full justify-start gap-3 py-2"
              onClick={() => onPick(copy.ownershipId)}
            >
              {/* The title and serial name the copy; the face would say the title again. */}
              <span aria-hidden="true" className="shrink-0">
                <CardFace face={face} size="S" className="w-16" />
              </span>
              <span className="min-w-0 truncate text-left">
                {face.title}
                <span className="text-footnote text-label-secondary block tabular-nums">
                  #{copy.serialNumber} · {FINISH_LABEL[copy.finish]}
                </span>
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Lists one copy at auction. It picks copies, not cards: two copies of one card are two rows. A copy already in a
 * listing or a trade is left out, and so is a bound copy (trophies, achievement rewards), which the server refuses
 * anyway. Phase 4 adds longer durations.
 */
export function CreateAuctionModal({
  open,
  onClose,
  initialOwnershipId = null,
}: CreateAuctionModalProps) {
  const [picked, setPicked] = useState<string | null>(initialOwnershipId);
  const [startingPrice, setStartingPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [duration, setDuration] = useState<Duration>("60");
  const refreshCards = useCardsRefresh();
  const mine = api.cards.listMine.useQuery({ sort: "value", limit: 120 }, { enabled: open });
  const held = mine.data?.rows ?? [];
  const rows = held.filter((row) => !row.isLocked && !row.isBound);
  // The sheet never offers a bound copy for sale, but an old or hand-made `?sell=` link can name one.
  const sentBound = held.some(
    (row) => row.isBound && row.face.copy?.ownershipId === initialOwnershipId
  );
  // Counts closes, so a listing that lands after the player closed the form does not close it again.
  const closes = useRef(0);
  // The form starts over each time it opens.
  const close = () => {
    closes.current += 1;
    setPicked(initialOwnershipId);
    setStartingPrice("");
    setBuyoutPrice("");
    setDuration("60");
    onClose();
  };
  const create = api.cardMarket.createAuction.useMutation({
    onSuccess: (result) => {
      vaultNotify.success(result.message);
      // The listed copy is locked: Mine, the sheet and the Market show it listed.
      refreshCards();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  const start = credits(startingPrice);
  const buyout = buyoutPrice === "" ? undefined : credits(buyoutPrice);
  const priced = start !== null && start >= 1 && buyout !== null;

  const submit = () => {
    if (!picked || start === null || start < 1 || buyout === null) return;
    if (buyout !== undefined && buyout <= start) {
      vaultNotify.error("The buy-now price must be above the starting price");
      return;
    }
    const opened = closes.current;
    create.mutate(
      { cardId: picked, startingPrice: start, buyoutPrice: buyout, duration },
      {
        onSuccess: () => {
          if (opened === closes.current) close();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell at auction</DialogTitle>
          <DialogDescription>
            Listing costs 5 IxC, and half of it comes back if the card does not sell.
          </DialogDescription>
        </DialogHeader>
        {sentBound ? (
          <EmptyState
            compact
            title="Bound cards can't be sold"
            message="Trophies and achievement rewards stay with the player who earned them."
          />
        ) : (
          <>
            <CopyPicker rows={rows} loading={mine.isLoading} picked={picked} onPick={setPicked} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="auction-start">Starting price (IxC)</Label>
                <Input
                  id="auction-start"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={startingPrice}
                  onChange={(event) => setStartingPrice(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="auction-buyout">Buy-now price (IxC), optional</Label>
                <Input
                  id="auction-buyout"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  step={1}
                  value={buyoutPrice}
                  onChange={(event) => setBuyoutPrice(event.target.value)}
                />
              </div>
            </div>
            <SegmentedControl
              aria-label="Duration"
              value={duration}
              onValueChange={setDuration}
              options={DURATIONS}
            />
            <DialogFooter>
              <Button disabled={!picked || !priced || create.isPending} onClick={submit}>
                List it
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
