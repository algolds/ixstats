"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { Cart, Filter, WarningCircle, Xmark } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  BuyListingDialog,
  type BuyTarget,
} from "~/components/cards/sheet/economy/BuyListingDialog";
import { useDialogFocus } from "~/components/cards/sheet/economy/dialog-focus";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useBrowse, type BrowseInputView, type BrowseItemView } from "~/hooks/cards/useMarketTabs";
import { RARITY_LABEL, RARITY_ORDER } from "~/lib/cards/face/labels";
import type { CardRarity } from "~/lib/cards/face/types";
import { AuctionRow, type AuctionRowData } from "./AuctionRow";
import { ListingRow } from "./ListingRow";

const ANY = "any";
const PAGE = 20;
/** The router's page cap. */
const MAX_PAGE = 100;
type Kind = NonNullable<BrowseInputView["kind"]>;
type Sort = NonNullable<BrowseInputView["sort"]>;

const KINDS: ReadonlyArray<{ value: Kind; label: string }> = [
  { value: "all", label: "All" },
  { value: "listings", label: "Listings" },
  { value: "auctions", label: "Auctions" },
];
const SORTS: ReadonlyArray<{ value: Sort; label: string }> = [
  { value: "ending_soon", label: "Ending soon" },
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Lowest price" },
  { value: "price_high", label: "Highest price" },
];

const sortOf = (value: string): Sort =>
  SORTS.find((sort) => sort.value === value)?.value ?? "ending_soon";
const rarityOf = (value: string): CardRarity | null =>
  RARITY_ORDER.find((rarity) => rarity === value) ?? null;

interface BrowseChoice {
  kind: Kind;
  realmId: string | null;
  rarity: CardRarity | null;
  sort: Sort;
}

const FIRST_CHOICE: BrowseChoice = {
  kind: "all",
  realmId: null,
  rarity: null,
  sort: "ending_soon",
};

/** A Browse auction as the auction row takes it: its price is the current bid, which starts at the starting price. */
function toAuctionRow(item: BrowseItemView): AuctionRowData {
  return {
    id: item.id,
    currentBid: item.price,
    startingPrice: item.price,
    buyoutPrice: item.buyoutPrice,
    endTime: item.endsAt,
    bidCount: item.bidCount,
    face: item.face,
    isMine: item.isMine,
    isFeatured: item.isFeatured,
  };
}

/** What the purchase dialog shows of a listing. Browse names no seller. */
function toBuyTarget(item: BrowseItemView): BuyTarget | null {
  const copy = item.face.copy;
  return copy
    ? {
        id: item.id,
        price: item.price,
        finish: copy.finish,
        serialNumber: copy.serialNumber,
        sellerName: null,
      }
    : null;
}

