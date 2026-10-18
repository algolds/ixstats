"use client";

import { useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SearchField } from "~/components/ui/search-field";
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
import { useDebounce } from "~/hooks/useDebounce";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { MineRow } from "~/lib/cards/hub/mine";
import { vaultNotify } from "~/lib/vault/vault-notifications";

type Duration = "30" | "60";

/** Mine's largest page. */
const PAGE = 120;
/** The longest search Mine's query takes. */
const SEARCH_MAX = 100;

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
  searching: boolean;
  picked: string | null;
  onPick: (ownershipId: string) => void;
}

/** Why no copy is offered: none matches the search, or none can be listed. */
function NoCopies({ searching }: { searching: boolean }) {
  if (searching) return <EmptyState compact title="No cards match this search" />;
  return (
    <EmptyState
      compact
      title="No cards to sell"
      message="Cards already listed or in a trade, and bound cards, cannot be listed."
    />
  );
}

/** The copies the player can list, one row per copy. */
function CopyPicker({ rows, loading, searching, picked, onPick }: CopyPickerProps) {
  if (loading) return <Skeleton className="rounded-row h-40" />;
  if (rows.length === 0) return <NoCopies searching={searching} />;
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
 * The player's copies, most valuable first, searched by title and read a page at a time, so any copy can be listed
 * however many the player holds.
 */
function useSellableCopies(open: boolean, search: string) {
  const searched = useDebounce(search.trim(), 300);
  const mine = api.cards.listMine.useInfiniteQuery(
    { search: searched || undefined, sort: "value", limit: PAGE },
    {
      enabled: open,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      // A new search keeps the copies on screen until its page arrives.
      placeholderData: keepPreviousData,
    }
  );
  const held = mine.data?.pages.flatMap((page) => page.rows) ?? [];
  return { mine, held, searching: searched !== "" };
}

/** The copy a `?sell=` link names, read on its own, so it shows (and a bound one is caught) whichever page holds it. */
function useLinkedCopy(open: boolean, ownershipId: string | null): MineRow | null {
  const linked = api.cards.listMine.useQuery(
    { copyId: ownershipId ?? undefined, sort: "value", limit: 1 },
    { enabled: open && ownershipId !== null }
  );
  return linked.data?.rows[0] ?? null;
}

/** The linked copy leads the pages while nothing is searched, and is not listed twice; a search shows what matches. */
function withLinkedFirst(held: readonly MineRow[], linked: MineRow | null, searching: boolean) {
  if (!linked || searching) return held;
  const id = linked.face.copy?.ownershipId;
  return [linked, ...held.filter((row) => row.face.copy?.ownershipId !== id)];
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
  const [search, setSearch] = useState("");
  const refreshCards = useCardsRefresh();
  const { mine, held, searching } = useSellableCopies(open, search);
  const linked = useLinkedCopy(open, initialOwnershipId);
  const rows = withLinkedFirst(held, linked, searching).filter(
    (row) => !row.isLocked && !row.isBound
  );
  // The sheet never offers a bound copy for sale, but an old or hand-made `?sell=` link can name one.
  const sentBound = linked?.isBound === true;
  // Counts closes, so a listing that lands after the player closed the form does not close it again.
  const closes = useRef(0);
  // The form starts over each time it opens.
  const close = () => {
    closes.current += 1;
    setPicked(initialOwnershipId);
    setStartingPrice("");
    setBuyoutPrice("");
    setDuration("60");
    setSearch("");
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
            <SearchField
              aria-label="Search your cards"
              maxLength={SEARCH_MAX}
              placeholder="Search your cards"
              value={search}
              onValueChange={setSearch}
            />
            {/* A page may hold only copies that cannot be listed, so the next page is offered either way. */}
            {(rows.length > 0 || !mine.hasNextPage) && (
              <CopyPicker
                rows={rows}
                loading={mine.isLoading}
                searching={searching}
                picked={picked}
                onPick={setPicked}
              />
            )}
            {mine.hasNextPage && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={mine.isFetchingNextPage}
                onClick={() => void mine.fetchNextPage()}
              >
                Show more
              </Button>
            )}
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
