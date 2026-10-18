"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
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
import { CreateAuctionModal } from "./CreateAuctionModal";

interface MarketSellingProps {
  /** `?sell=<ownershipId>` from a card's sheet: open the auction form with that copy. */
  sellOwnershipId: string | null;
  onSellHandled: () => void;
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
        <CardFace face={face} size="S" className="w-16" onOpen={() => onOpenCard(face.cardId)} />
      )}
      <p className="text-callout min-w-0 flex-1 truncate">{face?.title ?? "A card"}</p>
    </>
  );
}

type OwnListingData = Pick<
  AuctionRowData,
  "id" | "currentBid" | "startingPrice" | "bidCount" | "endTime" | "face"
>;

/** One of the player's listings. A listing with bids cannot be cancelled, and says so where Cancel is. */
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

/** Selling: the player's own listings and the auctions they bid on. */
export function MarketSelling({ sellOwnershipId, onSellHandled, onOpenCard }: MarketSellingProps) {
  const [selling, setSelling] = useState(false);
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
      <section aria-labelledby="selling-listings" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="selling-listings" className="text-headline">
            Your listings
          </h3>
          <Button size="sm" onClick={() => setSelling(true)}>
            Sell a card
          </Button>
        </div>
        {mine.length === 0 ? (
          <EmptyState
            compact
            title="You have nothing listed"
            message="Sell a card here, or from its sheet."
          />
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
        {bidding.length === 0 ? (
          <EmptyState
            compact
            title="No bids running"
            message="Auctions you bid on appear here until they end."
          />
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
      <CreateAuctionModal
        key={sellOwnershipId ?? "new"}
        open={selling || sellOwnershipId !== null}
        initialOwnershipId={sellOwnershipId}
        onClose={() => {
          setSelling(false);
          onSellHandled();
        }}
      />
    </div>
  );
}
