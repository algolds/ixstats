// src/components/vault/cards/market/market-history.ts
import type { Prisma } from "@prisma/client";
import type { CardFaceData } from "~/lib/cards/face/types";

/** A trade's side, named by passport handle (`trading.getTradeHistory`). */
type Party = { clerkUserId: string; passportHandle: string } | null;

/** A finished trade as `trading.getTradeHistory` lists it. */
export interface TradeLike {
  id: string;
  status: string;
  updatedAt: Date;
  initiatorCardIds: Prisma.JsonValue;
  recipientCardIds: Prisma.JsonValue;
  initiator: Party;
  recipient: Party;
}

/** A past auction as `cardMarket.getMyAuctionParticipation` lists it. */
export interface AuctionLike {
  id: string;
  updatedAt: Date;
  participation: "won" | "sold" | "bid" | "cancelled";
  finalPrice: number | null;
  currentBid: number;
  face: CardFaceData | null;
}

export type HistoryEntry =
  | {
      kind: "trade";
      id: string;
      at: Date;
      label: string;
      partnerHandle: string | null;
      gave: number;
      got: number;
    }
  | {
      kind: "auction";
      id: string;
      at: Date;
      label: string;
      price: number | null;
      face: CardFaceData | null;
    };

const TRADE_LABEL: Readonly<Record<string, string>> = {
  ACCEPTED: "Completed",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const AUCTION_LABEL: Readonly<Record<AuctionLike["participation"], string>> = {
  won: "Won",
  sold: "Sold",
  bid: "Outbid",
  cancelled: "Cancelled",
};

/** A trade side's copy count; the list is stored as JSON. */
const count = (ids: Prisma.JsonValue) => (Array.isArray(ids) ? ids.length : 0);

/** Trades and auctions in one history, newest first, each told from the viewer's side. */
export function mergeMarketHistory(
  trades: readonly TradeLike[],
  auctions: readonly AuctionLike[],
  viewerClerkId: string | null
): HistoryEntry[] {
  const tradeEntries = trades.map((trade): HistoryEntry => {
    const sent = trade.initiator?.clerkUserId === viewerClerkId;
    return {
      kind: "trade",
      id: trade.id,
      at: trade.updatedAt,
      label: TRADE_LABEL[trade.status] ?? "Ended",
      partnerHandle: (sent ? trade.recipient : trade.initiator)?.passportHandle ?? null,
      gave: count(sent ? trade.initiatorCardIds : trade.recipientCardIds),
      got: count(sent ? trade.recipientCardIds : trade.initiatorCardIds),
    };
  });
  const auctionEntries = auctions.map((auction): HistoryEntry => ({
    kind: "auction",
    id: auction.id,
    at: auction.updatedAt,
    label: AUCTION_LABEL[auction.participation],
    price:
      auction.participation === "cancelled" ? null : (auction.finalPrice ?? auction.currentBid),
    face: auction.face,
  }));
  return [...tradeEntries, ...auctionEntries].sort((a, b) => b.at.getTime() - a.at.getTime());
}
