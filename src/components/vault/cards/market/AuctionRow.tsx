"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CardFace } from "~/components/cards/face/CardFace";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { timeLeftPhrase } from "~/lib/cards/face/time-left";
import type { CardFaceData } from "~/lib/cards/face/types";

/** A bid must beat the standing price by 5%, rounded up: the auction service's own rule. */
const BID_STEP = 1.05;

export interface AuctionRowData {
  id: string;
  currentBid: number;
  startingPrice: number;
  buyoutPrice: number | null;
  endTime: Date;
  bidCount: number;
  face: CardFaceData | null;
}

interface AuctionRowProps {
  auction: AuctionRowData;
  onOpenCard: (cardId: string) => void;
  onBid: (auctionId: string, amount: number) => void;
  onBuyout: (auctionId: string) => void;
  busy: boolean;
}

export const bidCountLabel = (count: number) => (count === 1 ? "1 bid" : `${count} bids`);

/** One live auction: the card's face, where it stands, time left, and the bid and buy-now controls. */
export function AuctionRow({ auction, onOpenCard, onBid, onBuyout, busy }: AuctionRowProps) {
  const current = auction.currentBid || auction.startingPrice;
  const minimum = Math.ceil(current * BID_STEP);
  // Empty bids the minimum, so a bid from someone else raises it without stale input to clear.
  const [draft, setDraft] = useState("");
  const amount = draft === "" ? minimum : Number(draft);
  const valid = Number.isInteger(amount) && amount >= minimum;
  const face = auction.face;
  const inputId = `bid-${auction.id}`;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {face && (
        <CardFace face={face} size="S" className="w-20" onOpen={() => onOpenCard(face.cardId)} />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-headline truncate">{face?.title ?? "A card"}</p>
        {face && <RarityMark rarity={face.rarity} />}
        <p className="text-footnote text-label-secondary tabular-nums">
          {bidCountLabel(auction.bidCount)} · {timeLeftPhrase(auction.endTime)}
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onBid(auction.id, amount);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={inputId} className="text-footnote text-label-secondary">
            Bid, now {current.toLocaleString()} IxC
          </Label>
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={minimum}
            step={1}
            placeholder={String(minimum)}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-28 tabular-nums"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !valid}>
          Bid
        </Button>
        {auction.buyoutPrice !== null && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onBuyout(auction.id)}
          >
            Buy now for {auction.buyoutPrice.toLocaleString()} IxC
          </Button>
        )}
      </form>
    </li>
  );
}
