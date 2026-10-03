// src/types/marketplace.ts
// Type definitions for IxCards marketplace and auction system
import type { CardInstance } from "./cards-display";

export type { CardInstance } from "./cards-display";

/**
 * Auction listing with current state
 */
export interface AuctionListing {
  id: string;
  cardInstanceId: string;
  sellerId: string;
  sellerName: string;
  startingPrice: number;
  currentBid: number;
  buyoutPrice: number | null;
  endTime: number; // realtime epoch ms (Date.now) — auctions run on wall-clock, NOT IxTime
  bidCount: number;
  isExpired: boolean;
  isFeatured: boolean;
  isExpress: boolean; // 30min express auction
  cardInstance: CardInstance;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bid on an auction
 */
export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: number; // realtime epoch ms (Date.now), NOT IxTime
  isAutoBid: boolean;
}

/**
 * WebSocket message types
 */
export type MarketWebSocketMessage =
  | {
      type: "bid";
      data: Bid;
    }
  | {
      type: "auction_complete";
      data: {
        auctionId: string;
        winnerId: string;
        finalPrice: number;
      };
    }
  | {
      type: "price_update";
      data: {
        cardId: string;
        newPrice: number;
      };
    }
  | {
      type: "auction_created";
      data: AuctionListing;
    };
