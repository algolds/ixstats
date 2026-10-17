"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { CardFace } from "~/components/cards/face/CardFace";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";
import type { CardFaceData } from "~/lib/cards/face/types";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { bidCountLabel } from "./AuctionRow";
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

/** Selling: the player's own listings and the auctions they lead. */
export function MarketSelling({ sellOwnershipId, onSellHandled, onOpenCard }: MarketSellingProps) {
  const [selling, setSelling] = useState(false);
  const utils = api.useUtils();
  const listings = api.cardMarket.getMyActiveAuctions.useQuery();
  const bids = api.cardMarket.getMyActiveBids.useQuery();
  const cancel = api.cardMarket.cancelAuction.useMutation({
    onSuccess: (result) => {
      vaultNotify.success(result.message);
      void utils.cardMarket.getMyActiveAuctions.invalidate();
      void utils.cardMarket.getActiveAuctions.invalidate();
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
                <li key={auction.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ListingCard face={auction.face} onOpenCard={onOpenCard} />
                  <p className="text-footnote text-label-secondary tabular-nums">
                    {(auction.currentBid || auction.startingPrice).toLocaleString()} IxC ·{" "}
                    {bidCountLabel(auction.bidCount)} · {timeLeftPhrase(auction.endTime)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={auction.bidCount > 0 || cancel.isPending}
                    title={
                      auction.bidCount > 0 ? "A listing with bids cannot be cancelled" : undefined
                    }
                    onClick={() => cancel.mutate({ auctionId: auction.id })}
                  >
                    Cancel
                  </Button>
                </li>
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
            title="No winning bids"
            message="Auctions where yours is the top bid appear here until they end."
          />
        ) : (
          <Card content="data">
            <ul className="divide-separator divide-y">
              {bidding.map((auction) => (
                <li key={auction.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ListingCard face={auction.face} onOpenCard={onOpenCard} />
                  <p className="text-footnote text-label-secondary tabular-nums">
                    {auction.currentBid.toLocaleString()} IxC · {timeLeftPhrase(auction.endTime)}
                  </p>
                </li>
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
