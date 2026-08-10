"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "~/lib/utils";
import { ShoppingCart, Plus, Clock, Store, Gavel, TrendingUp, History, Filter } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import { vaultNotify } from "~/lib/vault-notifications";
import { AuctionCardItem } from "./auctions/AuctionCardItem";
import { CreateAuctionModal } from "./auctions/CreateAuctionModal";
import type { MarketAuctionItem } from "./auctions/types";

interface AuctionFilters {
  rarity: string;
  cardType: string;
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

export function VaultAuctionsTab() {
  const [selectedTab, setSelectedTab] = useState("browse");
  const [createAuctionOpen, setCreateAuctionOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [filters, setFilters] = useState<AuctionFilters>({
    rarity: "",
    cardType: "",
    minPrice: "",
    maxPrice: "",
    sortBy: "ending_soon",
  });

  const queryFilters = useMemo(
    () => ({
      rarity: filters.rarity || undefined,
      cardType: filters.cardType || undefined,
      minPrice: filters.minPrice ? parseInt(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
      sortBy: (filters.sortBy || "ending_soon") as
        | "ending_soon"
        | "newest"
        | "price_low"
        | "price_high"
        | undefined,
    }),
    [filters]
  );

  const { data: activeData, isLoading: activeLoading } = api.cardMarket.getActiveAuctions.useQuery({
    ...queryFilters,
    limit: 20,
    offset,
  });

  const { data: endingSoonData, isLoading: endingSoonLoading } =
    api.cardMarket.getEndingSoon.useQuery({ limit: 10 });
  const { data: myListingsData, isLoading: myListingsLoading } =
    api.cardMarket.getMyActiveAuctions.useQuery();
  const { data: myBidsData, isLoading: myBidsLoading } = api.cardMarket.getMyActiveBids.useQuery();
  const { data: historyData, isLoading: historyLoading } =
    api.cardMarket.getMyAuctionParticipation.useQuery({ limit: 50, offset: historyOffset });

  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();

  const utils = api.useUtils();
  const cancelAuction = api.cardMarket.cancelAuction.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data?.message ?? "Auction cancelled");
      void utils.cardMarket.getMyActiveAuctions.invalidate();
      void utils.cardMarket.getActiveAuctions.invalidate();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  useAuctionWebSocket({ enabled: selectedTab === "browse" || selectedTab === "ending" });
  const activeAuctions = (activeData?.auctions ?? []) as any[];
  const endingSoon = (endingSoonData?.auctions ?? []) as any[];
  const myListings = (myListingsData?.auctions ?? []) as any[];
  const myBids = (myBidsData?.auctions ?? []) as any[];
  const myHistory = (historyData?.auctions ?? []) as any[];

  const [selectedAuction, setSelectedAuction] = useState<MarketAuctionItem | null>(null);

  const handleShowDetails = useCallback((auction: MarketAuctionItem) => {
    setSelectedAuction(auction);
  }, []);

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + 20);
  }, []);

  const handleHistoryLoadMore = useCallback(() => {
    setHistoryOffset((prev) => prev + 50);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
    if (value === "history") {
      setHistoryOffset(0);
    }
  }, []);

  const detailCard = useMemo(() => {
    if (!selectedAuction) return null;
    const c = selectedAuction.CardOwnership?.cards;
    if (!c) return null;
    return {
      id: c.id,
      title: c.title ?? "Unknown",
      description: c.description ?? "",
      artwork: c.artwork ?? "/images/cards/placeholder-nation.png",
      artworkVariants: null,
      cardType: c.cardType as any,
      rarity: c.rarity as any,
      season: c.season ?? 1,
      nsCardId: null,
      nsSeason: null,
      nsData: null,
      wikiSource: c.wikiSource ?? null,
      wikiArticleTitle: null,
      wikiUrl: null,
      countryId: c.country?.id ?? null,
      stats: {},
      marketValue: c.marketValue ?? 0,
      totalSupply: c.totalSupply ?? 0,
      level: 1,
      evolutionStage: 0,
      enhancements: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTrade: null,
      country: c.country ?? null,
      owners: [],
    } as CardInstance;
  }, [selectedAuction]);

  return (
    <div className="space-y-6">
      {/* Header with Create Listing button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4.5 w-4.5 text-amber-600 dark:text-amber-500" />
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Auction House
          </h3>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateAuctionOpen(true)}
          className="border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white hover:from-amber-500 hover:to-yellow-500"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Sell Card
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Active Auctions",
            value: activeAuctions.length,
            color: "text-amber-600 dark:text-amber-400",
            icon: Gavel,
          },
          {
            label: "My Listings",
            value: myListings.length,
            color: "text-blue-600 dark:text-blue-400",
            icon: Store,
          },
          {
            label: "My Bids",
            value: myBids.length,
            color: "text-purple-650 dark:text-purple-400",
            icon: TrendingUp,
          },
          {
            label: "My History",
            value: myHistory.length,
            color: "text-green-600 dark:text-green-400",
            icon: History,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-surface glass-refraction border-border/40 relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-black/5 p-2.5 shadow-lg backdrop-blur-md dark:bg-black/40"
          >
            <TextureOverlay texture="dots" opacity={0.03} />
            <stat.icon className={cn("relative z-10 h-4 w-4 shrink-0", stat.color)} />
            <div className="relative z-10 min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[8px] font-bold tracking-wider uppercase">
                {stat.label}
              </p>
              <p className={cn("mt-1 font-mono text-base leading-none font-black", stat.color)}>
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="text-muted-foreground h-3.5 w-3.5" />
        <select
          value={filters.rarity}
          onChange={(e) => {
            setFilters((f) => ({ ...f, rarity: e.target.value }));
            setOffset(0);
          }}
          className="border-border/50 bg-muted/30 text-foreground h-7 rounded-md border px-2 text-[10px] font-medium"
        >
          <option value="">All Rarities</option>
          <option value="COMMON">Common</option>
          <option value="UNCOMMON">Uncommon</option>
          <option value="RARE">Rare</option>
          <option value="EPIC">Epic</option>
          <option value="LEGENDARY">Legendary</option>
          <option value="MYTHIC">Mythic</option>
        </select>
        <select
          value={filters.cardType}
          onChange={(e) => {
            setFilters((f) => ({ ...f, cardType: e.target.value }));
            setOffset(0);
          }}
          className="border-border/50 bg-muted/30 text-foreground h-7 rounded-md border px-2 text-[10px] font-medium"
        >
          <option value="">All Types</option>
          <option value="NATION">Nation</option>
          <option value="LORE">Lore</option>
          <option value="NS_IMPORT">NS Import</option>
          <option value="SPECIAL">Special</option>
        </select>
        <input
          type="number"
          min="0"
          placeholder="Min price"
          value={filters.minPrice}
          onChange={(e) => {
            setFilters((f) => ({ ...f, minPrice: e.target.value }));
            setOffset(0);
          }}
          className="border-border/50 bg-muted/30 text-foreground h-7 w-20 rounded-md border px-2 font-mono text-[10px] placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
        <span className="text-muted-foreground text-[10px]">—</span>
        <input
          type="number"
          min="0"
          placeholder="Max price"
          value={filters.maxPrice}
          onChange={(e) => {
            setFilters((f) => ({ ...f, maxPrice: e.target.value }));
            setOffset(0);
          }}
          className="border-border/50 bg-muted/30 text-foreground h-7 w-20 rounded-md border px-2 font-mono text-[10px] placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => {
            setFilters((f) => ({ ...f, sortBy: e.target.value }));
            setOffset(0);
          }}
          className="border-border/50 bg-muted/30 text-foreground ml-auto h-7 rounded-md border px-2 text-[10px] font-medium"
        >
          <option value="ending_soon">Ending Soon</option>
          <option value="newest">Newest</option>
          <option value="price_low">Price Low-High</option>
          <option value="price_high">Price High-Low</option>
        </select>
      </div>

      {/* Tabs */}
      <Card className="glass-surface border-border/40 bg-black/5 p-4 dark:bg-black/25">
        <Tabs value={selectedTab} onValueChange={handleTabChange}>
          <TabsList className="border-border/50 mb-4 rounded-xl border bg-black/5 p-1 dark:border-white/5 dark:bg-black/40">
            <TabsTrigger
              value="browse"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Browse Auctions
            </TabsTrigger>
            <TabsTrigger
              value="ending"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Ending Soon
            </TabsTrigger>
            <TabsTrigger
              value="listings"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <Store className="mr-1.5 h-3.5 w-3.5" /> My Listings
              {myListings.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {myListings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="bids"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <Gavel className="mr-1.5 h-3.5 w-3.5" /> My Bids
              {myBids.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {myBids.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-muted-foreground data-[state=active]:text-foreground relative px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              <History className="mr-1.5 h-3.5 w-3.5" /> History
              {myHistory.length > 0 && (
                <span className="ml-1.5 rounded-full bg-green-500 px-1.5 py-0 text-[8px] leading-none font-bold text-white">
                  {myHistory.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Browse */}
          <TabsContent value="browse" className="space-y-3 outline-none">
            {activeLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : activeAuctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <ShoppingCart className="text-muted-foreground/20 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Active Auctions</p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[10px]">
                  Be the first to list a card for sale!
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-input hover:bg-accent text-foreground bg-transparent text-xs"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> List a Card
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {activeAuctions.map((auction: MarketAuctionItem) => (
                  <AuctionCardItem
                    key={auction.id}
                    auction={auction}
                    onBid={placeBid}
                    onBuyout={executeBuyout}
                    onShowDetails={handleShowDetails}
                    isBidding={isBidding}
                    isBuyingOut={isBuyingOut}
                  />
                ))}
              </div>
            )}
            {activeData?.hasMore && !activeLoading && (
              <div className="flex justify-center pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadMore}
                  className="border-border/50 hover:bg-accent text-foreground bg-transparent text-[10px]"
                >
                  Load More Auctions
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Ending Soon */}
          <TabsContent value="ending" className="space-y-3 outline-none">
            {endingSoonLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : endingSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Clock className="text-muted-foreground/20 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Auctions Ending Soon</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">Check back later!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {endingSoon.map((auction: MarketAuctionItem) => (
                  <AuctionCardItem
                    key={auction.id}
                    auction={auction}
                    onBid={placeBid}
                    onBuyout={executeBuyout}
                    onShowDetails={handleShowDetails}
                    isBidding={isBidding}
                    isBuyingOut={isBuyingOut}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Listings */}
          <TabsContent value="listings" className="space-y-3 outline-none">
            {myListingsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : myListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Store className="text-muted-foreground/20 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Active Listings</p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[10px]">
                  Sell your card duplicate holdings on the market
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-input hover:bg-accent text-foreground bg-transparent text-xs"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Sell a Card
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myListings.map((auction: MarketAuctionItem) => {
                  const card = auction.CardOwnership?.cards;
                  const currentBid = auction.currentBid ?? auction.startingPrice;
                  const bidCount = auction.AuctionBid?.length ?? 0;
                  return (
                    <div
                      key={auction.id}
                      className="glass-surface flex items-center justify-between rounded-lg border border-amber-500/25 bg-black/5 p-3 dark:bg-black/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <Store className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white/95">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-muted-foreground text-[9px]">
                            {bidCount} bid{bidCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-0.5 font-mono text-sm font-bold text-amber-600 dark:text-amber-500">
                          <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                          {currentBid.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-input hover:bg-destructive/10 hover:text-destructive text-foreground h-7 bg-transparent text-[10px]"
                          disabled={bidCount > 0 || cancelAuction.isPending}
                          title={
                            bidCount > 0
                              ? "Auctions with bids can't be cancelled"
                              : "Cancel this listing"
                          }
                          onClick={() => cancelAuction.mutate({ auctionId: auction.id })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* My Bids */}
          <TabsContent value="bids" className="space-y-3 outline-none">
            {myBidsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg bg-white/5" />
                ))}
              </div>
            ) : myBids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Gavel className="text-muted-foreground/20 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Active Bids</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Browse the auction items and start bidding
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myBids.map((auction: MarketAuctionItem) => {
                  const card = auction.CardOwnership?.cards;
                  const currentBid = auction.currentBid ?? auction.startingPrice;
                  const endTime = new Date(auction.endTime);
                  const minsLeft = Math.max(
                    0,
                    Math.floor((endTime.getTime() - Date.now()) / 60000)
                  );
                  return (
                    <div
                      key={auction.id}
                      className="glass-surface flex items-center justify-between rounded-lg border border-blue-500/25 bg-black/5 p-3 dark:bg-black/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <Gavel className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white/95">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-muted-foreground flex items-center gap-1 text-[9px]">
                            <Clock className="h-2.5 w-2.5" />
                            {minsLeft > 60
                              ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
                              : `${minsLeft}m`}{" "}
                            left
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-0.5 font-mono text-sm font-bold text-blue-500 dark:text-blue-400">
                        <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {currentBid.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-3 outline-none">
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg bg-white/5" />
                ))}
              </div>
            ) : myHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <History className="text-muted-foreground/20 mb-3 h-10 w-10" />
                <p className="text-foreground/80 text-xs font-bold">No Auction History</p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Past auctions you listed or bid on will appear here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myHistory.map((auction: MarketAuctionItem) => {
                  const card = auction.CardOwnership?.cards;
                  const role = auction.participation as string;
                  const badgeLabel =
                    role === "cancelled"
                      ? "Cancelled"
                      : role === "won"
                        ? "Won"
                        : role === "sold"
                          ? "Sold"
                          : "Ended";
                  const badgeColor =
                    role === "cancelled"
                      ? "border-red-500/30 text-red-500"
                      : role === "won"
                        ? "border-green-500/30 text-green-500"
                        : "border-blue-500/30 text-blue-500";
                  return (
                    <div
                      key={auction.id}
                      className="glass-surface flex items-center justify-between rounded-lg border border-green-500/15 bg-black/5 p-3 dark:bg-black/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <History className="h-4 w-4 text-green-500 dark:text-green-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white/95">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-muted-foreground flex items-center gap-1 text-[9px]">
                            {new Date(auction.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0 text-[8px] leading-none font-bold uppercase",
                            badgeColor
                          )}
                        >
                          {badgeLabel}
                        </span>
                        {(auction.finalPrice ?? auction.currentBid) != null && (
                          <span className="flex items-center gap-0.5 font-mono text-sm font-bold text-green-600 dark:text-green-400">
                            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                            {(auction.finalPrice ?? auction.currentBid).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {historyData?.hasMore && !historyLoading && (
              <div className="flex justify-center pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHistoryLoadMore}
                  className="border-border/50 hover:bg-accent text-foreground bg-transparent text-[10px]"
                >
                  Load More History
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <CardDetailsModal
        card={detailCard}
        open={!!selectedAuction}
        onClose={() => setSelectedAuction(null)}
      />
      <CreateAuctionModal open={createAuctionOpen} onClose={() => setCreateAuctionOpen(false)} />
    </div>
  );
}
