"use client";

import { Button } from "~/components/ui/button";
import { CardFace } from "~/components/cards/face/CardFace";
import { RarityMark } from "~/components/cards/face/RarityMark";
import type { BrowseItemView } from "~/hooks/cards/useMarketTabs";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";
import { MarketRowTitle, YourListing } from "./AuctionRow";

interface ListingRowProps {
  item: BrowseItemView;
  onOpenCard: (cardId: string) => void;
  /** Opens Selling, where the viewer manages their own listings. */
  onShowSelling: () => void;
  /** Opens the purchase dialog for this listing. */
  onBuy: (item: BrowseItemView) => void;
}

/** One fixed-price listing in Browse: the copy's face, which copy it is, time left, and Buy on another player's. */
export function ListingRow({ item, onOpenCard, onShowSelling, onBuy }: ListingRowProps) {
  const { face } = item;
  const details = [
    face.copy && `${FINISH_LABEL[face.copy.finish]} #${face.copy.serialNumber}`,
    timeLeftPhrase(item.endsAt),
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <CardFace face={face} size="S" className="w-20" onOpen={() => onOpenCard(face.cardId)} />
      <div className="min-w-0 flex-1 space-y-1">
        <MarketRowTitle title={face.title} featured={item.isFeatured} />
        <RarityMark rarity={face.rarity} />
        <p className="text-footnote text-label-secondary tabular-nums">{details.join(" · ")}</p>
      </div>
      {item.isMine ? (
        <YourListing onShowSelling={onShowSelling} />
      ) : (
        // Secondary, as Bid is: Sell a card stays the one primary in Browse
        <Button size="sm" variant="secondary" onClick={() => onBuy(item)}>
          Buy for {item.price.toLocaleString()} IxC
        </Button>
      )}
    </li>
  );
}
