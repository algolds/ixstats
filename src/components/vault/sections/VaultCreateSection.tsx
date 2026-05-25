"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRightLeft,
  Plus,
  Inbox,
  Send,
  History,
  TrendingUp,
  ShoppingCart,
  Clock,
  Layers,
  Gavel,
  Store,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { vaultNotify } from "~/lib/vault-notifications";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import type { CardInstance } from "~/types/cards-display";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";

const TradeOfferModal = dynamic(
  () => import("~/components/cards/trading/TradeOfferModal").then((m) => m.TradeOfferModal),
  { ssr: false }
);
const TradeNegotiation = dynamic(
  () => import("~/components/cards/trading/TradeNegotiation").then((m) => m.TradeNegotiation),
  { ssr: false }
);
const TradeHistory = dynamic(
  () => import("~/components/cards/trading/TradeHistory").then((m) => m.TradeHistory),
  { ssr: false }
);

type SubTab = "trading" | "market";

const SUB_TABS: { id: SubTab; label: string; icon: typeof ArrowRightLeft }[] = [
  { id: "market", label: "Marketplace", icon: ShoppingCart },
  { id: "trading", label: "P2P Trading", icon: ArrowRightLeft },
];

interface VaultCreateSectionProps {
  initialTab?: string | null;
}

// ─── Auction Card (compact) ──────────────────────────────────────

