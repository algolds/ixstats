"use client";

import React, { useState } from "react";
import { Clock } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { IxCreditsSymbol } from "../../../IxCreditsSymbol";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { getRarityTheme } from "~/lib/cards/display-utils";
import type { MarketAuctionItem } from "./types";

export function AuctionCardItem({
  auction,
  onBid,
  onBuyout,
  onShowDetails,
  isBidding,
  isBuyingOut,
}: {
  auction: MarketAuctionItem;
  onBid: (auctionId: string, amount: number) => void;
  onBuyout: (auctionId: string) => void;
  onShowDetails: (auction: MarketAuctionItem) => void;
  isBidding: boolean;
  isBuyingOut: boolean;
}) {
  const card = auction.CardOwnership?.cards;
  const title = card?.title ?? "Unknown Card";
  const rarity = card?.rarity ?? "COMMON";
  const artwork = card?.artwork;
  const currentBid = auction.currentBid ?? auction.startingPrice;
  const bidCount = auction.bidCount ?? auction.AuctionBid?.length ?? 0;
  const endTime = new Date(auction.endTime);
  // oxlint-disable-next-line
  const msLeft = endTime.getTime() - Date.now();
  const minsLeft = Math.max(0, Math.floor(msLeft / 60000));
  const isUrgent = minsLeft < 10;
  const minNextBid = Math.ceil(currentBid * 1.05);
  const [customAmount, setCustomAmount] = useState(minNextBid);

  const theme = getRarityTheme(rarity);

  return (
    <div className="border-separator bg-fill-4 rounded-row relative flex gap-3 overflow-hidden border p-3">
      {/* Artwork thumbnail — click to view details */}
      <button
        type="button"
        // Duplicate pointer target for the artwork; keyboard users use the details button.
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => onShowDetails(auction)}
        className="border-separator rounded-control-sm relative h-14 w-12 shrink-0 cursor-pointer overflow-hidden border"
      >
        <CardHolographicCover cardType="NS_IMPORT" rarity={rarity} title={title} />
        {artwork && artwork !== "/images/cards/placeholder-nation.png" && (
          <img
            src={artwork}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </button>

      {/* Info — click to view details */}
      <Button
        variant="ghost"
        onClick={() => onShowDetails(auction)}
        className="relative z-10 h-auto min-w-0 flex-1 flex-col items-stretch justify-between gap-0 p-0 text-left font-normal whitespace-normal hover:bg-transparent"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-label text-footnote truncate font-semibold">{title}</span>
          <Badge
            variant="outline"
            className={cn("text-eyebrow shrink-0 px-1 py-0", theme.badgeStyle)}
          >
            {rarity}
          </Badge>
        </div>
        <div className="text-label-secondary text-footnote flex items-center gap-3">
          <span>
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              isUrgent ? "text-red" : "text-label-secondary"
            )}
          >
            <Clock className="h-3 w-3" />
            {minsLeft > 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`}
          </span>
        </div>
      </Button>

      {/* Bidding Actions */}
      <div className="relative z-10 flex flex-col items-end justify-between gap-2 select-none">
        <div className="text-right">
          <span className="text-label-secondary text-stat-label block leading-none">
            Current bid
          </span>
          <span className="text-headline text-yellow mt-0.5 flex items-center justify-end gap-0.5 leading-none tabular-nums">
            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
            {currentBid.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Custom bid input */}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={minNextBid}
              value={customAmount}
              onChange={(e) => setCustomAmount(parseInt(e.target.value) || minNextBid)}
              className="border-separator bg-background text-label text-footnote h-6 w-16 border px-1 tabular-nums"
            />
            <Button
              size="sm"
              onClick={() => onBid(auction.id, customAmount)}
              disabled={isBidding || customAmount < minNextBid}
              className="border-separator bg-fill-3 text-label text-footnote h-6 border px-2 font-semibold"
            >
              {isBidding ? "..." : "Bid"}
            </Button>
          </div>
          {auction.buyoutPrice && (
            <Button
              size="sm"
              onClick={() => onBuyout(auction.id)}
              disabled={isBuyingOut}
              className="h-6 px-2"
            >
              Buy {auction.buyoutPrice.toLocaleString()}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
