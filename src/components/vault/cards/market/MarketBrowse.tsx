"use client";

import { useRef, useState, type RefObject } from "react";
import { Cart } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
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
import { CreateAuctionModal } from "./CreateAuctionModal";
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

/** The kind, realm, rarity and sort controls, and Sell. */
function BrowseToolbar({
  choice,
  onChoose,
  onSell,
}: {
  choice: BrowseChoice;
  onChoose: (patch: Partial<BrowseChoice>) => void;
  onSell: () => void;
}) {
  const shelves = api.cards.exploreShelves.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  // Every public realm with cards, as Explore's realm filter lists them, not only the realms it shelves.
  const realms: ReadonlyArray<{ id: string; name: string }> = shelves.data?.realms ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        size="sm"
        aria-label="Show"
        options={KINDS}
        value={choice.kind}
        onValueChange={(kind) => onChoose({ kind })}
      />
      <Select
        value={choice.realmId ?? ANY}
        onValueChange={(v) => onChoose({ realmId: v === ANY ? null : v })}
      >
        <SelectTrigger aria-label="Realm" className="w-auto">
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
      <Select value={choice.rarity ?? ANY} onValueChange={(v) => onChoose({ rarity: rarityOf(v) })}>
        <SelectTrigger aria-label="Rarity" className="w-auto">
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
      <Select value={choice.sort} onValueChange={(v) => onChoose({ sort: sortOf(v) })}>
        <SelectTrigger aria-label="Sort" className="w-auto">
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
      <Button size="sm" className="ml-auto" onClick={onSell}>
        Sell a card
      </Button>
    </div>
  );
}

interface BrowseBodyProps {
  query: ReturnType<typeof useBrowse>;
  listRef: RefObject<HTMLUListElement | null>;
  onSell: () => void;
  onOpenCard: (cardId: string) => void;
  onShowSelling: () => void;
  onBuy: (item: BrowseItemView) => void;
}

/** The list, or why there is none: loading, failed or empty. */
function BrowseBody({ query, listRef, onSell, onOpenCard, onShowSelling, onBuy }: BrowseBodyProps) {
  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();
  const items = query.data?.items ?? [];
  if (query.isLoading) return <Skeleton className="rounded-card h-40" />;
  if (query.isError && !query.data) {
    return (
      <EmptyState
        role="alert"
        title="The listings did not load"
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Cart />}
        title="Nothing is listed right now"
        message="Listings and auctions appear here while they run."
        action={
          <Button variant="secondary" onClick={onSell}>
            Sell a card
          </Button>
        }
      />
    );
  }
  return (
    <Card content="data">
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
  onOpenCard: (cardId: string) => void;
  onShowSelling: () => void;
}

/** Browse: live fixed-price listings and auctions in one list, featured first. "Ending soon" is a sort. */
export function MarketBrowse({
  forCardId,
  onClearFor,
  onOpenCard,
  onShowSelling,
}: MarketBrowseProps) {
  const [choice, setChoice] = useState(FIRST_CHOICE);
  const [limit, setLimit] = useState(PAGE);
  const [selling, setSelling] = useState(false);
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
  const sell = () => setSelling(true);
  const bought = () => {
    // The bought listing leaves the list, so focus goes to the list rather than the page
    settle(listRef.current);
    setBuying(null);
  };

  return (
    <div className="space-y-4">
      <BrowseToolbar
        choice={choice}
        onChoose={(patch) => setChoice((current) => ({ ...current, ...patch }))}
        onSell={sell}
      />
      {forCardId && (
        <p className="text-callout text-label-secondary flex flex-wrap items-center gap-2">
          Listings for one card
          <Button variant="link" size="sm" className="px-0" onClick={onClearFor}>
            Show every listing
          </Button>
        </p>
      )}
      <div aria-busy={query.isFetching}>
        <BrowseBody
          query={query}
          listRef={listRef}
          onSell={sell}
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
      <CreateAuctionModal open={selling} onClose={() => setSelling(false)} />
    </div>
  );
}
