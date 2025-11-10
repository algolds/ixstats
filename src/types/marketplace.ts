// src/types/marketplace.ts
// Type definitions for IxCards marketplace and auction system

import type { CardRarity, CardType } from "@prisma/client";

/**
 * Card instance with full details
 * Matches Prisma Card model with ownership info
 */
export interface CardInstance {
  id: string;
  title: string;
  description: string | null;
  artwork: string;
  artworkVariants: any;
  cardType: CardType;
  rarity: CardRarity;
  season: number;
  nsCardId: number | null;
  nsSeason: number | null;
  nsData: any;
  wikiSource: string | null;
  wikiArticleTitle: string | null;
  wikiUrl: string | null;
  countryId: string | null;
  stats: any;
  totalSupply: number;
  marketValue: number;
  level: number;
  evolutionStage: number;
  enhancements: any;
  createdAt: Date;
  updatedAt: Date;
  lastTrade: Date | null;
  country?: {
    id: string;
    name: string;
    continent: string | null;
    region: string | null;
    flag: string | null;
  };
}

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
  endTime: number; // IxTime timestamp
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
  timestamp: number; // IxTime
  isAutoBid: boolean;
}

/**
 * Market filters for browsing
 */
export interface MarketFilters {
  rarities: CardRarity[];
  seasons: number[];
  cardTypes: CardType[];
  priceMin: number;
  priceMax: number;
  statRanges?: Record<string, [number, number]>;
  searchQuery?: string;
  showExpressOnly?: boolean;
  showFeaturedOnly?: boolean;
}

/**
 * Sort options for market browser
 */
export interface MarketSort {
  field: "endTime" | "currentBid" | "bidCount" | "rarity" | "createdAt";
  direction: "asc" | "desc";
}

/**
 * Paginated auction results
 */
export interface PaginatedAuctions {
  auctions: AuctionListing[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Market analytics data
 */
export interface MarketAnalytics {
  priceHistory: PriceDataPoint[];
  trendingCards: TrendingCard[];
  marketSentiment: MarketSentiment;
  volumeStats: VolumeStats;
}

/**
 * Price history data point
 */
export interface PriceDataPoint {
  timestamp: number; // IxTime
  cardId: string;
  price: number;
  volume: number;
}

/**
 * Trending card info
 */
export interface TrendingCard {
  cardId: string;
  cardTitle: string;
  cardRarity: CardRarity;
  bidCount24h: number;
  priceChange24h: number; // percentage
  volume24h: number; // IxCredits
}

/**
 * Market sentiment indicator
 */
export interface MarketSentiment {
  score: number; // -100 to 100
  trend: "bullish" | "bearish" | "neutral";
  confidence: number; // 0 to 1
}

/**
 * Volume statistics
 */
export interface VolumeStats {
  volume24h: number; // IxCredits
  volumeChange24h: number; // percentage
  totalSales24h: number;
  averagePrice24h: number;
}

/**
 * Create auction input
 */
export interface CreateAuctionInput {
  cardInstanceId: string;
  startingPrice: number;
  buyoutPrice: number | null;
  duration: 30 | 60; // minutes (Express or Standard)
  isExpress: boolean;
  isFeatured: boolean;
}

/**
 * Bid placement input
 */
export interface PlaceBidInput {
  auctionId: string;
  amount: number;
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

/**
 * Countdown state for auction timers
 */
export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  urgency: "safe" | "moderate" | "urgent" | "critical";
}

/**
 * Auction fee structure
 */
export interface AuctionFees {
  listingFee: number; // Flat fee to list
  successFee: number; // Percentage of sale (only if >100 IxC)
  expressFee: number; // Extra fee for express listing
  featuredFee: number; // Extra fee for featured listing
  totalFee: number;
}

/**
 * User's available balance
 */
export interface UserBalance {
  ixCredits: number;
  lockedCredits: number; // Credits in active bids
  availableCredits: number; // ixCredits - lockedCredits
}