/** Compact toolbar: kind switcher, a filters popover for realm and rarity, optional card chip, and sort. */
function BrowseToolbar({
  choice,
  forCardId,
  onClearFor,
  onChoose,
}: {
  choice: BrowseChoice;
  forCardId: string | null;
  onClearFor: () => void;
  onChoose: (patch: Partial<BrowseChoice>) => void;
}) {
  const realmSelectId = useId();
  const raritySelectId = useId();
  const shelves = api.cards.exploreShelves.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const realms: ReadonlyArray<{ id: string; name: string }> = shelves.data?.realms ?? [];
  const filterCount = (choice.realmId ? 1 : 0) + (choice.rarity ? 1 : 0);

  return (
    <Card variant="well" padding="sm">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          aria-label="Show"
          options={KINDS}
          value={choice.kind}
          onValueChange={(kind) => onChoose({ kind })}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              aria-label={filterCount > 0 ? `Filters, ${filterCount} on` : "Filters"}
            >
              <Filter aria-hidden />
              Filters
              {filterCount > 0 && (
                <span className="bg-tint-fill text-tint text-caption min-w-5 rounded-full px-1 tabular-nums">
                  {filterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" aria-label="Filters" className="w-72 space-y-4">
            <div className="space-y-2">
              <Label htmlFor={realmSelectId}>Realm</Label>
              <Select
                value={choice.realmId ?? ANY}
                onValueChange={(v) => onChoose({ realmId: v === ANY ? null : v })}
              >
                <SelectTrigger id={realmSelectId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Every realm</SelectItem>
                  {realms.map((realm) => (
                    <SelectItem key={realm.id} value={realm.id}>
                      {realm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={raritySelectId}>Rarity</Label>
              <Select
                value={choice.rarity ?? ANY}
                onValueChange={(v) => onChoose({ rarity: rarityOf(v) })}
              >
                <SelectTrigger id={raritySelectId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Every rarity</SelectItem>
                  {RARITY_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RARITY_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={filterCount === 0}
              onClick={() => onChoose({ realmId: null, rarity: null })}
            >
              Clear filters
            </Button>
          </PopoverContent>
        </Popover>
        {forCardId && (
          <Button variant="secondary" size="sm" onClick={onClearFor}>
            Listings for one card
            <Xmark aria-hidden />
            <span className="sr-only">, show every listing</span>
          </Button>
        )}
        <Select value={choice.sort} onValueChange={(v) => onChoose({ sort: sortOf(v) })}>
          <SelectTrigger
            aria-label="Sort"
            className="text-footnote ml-auto h-(--control-height-sm) w-auto"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

interface BrowseBodyProps {
  query: ReturnType<typeof useBrowse>;
  listRef: RefObject<HTMLUListElement | null>;
  filtered: boolean;
  onClearFilters: () => void;
  onSell: () => void;
  onOpenCard: (cardId: string) => void;
  onShowSelling: () => void;
  onBuy: (item: BrowseItemView) => void;
}

/** The list, or why there is none: loading, failed or empty. */
function BrowseBody({
  query,
  listRef,
  filtered,
  onClearFilters,
  onSell,
  onOpenCard,
  onShowSelling,
  onBuy,
}: BrowseBodyProps) {
  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();
  const items = query.data?.items ?? [];
  if (query.isLoading) return <Skeleton className="rounded-card h-40" />;
  if (query.isError && !query.data) {
    return (
      <Card>
        <EmptyState
          role="alert"
          icon={<WarningCircle />}
          title="The listings did not load"
          message="Try loading the market listings again."
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  if (items.length === 0) {
    if (filtered) {
      return (
        <Card>
          <EmptyState
            icon={<Filter />}
            title="No listings match these filters"
            message="Clear or loosen your filters to see running listings and auctions."
            action={
              <Button variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        </Card>
      );
    }
    return (
      <Card>
        <EmptyState
          icon={<Cart />}
          title="Nothing is listed right now"
          message="Listings and auctions appear here while they run."
          action={
            <Button variant="secondary" onClick={onSell}>
              List a card
            </Button>
          }
        />
      </Card>
    );
  }
  const activeTotal = query.data?.total ?? items.length;
  return (
    <Card content="data" padding="none">
      <div className="border-separator flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="text-subheadline text-label-secondary font-medium">Live floor</span>
        <span className="text-footnote text-label-secondary tabular-nums">
          {activeTotal.toLocaleString()} {activeTotal === 1 ? "active offer" : "active offers"}
        </span>
      </div>
      <ul ref={listRef} tabIndex={-1} aria-label="Listings" className="divide-separator divide-y">
        {items.map((item) =>
          item.kind === "listing" ? (
            <ListingRow
              key={`listing-${item.id}`}
              item={item}
              onOpenCard={onOpenCard}
              onShowSelling={onShowSelling}
              onBuy={onBuy}
            />
          ) : (
            <AuctionRow
              key={`auction-${item.id}`}
              auction={toAuctionRow(item)}
              onOpenCard={onOpenCard}
              onShowSelling={onShowSelling}
              onBid={placeBid}
              onBuyout={executeBuyout}
              busy={isBidding || isBuyingOut}
            />
          )
        )}
      </ul>
    </Card>
  );
}

interface MarketBrowseProps {
  /** `?for=<cardId>` from a card's sheet: only that card's listings and auctions. */
  forCardId: string | null;
  onClearFor: () => void;
  onSell: () => void;
  onOpenCard: (cardId: string) => void;
  onShowSelling: () => void;
}

/** Browse: live fixed-price listings and auctions in one list, featured first. "Ending soon" is a sort. */
export function MarketBrowse({
  forCardId,
  onClearFor,
  onSell,
  onOpenCard,
  onShowSelling,
}: MarketBrowseProps) {
  const [choice, setChoice] = useState(FIRST_CHOICE);
  const [limit, setLimit] = useState(PAGE);
  const [buying, setBuying] = useState<BrowseItemView | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { focus, settle } = useDialogFocus();
  const query = useBrowse({
    kind: choice.kind,
    sort: choice.sort,
    limit,
    offset: 0,
    filters: {
      cardId: forCardId ?? undefined,
      realmId: choice.realmId ?? undefined,
      rarity: choice.rarity ?? undefined,
    },
  });
  const target = buying && toBuyTarget(buying);
  const filtered =
    choice.kind !== "all" ||
    choice.realmId !== null ||
    choice.rarity !== null ||
    forCardId !== null;

  const bought = () => {
    // The bought listing leaves the list, so focus goes to the list rather than the page
    settle(listRef.current);
    setBuying(null);
  };

  const clearAll = () => {
    setChoice((current) => ({ ...current, kind: "all", realmId: null, rarity: null }));
    if (forCardId) onClearFor();
  };

  return (
    <div className="space-y-4">
      <BrowseToolbar
        choice={choice}
        forCardId={forCardId}
        onClearFor={onClearFor}
        onChoose={(patch) => setChoice((current) => ({ ...current, ...patch }))}
      />
      <div aria-busy={query.isFetching}>
        <BrowseBody
          query={query}
          listRef={listRef}
          filtered={filtered}
          onClearFilters={clearAll}
          onSell={onSell}
          onOpenCard={onOpenCard}
          onShowSelling={onShowSelling}
          onBuy={setBuying}
        />
      </div>
      {query.data?.hasMore && limit < MAX_PAGE && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={query.isPlaceholderData}
          onClick={() => setLimit((n) => Math.min(MAX_PAGE, n + PAGE))}
        >
          Show more
        </Button>
      )}
      {buying && target && (
        <BuyListingDialog
          onOpenChange={(open) => !open && setBuying(null)}
          onDone={bought}
          cardId={buying.face.cardId}
          cardTitle={buying.face.title}
          listing={target}
          focus={focus}
        />
      )}
    </div>
  );
}
