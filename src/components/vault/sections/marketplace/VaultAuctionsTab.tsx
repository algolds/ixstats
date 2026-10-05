"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "~/lib/utils";
import {
  Cart as ShoppingCart,
  Plus,
  Clock,
  Shop as Store,
  Hammer as Gavel,
  StatUp as TrendingUp,
  ClockRotateRight as History,
  Filter,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { Stat } from "~/components/ui/stat";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import { CardRarity } from "~/lib/cards/enums";
import { getRarityConfig, CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { AuctionCardItem } from "./auctions/AuctionCardItem";
import { CreateAuctionModal } from "./auctions/CreateAuctionModal";
import type { MarketAuctionItem } from "./auctions/types";
import { Card, CardTitle } from "~/components/ui/card";

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
        "ending_soon" | "newest" | "price_low" | "price_high" | undefined,
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
      artwork: c.artwork ?? CARD_ARTWORK_PLACEHOLDER,
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
        <CardTitle icon={<ShoppingCart />}>Auction house</CardTitle>
        <Button size="sm" onClick={() => setCreateAuctionOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Sell card
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Active auctions",
            value: activeAuctions.length,
            color: "text-yellow",
            icon: Gavel,
          },
          {
            label: "My listings",
            value: myListings.length,
            color: "text-blue",
            icon: Store,
          },
          {
            label: "My bids",
            value: myBids.length,
            color: "text-indigo",
            icon: TrendingUp,
          },
          {
            label: "My history",
            value: myHistory.length,
            color: "text-green",
            icon: History,
          },
        ].map((stat) => (
          <Card key={stat.label} padding="sm" className="flex items-center gap-3">
            <stat.icon className={cn("size-4 shrink-0", stat.color)} aria-hidden />
            <Stat size="sm" label={stat.label} value={stat.value} className="min-w-0 flex-1" />
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="text-label-secondary size-4" aria-hidden />
        <Select
          value={filters.rarity || "all"}
          onValueChange={(value) => {
            setFilters((f) => ({ ...f, rarity: value === "all" ? "" : value }));
            setOffset(0);
          }}
        >
          <SelectTrigger size="sm" aria-label="Rarity" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rarities</SelectItem>
            {Object.values(CardRarity).map((rarity) => (
              <SelectItem key={rarity} value={rarity}>
                {getRarityConfig(rarity).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.cardType || "all"}
          onValueChange={(value) => {
            setFilters((f) => ({ ...f, cardType: value === "all" ? "" : value }));
            setOffset(0);
          }}
        >
          <SelectTrigger size="sm" aria-label="Card type" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="NATION">Nation</SelectItem>
            <SelectItem value="LORE">Lore</SelectItem>
            <SelectItem value="NS_IMPORT">NS import</SelectItem>
            <SelectItem value="SPECIAL">Special</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0"
          placeholder="Min price"
          value={filters.minPrice}
          onChange={(e) => {
            setFilters((f) => ({ ...f, minPrice: e.target.value }));
            setOffset(0);
          }}
          className="h-(--control-height-sm) w-24 tabular-nums"
        />
        <span className="text-label-secondary text-footnote">–</span>
        <Input
          type="number"
          min="0"
          placeholder="Max price"
          value={filters.maxPrice}
          onChange={(e) => {
            setFilters((f) => ({ ...f, maxPrice: e.target.value }));
            setOffset(0);
          }}
          className="h-(--control-height-sm) w-24 tabular-nums"
        />
        <Select
          value={filters.sortBy || "all"}
          onValueChange={(value) => {
            setFilters((f) => ({ ...f, sortBy: value === "all" ? "" : value }));
            setOffset(0);
          }}
        >
          <SelectTrigger size="sm" aria-label="Sort" className="ml-auto w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ending_soon">Ending soon</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_low">Price Low-High</SelectItem>
            <SelectItem value="price_high">Price High-Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Card padding="md">
        <Tabs value={selectedTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="browse">
              <ShoppingCart className="mr-2 h-3.5 w-3.5" /> Browse auctions
            </TabsTrigger>
            <TabsTrigger value="ending">
              <Clock className="mr-2 h-3.5 w-3.5" /> Ending soon
            </TabsTrigger>
            <TabsTrigger value="listings" className="relative">
              <Store className="mr-2 h-3.5 w-3.5" /> My listings
              {myListings.length > 0 && (
                <span className="bg-tint text-caption text-on-tint ml-2 rounded-full px-2 leading-4 tabular-nums">
                  {myListings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bids" className="relative">
              <Gavel className="mr-2 h-3.5 w-3.5" /> My bids
              {myBids.length > 0 && (
                <span className="bg-blue text-footnote text-on-blue ml-2 rounded-full px-2 py-0 leading-none font-semibold">
                  {myBids.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative">
              <History className="mr-2 h-3.5 w-3.5" /> History
              {myHistory.length > 0 && (
                <span className="bg-green text-footnote text-on-green ml-2 rounded-full px-2 py-0 leading-none font-semibold">
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
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-20" />
                ))}
              </div>
            ) : activeAuctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <ShoppingCart className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No active auctions</p>
                <p className="text-label-secondary text-footnote mt-0.5 mb-3">
                  No cards are listed for sale.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> List a Card
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
                  className="bg-transparent"
                >
                  Load more auctions
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Ending Soon */}
          <TabsContent value="ending" className="space-y-3 outline-none">
            {endingSoonLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-20" />
                ))}
              </div>
            ) : endingSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Clock className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No auctions ending soon</p>
                <p className="text-label-secondary text-footnote mt-0.5">
                  No auctions are ending soon.
                </p>
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
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-20" />
                ))}
              </div>
            ) : myListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Store className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No active listings</p>
                <p className="text-label-secondary text-footnote mt-0.5 mb-3">
                  Sell your card duplicate holdings on the market
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> Sell a Card
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
                      className="rounded-control border-yellow/25 bg-surface-secondary flex items-center justify-between border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="text-tint h-4 w-4" />
                        <div>
                          <span className="text-footnote text-label font-semibold">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-label-secondary text-footnote">
                            {bidCount} bid{bidCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-headline text-yellow flex items-center gap-0.5 tabular-nums">
                          <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                          {currentBid.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="hover:bg-destructive/10 hover:text-destructive bg-transparent"
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
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-20" />
                ))}
              </div>
            ) : myBids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Gavel className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No active bids</p>
                <p className="text-label-secondary text-footnote mt-0.5">
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
                    // oxlint-disable-next-line
                    Math.floor((endTime.getTime() - Date.now()) / 60000)
                  );
                  return (
                    <div
                      key={auction.id}
                      className="rounded-control border-blue/25 bg-surface-secondary flex items-center justify-between border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Gavel className="text-blue h-4 w-4" />
                        <div>
                          <span className="text-footnote text-label font-semibold">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-label-secondary text-footnote flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {minsLeft > 60
                              ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
                              : `${minsLeft}m`}{" "}
                            left
                          </p>
                        </div>
                      </div>
                      <span className="text-headline text-blue flex items-center gap-0.5 tabular-nums">
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
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-20" />
                ))}
              </div>
            ) : myHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <History className="text-label-tertiary mb-3 h-10 w-10" />
                <p className="text-label text-footnote font-semibold">No auction history</p>
                <p className="text-label-secondary text-footnote mt-0.5">
                  You have not listed or bid on any auctions yet
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
                      ? "border-red/30 text-red"
                      : role === "won"
                        ? "border-green/30 text-green"
                        : "border-blue/30 text-blue";
                  return (
                    <div
                      key={auction.id}
                      className="rounded-control border-green/15 bg-surface-secondary flex items-center justify-between border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <History className="text-green h-4 w-4" />
                        <div>
                          <span className="text-footnote text-label font-semibold">
                            {card?.title ?? "Unknown"}
                          </span>
                          <p className="text-label-secondary text-footnote flex items-center gap-1">
                            {auction.updatedAt
                              ? new Date(auction.updatedAt).toLocaleDateString()
                              : new Date(auction.endTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-caption rounded-full border px-2 py-0 leading-none",
                            badgeColor
                          )}
                        >
                          {badgeLabel}
                        </span>
                        {(auction.finalPrice ?? auction.currentBid) != null && (
                          <span className="text-headline text-green flex items-center gap-0.5 tabular-nums">
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
                  className="bg-transparent"
                >
                  Load more history
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
