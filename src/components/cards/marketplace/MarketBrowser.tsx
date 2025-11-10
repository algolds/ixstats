// src/components/cards/marketplace/MarketBrowser.tsx
// Main marketplace browsing page with auction grid

"use client";

import React, { memo, useState, useCallback, useMemo } from "react";
import { AuctionCard } from "./AuctionCard";
import { MarketFilters } from "./MarketFilters";
import { BidPanel } from "./BidPanel";
import { MarketAnalytics } from "./MarketAnalytics";
import { CreateAuctionModal } from "./CreateAuctionModal";
import { useMarketData } from "~/hooks/marketplace/useMarketData";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { cn } from "~/lib/utils";
import type { MarketFilters as IMarketFilters, MarketSort } from "~/types/marketplace";

interface MarketBrowserProps {
  initialFilters?: Partial<IMarketFilters>;
  initialSort?: MarketSort;
  className?: string;
  showAnalytics?: boolean;
  currentUserId?: string;
  userBalance?: number;
}

/**
 * MarketBrowser - Main marketplace page
 *
 * Features:
 * - Active auctions grid (responsive layout)
 * - Filter panel sidebar (collapsible on mobile)
 * - Sort controls (dropdown: ending soon, price, rarity)
 * - Search bar (debounced search by card name)
 * - Pagination (load more button + infinite scroll)
 * - Analytics panel (optional)
 * - Bid panel (slide-over)
 * - Create auction modal
 *
 * @example
 * <MarketBrowser
 *   initialFilters={{ rarities: [CardRarity.LEGENDARY] }}
 *   showAnalytics={true}
 *   currentUserId="user-123"
 *   userBalance={500}
 * />
 */
export const MarketBrowser = memo<MarketBrowserProps>(
  ({
    initialFilters,
    initialSort,
    className,
    showAnalytics = true,
    currentUserId,
    userBalance = 0,
  }) => {
    // Market data hook
    const {
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
    } = useMarketData({
      initialFilters,
      initialSort,
    });

    // Bid hook
    const { placeBid, isPlacing } = useAuctionBid();

    // UI state
    const [showFilters, setShowFilters] = useState(true);
    const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(showAnalytics);
    const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(
      null
    );
    const [showBidPanel, setShowBidPanel] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState(filters.searchQuery || "");

    // Selected auction for bidding
    const selectedAuction = useMemo(
      () => auctions.find((a) => a.id === selectedAuctionId) || null,
      [auctions, selectedAuctionId]
    );

    /**
     * Handle bid button click
     */
    const handleBid = useCallback((auctionId: string) => {
      setSelectedAuctionId(auctionId);
      setShowBidPanel(true);
    }, []);

    /**
     * Handle buyout button click
     */
    const handleBuyout = useCallback(async (auctionId: string) => {
      const auction = auctions.find((a) => a.id === auctionId);
      if (!auction?.buyoutPrice) return;

      // TODO: Implement buyout via Agent 6's tRPC mutation
      console.log("Buyout auction:", auctionId, auction.buyoutPrice);
    }, [auctions]);

    /**
     * Handle bid submission
     */
    const handleSubmitBid = useCallback(
      async (auctionId: string, amount: number) => {
        await placeBid({ auctionId, amount });
        await refetch(); // Refresh auctions after bid
      },
      [placeBid, refetch]
    );

    /**
     * Handle search with debounce
     */
    const handleSearch = useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        setSearchQuery(query);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setFilters({ searchQuery: query });
        }, 300); // 300ms debounce
      };
    }, [setFilters]);

    /**
     * Handle sort change
     */
    const handleSortChange = useCallback(
      (field: MarketSort["field"]) => {
        const newDirection =
          sort.field === field && sort.direction === "asc" ? "desc" : "asc";
        setSort({ field, direction: newDirection });
      },
      [sort, setSort]
    );

    return (
      <div className={cn("min-h-screen bg-black/20", className)}>
        <div className="mx-auto max-w-[1920px] p-4">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Card Marketplace</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                {total} active auction{total !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAnalyticsPanel(!showAnalyticsPanel)}
                className={cn(
                  "rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all touch-manipulation",
                  showAnalyticsPanel
                    ? "bg-blue-500 text-white"
                    : "border border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 active:bg-white/15"
                )}
              >
                Analytics
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-green-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-green-600 active:bg-green-700 transition-all touch-manipulation"
              >
                List Card
              </button>
            </div>
          </div>

          {/* Search and sort */}
          <div className="mb-6 flex flex-col gap-3 sm:gap-4">
            {/* Search bar */}
            <div className="w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by card name..."
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Sort and filter controls */}
            <div className="flex flex-col xs:flex-row gap-2">
              <select
                value={sort.field}
                onChange={(e) =>
                  handleSortChange(e.target.value as MarketSort["field"])
                }
                className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 sm:px-4 py-2 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="endTime">Ending Soon</option>
                <option value="currentBid">Price</option>
                <option value="bidCount">Most Bids</option>
                <option value="rarity">Rarity</option>
                <option value="createdAt">Recently Listed</option>
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-lg border border-white/20 bg-white/5 px-3 sm:px-4 py-2 text-sm sm:text-base text-white hover:bg-white/10 active:bg-white/15 transition-all touch-manipulation lg:hidden"
              >
                {showFilters ? "Hide Filters" : "Show Filters"}
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr_320px]">
            {/* Filters sidebar */}
            <aside
              className={cn(
                "lg:block",
                !showFilters && "hidden"
              )}
            >
              <MarketFilters
                filters={filters}
                onChange={setFilters}
                collapsible={true}
              />
            </aside>

            {/* Auction grid */}
            <main>
              {error && (
                <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400">
                  {error.message}
                </div>
              )}

              {loading && auctions.length === 0 ? (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[400px] sm:h-[500px] animate-pulse rounded-xl bg-white/5"
                    />
                  ))}
                </div>
              ) : auctions.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/40 p-12 text-center">
                  <svg
                    className="mx-auto mb-4 h-16 w-16 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-lg font-medium text-white">
                    No auctions found
                  </p>
                  <p className="text-sm text-gray-400">
                    Try adjusting your filters or check back later
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {auctions.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction}
                        onBid={handleBid}
                        onBuyout={handleBuyout}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>

                  {/* Load more */}
                  {hasMore && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => void loadMore()}
                        disabled={loading}
                        className={cn(
                          "rounded-lg px-8 py-3 font-bold transition-all",
                          loading
                            ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                            : "bg-white/10 text-white hover:bg-white/20"
                        )}
                      >
                        {loading ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>

            {/* Analytics panel */}
            {showAnalyticsPanel && (
              <aside className="hidden xl:block">
                <MarketAnalytics timeRange="24h" />
              </aside>
            )}
          </div>
        </div>

        {/* Bid panel */}
        <BidPanel
          auction={selectedAuction}
          open={showBidPanel}
          onClose={() => setShowBidPanel(false)}
          onSubmitBid={handleSubmitBid}
          userBalance={userBalance}
        />

        {/* Create auction modal */}
        <CreateAuctionModal
          availableCards={[]} // TODO: Pass user's available cards
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateAuction={async (input) => {
            // TODO: Implement via Agent 6's tRPC mutation
            console.log("Create auction:", input);
            await refetch();
          }}
          userBalance={userBalance}
        />
      </div>
    );
  }
);

MarketBrowser.displayName = "MarketBrowser";