function AuctionCard({
  auction,
  onBid,
  onBuyout,
  isBidding,
  isBuyingOut,
}: {
  auction: any;
  onBid: (auctionId: string, amount: number) => void;
  onBuyout: (auctionId: string) => void;
  isBidding: boolean;
  isBuyingOut: boolean;
}) {
  const card = auction.CardOwnership?.cards;
  const title = card?.title ?? "Unknown Card";
  const rarity = card?.rarity ?? "COMMON";
  const artwork = card?.artwork;
  const currentBid = auction.currentBid ?? auction.startingPrice;
  const bidCount = auction.bidCount ?? auction.AuctionBid?.length ?? 0;
  const endTime = new Date(auction.endTime);
  const now = new Date();
  const msLeft = endTime.getTime() - now.getTime();
  const minsLeft = Math.max(0, Math.floor(msLeft / 60000));
  const isUrgent = minsLeft < 10;

  const rarityColor: Record<string, string> = {
    LEGENDARY: "text-amber-400 border-amber-400/30",
    EPIC: "text-purple-400 border-purple-400/30",
    RARE: "text-blue-400 border-blue-400/30",
    UNCOMMON: "text-green-400 border-green-400/30",
    COMMON: "text-gray-400 border-gray-400/30",
  };
  const colorClass = rarityColor[rarity] ?? "text-cyan-400 border-cyan-400/30";

  return (
    <div
      className={cn(
        "glass-hierarchy-child flex gap-3 rounded-lg border p-3",
        colorClass.split(" ")[1]
      )}
    >
      {/* Artwork thumbnail */}
      <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
        <CardHolographicCover cardType={card?.cardType || "NATION"} rarity={rarity} title={title} />
        {artwork && (
          <img
            src={artwork}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-bold">{title}</span>
          <Badge
            variant="outline"
            className={cn("shrink-0 px-1 py-0 text-[8px]", colorClass.split(" ")[0])}
          >
            {rarity}
          </Badge>
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-[0.6rem]">
          <span>
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </span>
          <span className={cn("flex items-center gap-0.5", isUrgent ? "text-red-400" : "")}>
            <Clock className="h-2.5 w-2.5" />
            {minsLeft > 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-amber-400">
            {currentBid.toLocaleString()} IxC
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[0.6rem]"
              onClick={() => onBid(auction.id, currentBid + 1)}
              disabled={isBidding}
            >
              <Gavel className="mr-1 h-2.5 w-2.5" /> Bid
            </Button>
            {auction.buyoutPrice && (
              <Button
                size="sm"
                className="h-6 px-2 text-[0.6rem]"
                onClick={() => onBuyout(auction.id)}
                disabled={isBuyingOut}
              >
                Buy {auction.buyoutPrice.toLocaleString()}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Auction Modal ────────────────────────────────────────

function CreateAuctionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [startingPrice, setStartingPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [duration, setDuration] = useState<"30" | "60">("60");

  const utils = api.useUtils();

  const { data: inventoryData, isLoading: inventoryLoading } = api.cards.getMyCards.useQuery(
    { sortBy: "value" },
    { enabled: open }
  );

  const cards: CardInstance[] = useMemo(
    () =>
      (inventoryData?.map((ownership: any) => ({
        id: ownership.cards?.id ?? ownership.id,
        title: ownership.cards?.title ?? "Unknown",
        rarity: ownership.cards?.rarity ?? "COMMON",
        artwork: ownership.cards?.artwork || "/images/cards/placeholder-nation.png",
        marketValue: ownership.cards?.marketValue || 0,
        cardType: ownership.cards?.cardType ?? "NS_IMPORT",
      })) as CardInstance[]) || [],
    [inventoryData]
  );

  const createAuction = api.cardMarket.createAuction.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message ?? "Auction created!");
      void utils.cardMarket.getActiveAuctions.invalidate();
      void utils.cardMarket.getMyActiveAuctions.invalidate();
      handleClose();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const handleClose = () => {
    setSelectedCardId(null);
    setStartingPrice("");
    setBuyoutPrice("");
    setDuration("60");
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedCardId || !startingPrice) return;
    const sp = parseInt(startingPrice);
    const bp = buyoutPrice ? parseInt(buyoutPrice) : undefined;
    if (isNaN(sp) || sp < 1) return;
    if (bp !== undefined && (isNaN(bp) || bp <= sp)) {
      vaultNotify.error("Buyout price must be greater than starting price");
      return;
    }
    createAuction.mutate({
      cardId: selectedCardId,
      startingPrice: sp,
      buyoutPrice: bp,
      duration,
    });
  };

  const rarityColor: Record<string, string> = {
    LEGENDARY: "text-amber-400",
    EPIC: "text-purple-400",
    RARE: "text-blue-400",
    UNCOMMON: "text-green-400",
    COMMON: "text-gray-400",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Create Auction Listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Card */}
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Select Card
            </label>
            {inventoryLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-xs">
                No cards in inventory
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1.5">
                {cards.map((card: any) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-all",
                      selectedCardId === card.id
                        ? "bg-emerald-500/20 ring-1 ring-emerald-400/50"
                        : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-muted relative h-8 w-8 shrink-0 overflow-hidden rounded">
                        <CardHolographicCover
                          cardType={card.cardType}
                          rarity={card.rarity}
                          title={card.title}
                        />
                        {card.artwork && (
                          <img
                            src={card.artwork}
                            alt={card.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold">{card.title}</span>
                        <span
                          className={cn(
                            "ml-2 text-[0.6rem]",
                            rarityColor[card.rarity] || "text-gray-400"
                          )}
                        >
                          {card.rarity}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-amber-400">
                      {(card.marketValue || 0).toLocaleString()} IxC
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Pricing */}
          {selectedCardId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                    Starting Price (IxC)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="1"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                    Buyout Price (optional)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={buyoutPrice}
                    onChange={(e) => setBuyoutPrice(e.target.value)}
                    placeholder="None"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  Duration
                </label>
                <Select value={duration} onValueChange={(v) => setDuration(v as "30" | "60")}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes (Express)</SelectItem>
                    <SelectItem value="60">60 minutes (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-muted-foreground text-[0.6rem]">
                Listing fee: 5 IxC • Market fee: 10% on sales over 100 IxC
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedCardId || !startingPrice || createAuction.isPending}
            className="text-xs"
          >
            {createAuction.isPending ? "Creating..." : "Create Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Market Tab (moved from VaultAcquireSection) ─────────────────

function MarketTab() {
  const [selectedTab, setSelectedTab] = useState("browse");
  const [createAuctionOpen, setCreateAuctionOpen] = useState(false);

  const { data: activeData, isLoading: activeLoading } = api.cardMarket.getActiveAuctions.useQuery({
    limit: 20,
    offset: 0,
  });
  const { data: endingSoonData, isLoading: endingSoonLoading } =
    api.cardMarket.getEndingSoon.useQuery({ limit: 10 });
  const { data: myListingsData, isLoading: myListingsLoading } =
    api.cardMarket.getMyActiveAuctions.useQuery();
  const { data: myBidsData, isLoading: myBidsLoading } = api.cardMarket.getMyActiveBids.useQuery();

  const { placeBid, executeBuyout, isBidding, isBuyingOut } = useAuctionBid();

  const activeAuctions = activeData?.auctions ?? [];
  const endingSoon = endingSoonData?.auctions ?? [];
  const myListings = myListingsData?.auctions ?? [];
  const myBids = myBidsData?.auctions ?? [];

  return (
    <div className="space-y-4">
      {/* Header with Create Listing button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-bold">Marketplace</span>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateAuctionOpen(true)}
          className="glass-hierarchy-interactive text-xs"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Listing
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Active Auctions",
            value: activeAuctions.length,
            color: "text-cyan-400",
            icon: Gavel,
          },
          { label: "My Listings", value: myListings.length, color: "text-amber-400", icon: Store },
          { label: "My Bids", value: myBids.length, color: "text-blue-400", icon: TrendingUp },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-hierarchy-child flex items-center gap-2.5 rounded-lg p-2.5"
          >
            <stat.icon className={cn("h-3.5 w-3.5 shrink-0", stat.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[0.65rem]">{stat.label}</p>
              <p className={cn("text-lg leading-tight font-bold", stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Card className="glass-hierarchy-child p-3">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="glass-hierarchy-child mb-3">
            <TabsTrigger value="browse" className="px-3 py-1.5 text-xs">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Browse
            </TabsTrigger>
            <TabsTrigger value="ending" className="px-3 py-1.5 text-xs">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Ending Soon
            </TabsTrigger>
            <TabsTrigger value="listings" className="px-3 py-1.5 text-xs">
              <Store className="mr-1.5 h-3.5 w-3.5" /> My Listings
              {myListings.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0 text-[9px] font-semibold text-white">
                  {myListings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bids" className="px-3 py-1.5 text-xs">
              <Gavel className="mr-1.5 h-3.5 w-3.5" /> My Bids
              {myBids.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 py-0 text-[9px] font-semibold text-white">
                  {myBids.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Browse */}
          <TabsContent value="browse" className="space-y-2">
            {activeLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : activeAuctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <ShoppingCart className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-foreground/80 text-xs font-semibold">No Active Auctions</p>
                <p className="text-muted-foreground mb-2 text-[0.6rem]">
                  Be the first to list a card for sale!
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-1.5 h-3 w-3" /> Create Listing
                </Button>
              </div>
            ) : (
              activeAuctions.map((auction: any) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onBid={placeBid}
                  onBuyout={executeBuyout}
                  isBidding={isBidding}
                  isBuyingOut={isBuyingOut}
                />
              ))
            )}
          </TabsContent>

          {/* Ending Soon */}
          <TabsContent value="ending" className="space-y-2">
            {endingSoonLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : endingSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Clock className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-foreground/80 text-xs font-semibold">No Auctions Ending Soon</p>
                <p className="text-muted-foreground text-[0.6rem]">Check back in a bit</p>
              </div>
            ) : (
              endingSoon.map((auction: any) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onBid={placeBid}
                  onBuyout={executeBuyout}
                  isBidding={isBidding}
                  isBuyingOut={isBuyingOut}
                />
              ))
            )}
          </TabsContent>

          {/* My Listings */}
          <TabsContent value="listings" className="space-y-2">
            {myListingsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : myListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Store className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-foreground/80 text-xs font-semibold">No Active Listings</p>
                <p className="text-muted-foreground mb-2 text-[0.6rem]">
                  List your cards for sale on the marketplace
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setCreateAuctionOpen(true)}
                >
                  <Plus className="mr-1.5 h-3 w-3" /> Create Listing
                </Button>
              </div>
            ) : (
              myListings.map((auction: any) => {
                const card = auction.CardOwnership?.cards;
                const currentBid = auction.currentBid ?? auction.startingPrice;
                const bidCount = auction.AuctionBid?.length ?? 0;
                return (
                  <div
                    key={auction.id}
                    className="glass-hierarchy-child flex items-center justify-between rounded-lg border border-amber-400/20 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className="h-3.5 w-3.5 text-amber-400" />
                      <div>
                        <span className="text-xs font-bold">{card?.title ?? "Unknown"}</span>
                        <p className="text-muted-foreground text-[0.6rem]">
                          {bidCount} bid{bidCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-400">
                      {currentBid.toLocaleString()} IxC
                    </span>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* My Bids */}
          <TabsContent value="bids" className="space-y-2">
            {myBidsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : myBids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <Gavel className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-foreground/80 text-xs font-semibold">No Active Bids</p>
                <p className="text-muted-foreground text-[0.6rem]">
                  Browse auctions and place your first bid
                </p>
              </div>
            ) : (
              myBids.map((auction: any) => {
                const card = auction.CardOwnership?.cards;
                const currentBid = auction.currentBid ?? auction.startingPrice;
                const endTime = new Date(auction.endTime);
                const minsLeft = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 60000));
                return (
                  <div
                    key={auction.id}
                    className="glass-hierarchy-child flex items-center justify-between rounded-lg border border-blue-400/20 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Gavel className="h-3.5 w-3.5 text-blue-400" />
                      <div>
                        <span className="text-xs font-bold">{card?.title ?? "Unknown"}</span>
                        <p className="text-muted-foreground flex items-center gap-1 text-[0.6rem]">
                          <Clock className="h-2.5 w-2.5" />
                          {minsLeft > 60
                            ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
                            : `${minsLeft}m`}{" "}
                          left
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-blue-400">
                      {currentBid.toLocaleString()} IxC
                    </span>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <CreateAuctionModal open={createAuctionOpen} onClose={() => setCreateAuctionOpen(false)} />
    </div>
  );
}

// ─── Trading Tab ─────────────────────────────────────────────────

function TradingTab() {
  const [createTradeOpen, setCreateTradeOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const { userId } = useAuth();

  const {
    data: activeTrades,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = api.trading.getActiveTrades.useQuery();
  const { data: history } = api.trading.getTradeHistory.useQuery({ limit: 10 });

  const incomingTrades = activeTrades?.filter((t: any) => t.recipientId === userId) || [];
  const outgoingTrades = activeTrades?.filter((t: any) => t.initiatorId === userId) || [];

  const completedTrades = history?.trades.filter((t: any) => t.status === "ACCEPTED").length || 0;
  const totalTrades = (history?.total || 0) + (activeTrades?.length || 0);
  const successRate = totalTrades > 0 ? ((completedTrades / totalTrades) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-bold">Trading Hub</span>
        </div>
        <Button
          onClick={() => setCreateTradeOpen(true)}
          className="glass-hierarchy-interactive"
          size="sm"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Trade
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Active Trades",
            value: activeTrades?.length || 0,
            color: "text-blue-400",
            icon: ArrowRightLeft,
          },
          { label: "Completed", value: completedTrades, color: "text-green-400", icon: History },
          {
            label: "Success Rate",
            value: `${successRate}%`,
            color: "text-amber-400",
            icon: TrendingUp,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-hierarchy-child flex items-center gap-2.5 rounded-lg p-2.5"
          >
            <stat.icon className={cn("h-3.5 w-3.5 shrink-0", stat.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[0.65rem]">{stat.label}</p>
              <p className={cn("text-lg leading-tight font-bold", stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Card className="glass-hierarchy-child p-3">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="glass-hierarchy-child mb-3">
            <TabsTrigger value="active" className="relative px-3 py-1.5 text-xs">
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Active
              {activeTrades && activeTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 py-0 text-[9px] font-semibold text-white">
                  {activeTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="relative px-3 py-1.5 text-xs">
              <Inbox className="mr-1.5 h-3.5 w-3.5" /> Incoming
              {incomingTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-green-500 px-1.5 py-0 text-[9px] font-semibold text-white">
                  {incomingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="relative px-3 py-1.5 text-xs">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Outgoing
              {outgoingTrades.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0 text-[9px] font-semibold text-white">
                  {outgoingTrades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative px-3 py-1.5 text-xs">
              <History className="mr-1.5 h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {activeLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : activeTrades && activeTrades.length > 0 ? (
              activeTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={trade.recipientId === userId}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg py-6 text-center">
                <ArrowRightLeft className="text-muted-foreground/20 mx-auto mb-2 h-8 w-8" />
                <p className="text-foreground/80 mb-1 text-xs font-semibold">No Active Trades</p>
                <p className="text-muted-foreground mb-3 text-[0.65rem]">
                  Start trading by creating a new offer
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  size="sm"
                  className="glass-hierarchy-interactive text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-3">
            {incomingTrades.length > 0 ? (
              incomingTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={true}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg py-6 text-center">
                <Inbox className="text-muted-foreground/20 mx-auto mb-2 h-8 w-8" />
                <p className="text-foreground/80 mb-1 text-xs font-semibold">No Incoming Trades</p>
                <p className="text-muted-foreground text-[0.65rem]">
                  You don&apos;t have any trade offers to review
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-3">
            {outgoingTrades.length > 0 ? (
              outgoingTrades.map((trade: any) => (
                <TradeNegotiation
                  key={trade.id}
                  tradeId={trade.id}
                  isRecipient={false}
                  onRefresh={refetchActive}
                />
              ))
            ) : (
              <div className="glass-hierarchy-child rounded-lg py-6 text-center">
                <Send className="text-muted-foreground/20 mx-auto mb-2 h-8 w-8" />
                <p className="text-foreground/80 mb-1 text-xs font-semibold">No Outgoing Trades</p>
                <p className="text-muted-foreground mb-3 text-[0.65rem]">
                  You haven&apos;t sent any trade offers yet
                </p>
                <Button
                  onClick={() => setCreateTradeOpen(true)}
                  size="sm"
                  className="glass-hierarchy-interactive text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Trade Offer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <TradeHistory />
          </TabsContent>
        </Tabs>
      </Card>

      <TradeOfferModal
        open={createTradeOpen}
        onClose={() => {
          setCreateTradeOpen(false);
          refetchActive();
        }}
      />
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "trading") return "trading";
  return "market";
}

export function VaultCreateSection({ initialTab }: VaultCreateSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-4">
      <div className="glass-hierarchy-child flex gap-1 overflow-x-auto rounded-lg p-1">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all",
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "market" && <MarketTab />}
          {activeTab === "trading" && <TradingTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
