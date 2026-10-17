"use client";

import { useState } from "react";
import { Cart } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import { RARITY_LABEL, RARITY_ORDER } from "~/lib/cards/face/labels";
import type { CardRarity } from "~/lib/cards/face/types";
import { AuctionRow } from "./AuctionRow";
import { CreateAuctionModal } from "./CreateAuctionModal";

const ANY = "any";
const PAGE = 20;
/** The router's page cap. */
const MAX_PAGE = 100;
const SORTS = [
  { value: "ending_soon", label: "Ending soon" },
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Lowest price" },
  { value: "price_high", label: "Highest price" },
] as const;
type AuctionSort = (typeof SORTS)[number]["value"];

const sortOf = (value: string): AuctionSort =>
  SORTS.find((sort) => sort.value === value)?.value ?? "ending_soon";
const rarityOf = (value: string): CardRarity | null =>
  RARITY_ORDER.find((rarity) => rarity === value) ?? null;

interface MarketBrowseProps {
  /** `?for=<cardId>` from a card's sheet: only that card's listings. */
  forCardId: string | null;
  onClearFor: () => void;
  onOpenCard: (cardId: string) => void;
}

/** Browse: the live listings. "Ending soon" is a sort, not a list of its own. */
export function MarketBrowse({ forCardId, onClearFor, onOpenCard }: MarketBrowseProps) {
  const [realmId, setRealmId] = useState<string | null>(null);
  const [rarity, setRarity] = useState<CardRarity | null>(null);
  const [sort, setSort] = useState<AuctionSort>("ending_soon");
  const [limit, setLimit] = useState(PAGE);
  const [selling, setSelling] = useState(false);
  const shelves = api.cards.exploreShelves.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const query = api.cardMarket.getActiveAuctions.useQuery({
    cardId: forCardId ?? undefined,
    realmId: realmId ?? undefined,
    rarity: rarity ?? undefined,
    sortBy: sort,
    limit,
  });
  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();
  useAuctionWebSocket({ enabled: true });
  const auctions = query.data?.auctions ?? [];
  const sell = () => setSelling(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={realmId ?? ANY} onValueChange={(v) => setRealmId(v === ANY ? null : v)}>
          <SelectTrigger aria-label="Realm" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Every realm</SelectItem>
            {(shelves.data ?? []).map(({ realm }) => (
              <SelectItem key={realm.id} value={realm.id}>
                {realm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rarity ?? ANY} onValueChange={(v) => setRarity(rarityOf(v))}>
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
        <Select value={sort} onValueChange={(v) => setSort(sortOf(v))}>
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
        <Button size="sm" className="ml-auto" onClick={sell}>
          Sell a card
        </Button>
      </div>
      {forCardId && (
        <p className="text-callout text-label-secondary flex flex-wrap items-center gap-2">
          Listings for one card
          <Button variant="link" size="sm" className="px-0" onClick={onClearFor}>
            Show every listing
          </Button>
        </p>
      )}
      {query.isLoading ? (
        <Skeleton className="rounded-card h-40" />
      ) : auctions.length === 0 ? (
        <EmptyState
          icon={<Cart />}
          title="Nothing is listed right now"
          message="Listings appear here while their auctions run."
          action={
            <Button variant="secondary" onClick={sell}>
              Sell a card
            </Button>
          }
        />
      ) : (
        <Card content="data">
          <ul aria-label="Listings" className="divide-separator divide-y">
            {auctions.map((auction) => (
              <AuctionRow
                key={auction.id}
                auction={auction}
                onOpenCard={onOpenCard}
                onBid={placeBid}
                onBuyout={executeBuyout}
                busy={isBidding || isBuyingOut}
              />
            ))}
          </ul>
        </Card>
      )}
      {query.data?.hasMore && limit < MAX_PAGE && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setLimit((n) => Math.min(MAX_PAGE, n + PAGE))}
        >
          Show more
        </Button>
      )}
      <CreateAuctionModal open={selling} onClose={() => setSelling(false)} />
    </div>
  );
}
