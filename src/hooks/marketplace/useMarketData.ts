// src/hooks/marketplace/useMarketData.ts
// Hook for fetching and managing marketplace auction data

import { useState, useCallback, useEffect } from "react";
import type {
  AuctionListing,
  MarketFilters,
  MarketSort,
  PaginatedAuctions,
} from "~/types/marketplace";

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
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
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
  direction: "asc", // Ending soon first
};

/**
 * Hook for fetching and managing marketplace auction data
 * Handles pagination, filtering, sorting, and data fetching
 */
export function useMarketData(
  options: UseMarketDataOptions = {}
): UseMarketDataReturn {
  const {
    initialFilters = {},
    initialSort = DEFAULT_SORT,
    pageSize = 20,
    autoFetch = true,
  } = options;

  // State
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [filters, setFiltersState] = useState<MarketFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const [sort, setSortState] = useState<MarketSort>(initialSort);

  /**
   * Fetch auctions from API
   */
  const fetchAuctions = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Integrate with tRPC api.cardMarket.getActiveAuctions
        // For now, return empty state until tRPC client is wired
        // const result = await api.cardMarket.getActiveAuctions.query({
        //   limit: pageSize,
        //   offset: append ? offset : 0,
        //   // Apply filters when backend supports them
        //   cardId: filters.searchQuery, // Map to cardId filter
        //   isFeatured: filters.showFeaturedOnly,
        // });

        // Transform result to AuctionListing format
        // const auctions: AuctionListing[] = result.auctions.map((auction) => ({
        //   id: auction.id,
        //   cardInstanceId: auction.cardInstanceId,
        //   sellerId: auction.sellerId,
        //   sellerName: auction.User?.clerkUserId || "Unknown",
        //   startingPrice: auction.startingPrice,
        //   currentBid: auction.currentBid ?? auction.startingPrice,
        //   buyoutPrice: auction.buyoutPrice,
        //   endTime: new Date(auction.endTime).getTime(),
        //   bidCount: auction.bidCount,
        //   isExpired: new Date(auction.endTime) < new Date(),
        //   isFeatured: auction.isFeatured,
        //   isExpress: new Date(auction.endTime).getTime() - new Date(auction.createdAt).getTime() <= 30 * 60 * 1000,
        //   cardInstance: auction.CardOwnership?.cards as CardInstance,
        //   createdAt: auction.createdAt,
        //   updatedAt: auction.updatedAt,
        // }));

        // Placeholder until tRPC is wired
        const mockResult: PaginatedAuctions = {
          auctions: [],
          total: 0,
          hasMore: false,
        };

        if (append) {
          setAuctions((prev) => [...prev, ...mockResult.auctions]);
        } else {
          setAuctions(mockResult.auctions);
          setOffset(0);
        }

        setTotal(mockResult.total);
        setHasMore(mockResult.hasMore);

        if (append) {
          setOffset((prev) => prev + pageSize);
        } else {
          setOffset(pageSize);
        }
      } catch (err) {
        console.error("[useMarketData] Error fetching auctions:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch auctions")
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, sort, pageSize, offset]
  );

  /**
   * Update filters and refetch
   */
  const setFilters = useCallback((newFilters: Partial<MarketFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setOffset(0);
  }, []);

  /**
   * Update sort and refetch
   */
  const setSort = useCallback((newSort: MarketSort) => {
    setSortState(newSort);
    setOffset(0);
  }, []);

  /**
   * Load more auctions (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchAuctions(true);
  }, [hasMore, loading, fetchAuctions]);

  /**
   * Refetch from start
   */
  const refetch = useCallback(async () => {
    await fetchAuctions(false);
  }, [fetchAuctions]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setAuctions([]);
    setOffset(0);
    setTotal(0);
    setHasMore(true);
    setError(null);
    setFiltersState({ ...DEFAULT_FILTERS, ...initialFilters });
    setSortState(initialSort);
  }, [initialFilters, initialSort]);

  // Auto-fetch on mount or filter/sort change
  useEffect(() => {
    if (autoFetch) {
      void fetchAuctions(false);
    }
  }, [filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    auctions,
    loading,
    error,
    total,
    hasMore,
    filters,
    sort,
    setFilters,
    setSort,
    loadMore,
    refetch,
    reset,
  };
}
