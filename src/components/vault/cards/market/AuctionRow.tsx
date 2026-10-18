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
  /** The viewer's own listing, which they cannot bid on. */
  isMine: boolean;
}

/** What the bid form reads of an auction. */
export type BidTarget = Pick<AuctionRowData, "id" | "currentBid" | "startingPrice" | "buyoutPrice">;

export interface BidActions {
  onBid: (auctionId: string, amount: number) => void;
  onBuyout: (auctionId: string) => void;
  busy: boolean;
}

interface BidFormProps extends BidActions {
  auction: BidTarget;
  /** The bid button's verb: "Raise bid to" on an auction the player was outbid on. */
  verb?: "Bid" | "Raise bid to";
}

interface AuctionRowProps extends BidActions {
  auction: AuctionRowData;
  onOpenCard: (cardId: string) => void;
  /** Opens Selling, where the viewer manages their own listings. */
  onShowSelling: () => void;
}

export const bidCountLabel = (count: number) => (count === 1 ? "1 bid" : `${count} bids`);

/**
 * The bid and buy-now controls. An empty bid, or one typed under the floor, bids the floor: a bid from anyone raises
 * it, and a stale typed number must not leave Bid stuck. The button names the amount it sends.
 */
export function BidForm({ auction, onBid, onBuyout, busy, verb = "Bid" }: BidFormProps) {
  const current = auction.currentBid || auction.startingPrice;
  const minimum = Math.ceil(current * BID_STEP);
  const [draft, setDraft] = useState("");
  const typed = Number(draft);
  const amount = draft === "" || typed < minimum ? minimum : typed;
  const valid = Number.isInteger(amount);
  const inputId = `bid-${auction.id}`;
  return (
    <form
      // The field's min and step are spinner hints; the floor rule above decides, not the browser's validation.
      noValidate
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
        {verb} {amount.toLocaleString()} IxC
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
  );
}

/** One live auction: the card's face, where it stands, time left, and the bid and buy-now controls. */
export function AuctionRow({ auction, onOpenCard, onShowSelling, ...bidding }: AuctionRowProps) {
  const face = auction.face;
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
      {auction.isMine ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-footnote text-label-secondary">Your listing</p>
          <Button variant="link" size="sm" className="px-0" onClick={onShowSelling}>
            See it in Selling
          </Button>
        </div>
      ) : (
        <BidForm auction={auction} {...bidding} />
      )}
    </li>
  );
}
