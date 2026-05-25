// src/hooks/marketplace/useMarketData.ts
// Hook for fetching marketplace auction data via tRPC

"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import type { AuctionListing, MarketFilters, MarketSort } from "~/types/marketplace";

interface UseMarketDataOptions {
  initialFilters?: Partial<MarketFilters>;
  initialSort?: MarketSort;
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseMarketDataReturn {
  auctions: AuctionListing[];
  loading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  filters: MarketFilters;
  sort: MarketSort;
  setFilters: (filters: Partial<MarketFilters>) => void;
  setSort: (sort: MarketSort) => void;
  loadMore: () => void;
  refetch: () => void;
  reset: () => void;
}

const DEFAULT_FILTERS: MarketFilters = {
  rarities: [],
  seasons: [],
  cardTypes: [],
  priceMin: 0,
  priceMax: 10000,
  searchQuery: "",
  showExpressOnly: false,
  showFeaturedOnly: false,
};

const DEFAULT_SORT: MarketSort = {
  field: "endTime",
  direction: "asc",
};

function mapAuction(auction: any): AuctionListing {
  const card = auction.CardOwnership?.cards;
  return {
    id: auction.id,
    cardInstanceId: auction.cardOwnershipId,
    sellerId: auction.sellerId,
    sellerName: auction.User?.clerkUserId || "Unknown",
    startingPrice: auction.startingPrice,
    currentBid: auction.currentBid ?? auction.startingPrice,
    buyoutPrice: auction.buyoutPrice,
    endTime: new Date(auction.endTime).getTime(),
    bidCount: auction.bidCount ?? auction.AuctionBid?.length ?? 0,
    isExpired: new Date(auction.endTime) < new Date(),
    isFeatured: auction.isFeatured ?? false,
    isExpress:
      new Date(auction.endTime).getTime() - new Date(auction.createdAt).getTime() <= 30 * 60 * 1000,
    cardInstance: card
      ? {
          id: card.id,
          title: card.title ?? "Unknown",
          description: card.description || null,
          artwork: card.artwork || "/images/cards/placeholder-nation.png",
          artworkVariants: card.artworkVariants || null,
          cardType: card.cardType ?? "NS_IMPORT",
          rarity: card.rarity ?? "COMMON",
          season: card.season ?? 1,
          nsCardId: card.nsCardId || null,
          nsSeason: card.nsSeason || null,
          nsData: card.nsData || null,
          wikiSource: card.wikiSource || null,
          wikiArticleTitle: card.wikiArticleTitle || null,
          wikiUrl: card.wikiUrl || null,
          countryId: card.countryId ?? null,
          stats: card.stats || {},
          totalSupply: card.totalSupply || 0,
          marketValue: card.marketValue || 0,
          level: card.level || 1,
          evolutionStage: card.evolutionStage || 0,
          enhancements: card.enhancements || null,
          createdAt: card.createdAt ?? new Date(),
          updatedAt: card.updatedAt ?? new Date(),
          lastTrade: card.lastTrade || null,
        }
      : ({} as any),
    createdAt: auction.createdAt,
    updatedAt: auction.updatedAt,
  };
}

/**
 * Hook for fetching and managing marketplace auction data via tRPC
 */
export function useMarketData(options: UseMarketDataOptions = {}): UseMarketDataReturn {
  const { initialFilters = {}, initialSort = DEFAULT_SORT, pageSize = 20 } = options;

  const [offset, setOffset] = useState(0);
  const [filters, setFiltersState] = useState<MarketFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [sort, setSortState] = useState<MarketSort>(initialSort);

  const { data, isLoading, error, refetch } = api.cardMarket.getActiveAuctions.useQuery({
    limit: pageSize,
    offset,
    isFeatured: filters.showFeaturedOnly || undefined,
  });

  const rawAuctions = data?.auctions ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + pageSize < total;

  const auctions: AuctionListing[] = rawAuctions.map(mapAuction);

  const setFilters = useCallback((newFilters: Partial<MarketFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setOffset(0);
  }, []);

  const setSort = useCallback((newSort: MarketSort) => {
    setSortState(newSort);
    setOffset(0);
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setOffset((prev) => prev + pageSize);
    }
  }, [hasMore, isLoading, pageSize]);

  const reset = useCallback(() => {
    setOffset(0);
    setFiltersState({ ...DEFAULT_FILTERS, ...initialFilters });
    setSortState(initialSort);
  }, [initialFilters, initialSort]);

  return {
    auctions,
    loading: isLoading,
    error: error ? new Error(error.message) : null,
    total,
    hasMore,
    filters,
    sort,
    setFilters,
    setSort,
    loadMore,
    refetch: () => void refetch(),
    reset,
  };
}
