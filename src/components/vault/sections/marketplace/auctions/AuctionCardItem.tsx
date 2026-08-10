"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { IxCreditsSymbol } from "../../../IxCreditsSymbol";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { getRarityTheme } from "~/components/vault/vault-theme";
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
  const msLeft = endTime.getTime() - Date.now();
  const minsLeft = Math.max(0, Math.floor(msLeft / 60000));
  const isUrgent = minsLeft < 10;
  const minNextBid = Math.ceil(currentBid * 1.05);
  const [customAmount, setCustomAmount] = useState(minNextBid);

  const theme = getRarityTheme(rarity);

  return (
    <div className="glass-surface border-border/50 relative flex gap-3 overflow-hidden rounded-lg border bg-black/5 p-3 dark:bg-black/20">
      <TextureOverlay texture="dots" opacity={0.015} />

      {/* Artwork thumbnail — click to view details */}
      <button
        onClick={() => onShowDetails(auction)}
        className="relative h-14 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/10"
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
      <button
        onClick={() => onShowDetails(auction)}
        className="relative z-10 flex min-w-0 flex-1 flex-col justify-between text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-bold text-slate-900 dark:text-white/95">
            {title}
          </span>
          <Badge
            variant="outline"
            className={cn("shrink-0 px-1 py-0 text-[8px] font-bold uppercase", theme.badgeStyle)}
          >
            {rarity}
          </Badge>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
          <span>
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              isUrgent ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3" />
            {minsLeft > 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`}
          </span>
        </div>
      </button>

      {/* Bidding Actions */}
      <div className="relative z-10 flex flex-col items-end justify-between gap-2 select-none">
        <div className="text-right">
          <span className="text-muted-foreground block text-[9px] leading-none">Current Bid</span>
          <span className="mt-0.5 flex items-center justify-end gap-0.5 text-sm leading-none font-black text-amber-600 dark:text-amber-400">
            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
            {currentBid.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Custom bid input */}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={minNextBid}
              value={customAmount}
              onChange={(e) => setCustomAmount(parseInt(e.target.value) || minNextBid)}
              className="h-6 w-16 border px-1 font-mono text-[10px] text-slate-800 dark:border-slate-700/60 dark:bg-slate-800 dark:text-white"
            />
            <Button
              size="sm"
              onClick={() => onBid(auction.id, customAmount)}
              disabled={isBidding || customAmount < minNextBid}
              className="bg-secondary border-border/50 hover:bg-secondary/80 h-6 border px-2 text-[10px] text-slate-800 dark:border-slate-700/60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {isBidding ? "..." : "Bid"}
            </Button>
          </div>
          {auction.buyoutPrice && (
            <Button
              size="sm"
              onClick={() => onBuyout(auction.id)}
              disabled={isBuyingOut}
              className="h-6 border-none bg-gradient-to-r from-amber-600 to-yellow-600 px-2 text-[10px] font-bold text-white hover:from-amber-500 hover:to-yellow-500"
            >
              Buy {auction.buyoutPrice.toLocaleString()}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
