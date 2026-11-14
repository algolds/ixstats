"use client";

import { Cart, Shop, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";
import type { CardFaceData } from "~/lib/cards/face/types";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import {
  BidForm,
  bidCountLabel,
  type AuctionRowData,
  type BidActions,
  type BidTarget,
} from "./AuctionRow";
import { MyListings } from "./MyListings";

interface MarketSellingProps {
  onSell: () => void;
  onOpenCard: (cardId: string) => void;
}

/** A listing or a bid's card: its face, which opens the sheet, and its title. */
function ListingCard({
  face,
  onOpenCard,
}: {
  face: CardFaceData | null;
  onOpenCard: (cardId: string) => void;
}) {
  return (
    <>
      {face && (
        <CardFace face={face} size="S" className="w-20" onOpen={() => onOpenCard(face.cardId)} />
      )}
      <p className="text-callout min-w-0 flex-1 truncate">{face?.title ?? "A card"}</p>
    </>
  );
}

type OwnListingData = Pick<
  AuctionRowData,
  "id" | "currentBid" | "startingPrice" | "bidCount" | "endTime" | "face"
>;

/** One of the player's auctions. An auction with bids cannot be cancelled, and says so where Cancel is. */
function OwnListing({
  auction,
  onOpenCard,
  onCancel,
  cancelling,
}: {
  auction: OwnListingData;
  onOpenCard: (cardId: string) => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const hasBids = auction.bidCount > 0;
  const reasonId = `cancel-reason-${auction.id}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ListingCard face={auction.face} onOpenCard={onOpenCard} />
      <div className="space-y-1">
        <p className="text-footnote text-label-secondary tabular-nums">
          {(auction.currentBid || auction.startingPrice).toLocaleString()} IxC ·{" "}
          {bidCountLabel(auction.bidCount)} · {timeLeftPhrase(auction.endTime)}
        </p>
        {hasBids && (
          <p id={reasonId} className="text-footnote text-label-secondary">
            Has bids, so it cannot be cancelled
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={hasBids || cancelling}
        aria-describedby={hasBids ? reasonId : undefined}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </li>
  );
}

type BidData = BidTarget & Pick<AuctionRowData, "endTime" | "face"> & { winning: boolean };

/** A running auction the player bid on: winning, or outbid, with the form to raise their bid. */
function BidRow({
  auction,
  onOpenCard,
  ...bidding
}: BidActions & { auction: BidData; onOpenCard: (cardId: string) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ListingCard face={auction.face} onOpenCard={onOpenCard} />
      <div className="space-y-1">
        <Badge variant={auction.winning ? "success" : "warning"}>
          {auction.winning ? "Winning" : "Outbid"}
        </Badge>
        <p className="text-footnote text-label-secondary tabular-nums">
          {auction.currentBid.toLocaleString()} IxC · {timeLeftPhrase(auction.endTime)}
        </p>
      </div>
      {!auction.winning && <BidForm auction={auction} verb="Raise bid to" {...bidding} />}
    </li>
  );
}

/** Selling: the player's fixed-price listings, then their auctions, then the auctions they bid on. */
export function MarketSelling({ onSell, onOpenCard }: MarketSellingProps) {
  const refreshCards = useCardsRefresh();
  const listings = api.cardMarket.getMyActiveAuctions.useQuery();
  const bids = api.cardMarket.getMyActiveBids.useQuery();
  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();
  const cancel = api.cardMarket.cancelAuction.useMutation({
    onSuccess: (result) => {
      vaultNotify.success(result.message);
      // The copy leaves the listing, so it is free to sell, trade or show again.
      refreshCards();
    },
    onError: (error) => vaultNotify.error(error.message),
  });
  const mine = listings.data?.auctions ?? [];
  const bidding = bids.data?.auctions ?? [];

  return (
    <div className="space-y-8">
      <MyListings />
      <section aria-labelledby="selling-auctions" className="space-y-3">
        <h3 id="selling-auctions" className="text-headline">
          Your auctions
        </h3>
        {listings.isLoading ? (
          <Skeleton className="rounded-card h-24" />
        ) : listings.isError && !listings.data ? (
          <Card>
            <EmptyState
              compact
              role="alert"
              icon={<WarningCircle />}
              title="Your auctions did not load"
              message="Try loading your running auctions again."
              action={
                <Button variant="secondary" onClick={() => void listings.refetch()}>
                  Try again
                </Button>
              }
            />
          </Card>
        ) : mine.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={<Shop />}
              title="You have no auctions running"
              message="Sell a card at auction, or from its sheet."
              action={
                <Button variant="secondary" size="sm" onClick={onSell}>
                  Sell a card
                </Button>
              }
            />
          </Card>
        ) : (
          <Card content="data">
            <ul className="divide-separator divide-y">
              {mine.map((auction) => (
                <OwnListing
                  key={auction.id}
                  auction={auction}
                  onOpenCard={onOpenCard}
                  onCancel={() => cancel.mutate({ auctionId: auction.id })}
                  cancelling={cancel.isPending}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>
      <section aria-labelledby="selling-bids" className="space-y-3">
        <h3 id="selling-bids" className="text-headline">
          Your bids
        </h3>
        {bids.isLoading ? (
          <Skeleton className="rounded-card h-24" />
        ) : bids.isError && !bids.data ? (
          <Card>
            <EmptyState
              compact
              role="alert"
              icon={<WarningCircle />}
              title="Your bids did not load"
              message="Try loading your active bids again."
              action={
                <Button variant="secondary" onClick={() => void bids.refetch()}>
                  Try again
                </Button>
              }
            />
          </Card>
        ) : bidding.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={<Cart />}
              title="No bids running"
              message="Auctions you bid on appear here until they end."
            />
          </Card>
        ) : (
          <Card content="data">
            <ul className="divide-separator divide-y">
              {bidding.map((auction) => (
                <BidRow
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
      </section>
    </div>
  );
}
