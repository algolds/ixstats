"use client";

import { Cart, Shop, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { RarityMark } from "~/components/cards/face/RarityMark";
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

/** A listing or a bid's card: its face, which opens the sheet, its title, and rarity mark. */
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
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-callout truncate">{face?.title ?? "A card"}</p>
        {face && <RarityMark rarity={face.rarity} />}
      </div>
    </>
  );
}

type OwnListingData = Pick<
  AuctionRowData,
  "id" | "currentBid" | "startingPrice" | "buyoutPrice" | "bidCount" | "endTime" | "face"
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
  const standingPrice = (auction.currentBid || auction.startingPrice).toLocaleString();
  const buyoutPhrase =
    auction.buyoutPrice !== null ? ` · Buyout ${auction.buyoutPrice.toLocaleString()} IxC` : "";
  return (
    <li data-row className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ListingCard face={auction.face} onOpenCard={onOpenCard} />
      <div className="space-y-1">
        <p className="text-footnote text-label-secondary tabular-nums">
          {standingPrice} IxC{buyoutPhrase} · {bidCountLabel(auction.bidCount)} ·{" "}
          {timeLeftPhrase(auction.endTime)}
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
  const buyoutPhrase =
    auction.buyoutPrice !== null ? ` · Buyout ${auction.buyoutPrice.toLocaleString()} IxC` : "";
  return (
    <li data-row className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ListingCard face={auction.face} onOpenCard={onOpenCard} />
      <div className="space-y-1">
        <Badge variant={auction.winning ? "success" : "warning"}>
          {auction.winning ? "Winning" : "Outbid"}
        </Badge>
        <p className="text-footnote text-label-secondary tabular-nums">
          {auction.currentBid.toLocaleString()} IxC{buyoutPhrase} ·{" "}
          {timeLeftPhrase(auction.endTime)}
        </p>
      </div>
      {!auction.winning && <BidForm auction={auction} verb="Raise bid to" {...bidding} />}
    </li>
  );
}

function OwnAuctionsBody({
  loading,
  failed,
  onRetry,
  mine,
  onSell,
  onOpenCard,
  onCancel,
  cancelling,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  mine: readonly OwnListingData[];
  onSell: () => void;
  onOpenCard: (cardId: string) => void;
  onCancel: (auctionId: string) => void;
  cancelling: boolean;
}) {
  if (loading) return <Skeleton className="rounded-card h-24" />;
  if (failed) {
    return (
      <Card>
        <EmptyState
          compact
          role="alert"
          icon={<WarningCircle />}
          title="Your auctions did not load"
          message="Try loading your running auctions again."
          action={
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  if (mine.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={<Shop />}
          title="You have no auctions running"
          message="List a card at auction here, or from its sheet."
          action={
            <Button variant="secondary" size="sm" onClick={onSell}>
              List a card
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <Card content="data" padding="none">
      <ul className="divide-separator divide-y">
        {mine.map((auction) => (
          <OwnListing
            key={auction.id}
            auction={auction}
            onOpenCard={onOpenCard}
            onCancel={() => onCancel(auction.id)}
            cancelling={cancelling}
          />
        ))}
      </ul>
    </Card>
  );
}

function ActiveBidsBody({
  loading,
  failed,
  onRetry,
  bidding,
  onOpenCard,
  actions,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  bidding: readonly BidData[];
  onOpenCard: (cardId: string) => void;
  actions: BidActions;
}) {
  if (loading) return <Skeleton className="rounded-card h-24" />;
  if (failed) {
    return (
      <Card>
        <EmptyState
          compact
          role="alert"
          icon={<WarningCircle />}
          title="Your bids did not load"
          message="Try loading your active bids again."
          action={
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  if (bidding.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={<Cart />}
          title="No bids running"
          message="Auctions you bid on appear here until they end."
        />
      </Card>
    );
  }
  return (
    <Card content="data" padding="none">
      <ul className="divide-separator divide-y">
        {bidding.map((auction) => (
          <BidRow key={auction.id} auction={auction} onOpenCard={onOpenCard} {...actions} />
        ))}
      </ul>
    </Card>
  );
}

/** My listings: the player's fixed-price listings, then their running auctions and active bids. */
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
  const bothIdle =
    !listings.isLoading &&
    !bids.isLoading &&
    !(listings.isError && !listings.data) &&
    !(bids.isError && !bids.data) &&
    mine.length === 0 &&
    bidding.length === 0;

  return (
    <div className="space-y-8">
      <MyListings />
      {bothIdle ? (
        <section aria-labelledby="selling-auctions" className="space-y-3">
          <h3 id="selling-auctions" className="text-headline">
            Auctions and bids
          </h3>
          <Card>
            <EmptyState
              compact
              icon={<Shop />}
              title="No active auctions or bids"
              message="Auctions you start or bid on appear here until they settle."
              action={
                <Button variant="secondary" size="sm" onClick={onSell}>
                  List a card
                </Button>
              }
            />
          </Card>
        </section>
      ) : (
        <>
          <section aria-labelledby="selling-auctions" className="space-y-3">
            <h3 id="selling-auctions" className="text-headline">
              Your auctions
            </h3>
            <OwnAuctionsBody
              loading={listings.isLoading}
              failed={listings.isError && !listings.data}
              onRetry={() => void listings.refetch()}
              mine={mine}
              onSell={onSell}
              onOpenCard={onOpenCard}
              onCancel={(auctionId) => cancel.mutate({ auctionId })}
              cancelling={cancel.isPending}
            />
          </section>
          <section aria-labelledby="selling-bids" className="space-y-3">
            <h3 id="selling-bids" className="text-headline">
              Your bids
            </h3>
            <ActiveBidsBody
              loading={bids.isLoading}
              failed={bids.isError && !bids.data}
              onRetry={() => void bids.refetch()}
              bidding={bidding}
              onOpenCard={onOpenCard}
              actions={{
                onBid: placeBid,
                onBuyout: executeBuyout,
                busy: isBidding || isBuyingOut,
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
