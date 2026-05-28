"use client";

import { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { ShoppingCart, Plus, Clock, Store, Gavel, TrendingUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import type { CardInstance } from "~/types/cards-display";
import { vaultNotify } from "~/lib/vault-notifications";
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
    LEGENDARY: "text-amber-600 dark:text-amber-400 border-amber-500/30",
    EPIC: "text-purple-650 dark:text-purple-400 border-purple-450/30 dark:border-purple-500/30",
    RARE: "text-blue-600 dark:text-blue-400 border-blue-500/30",
    UNCOMMON: "text-green-600 dark:text-green-400 border-green-500/30",
    COMMON: "text-slate-500 dark:text-slate-400 border-slate-500/20",
  };
  const colorClass = rarityColor[rarity] ?? "text-cyan-600 dark:text-cyan-400 border-cyan-500/30";

  return (
    <div
      className={cn(
        "glass-surface relative flex gap-3 overflow-hidden rounded-lg border bg-black/5 p-3 dark:bg-black/20",
        colorClass.split(" ")[1]
      )}
    >
      <TextureOverlay texture="dots" opacity={0.015} />

      {/* Artwork thumbnail */}
      <div className="bg-muted border-border/50 relative h-14 w-14 shrink-0 overflow-hidden rounded-md border dark:border-white/5">
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
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-bold text-slate-900 dark:text-white/95">
            {title}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 px-1 py-0 text-[8px] font-bold uppercase",
              colorClass.split(" ")[0]
            )}
          >
            {rarity}
          </Badge>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
          <span>
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              isUrgent ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3" />
            {minsLeft > 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`}
          </span>
        </div>
      </div>

      {/* Bidding Actions */}
      <div className="relative z-10 flex flex-col items-end justify-between gap-2 select-none">
        <div className="text-right">
          <span className="text-muted-foreground block text-[9px] leading-none">Current Bid</span>
          <span className="mt-0.5 flex items-center justify-end gap-0.5 text-sm leading-none font-black text-amber-600 dark:text-amber-400">
            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
            {currentBid.toLocaleString()}
          </span>
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={() => onBid(auction.id, currentBid + 10)}
            disabled={isBidding}
            className="bg-secondary border-border/50 hover:bg-secondary/80 h-6 border px-2 text-[10px] text-slate-800 dark:border-slate-700/60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            Bid +10 IxC
          </Button>
          {auction.buyoutPrice && (
            <Button
              size="sm"
              onClick={() => onBuyout(auction.id)}
              disabled={isBuyingOut}
              className="h-6 border-none bg-gradient-to-r from-amber-600 to-yellow-600 px-2 text-[10px] font-bold text-white hover:from-amber-500 hover:to-yellow-500"
            >
              Buy {auction.buyoutPrice.toLocaleString()} IxC
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Auction Modal ────────────────────────────────────────
interface CreateAuctionModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateAuctionModal({ open, onClose }: CreateAuctionModalProps) {
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
        ownershipId: ownership.id,
        title: ownership.cards?.title ?? "Unknown",
        rarity: ownership.cards?.rarity ?? "COMMON",
        artwork: ownership.cards?.artwork || "/images/cards/placeholder-nation.png",
        marketValue: ownership.cards?.marketValue || 0,
        cardType: ownership.cards?.cardType ?? "NS_IMPORT",
      })) as unknown as CardInstance[]) || [],
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
    const selectedCard = cards.find((c: any) => c.id === selectedCardId) as any;
    if (!selectedCard) return;

    const sp = parseInt(startingPrice);
    const bp = buyoutPrice ? parseInt(buyoutPrice) : undefined;
    if (isNaN(sp) || sp < 1) return;
    if (bp !== undefined && (isNaN(bp) || bp <= sp)) {
      vaultNotify.error("Buyout price must be greater than starting price");
      return;
    }
    createAuction.mutate({
      cardId: selectedCard.ownershipId,
      startingPrice: sp,
      buyoutPrice: bp,
      duration,
    });
  };

  const rarityColor: Record<string, string> = {
    LEGENDARY: "text-amber-600 dark:text-amber-400",
    EPIC: "text-purple-600 dark:text-purple-400",
    RARE: "text-blue-600 dark:text-blue-400",
    UNCOMMON: "text-green-600 dark:text-green-400",
    COMMON: "text-slate-500 dark:text-slate-400",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-md backdrop-blur-md dark:bg-slate-900/98">
        <DialogHeader>
          <DialogTitle className="text-sm font-black tracking-wider text-amber-600 uppercase dark:text-amber-500">
            Create Auction Listing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Card */}
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
              Select Card to Sell
            </label>
            {inventoryLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 rounded-lg bg-white/5" />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-xs">
                No cards in inventory
              </p>
            ) : (
              <div className="border-border/50 max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-black/5 p-1.5 dark:border-white/10 dark:bg-black/40">
                {cards.map((card: any) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-all",
                      selectedCardId === card.id
                        ? "bg-amber-500/10 ring-1 ring-amber-500/35 dark:bg-amber-500/20 dark:ring-amber-400/50"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-muted border-border/50 relative h-8 w-8 shrink-0 overflow-hidden rounded border dark:border-white/5">
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
                        <span className="text-xs font-semibold text-slate-900 dark:text-white/90">
                          {card.title}
                        </span>
                        <span
                          className={cn(
                            "ml-2 text-[8px] font-bold uppercase",
                            rarityColor[card.rarity] || "text-slate-400"
                          )}
                        >
                          {card.rarity}
                        </span>
                      </div>
                    </div>
                    <span className="flex items-center gap-0.5 font-mono text-xs text-amber-600 dark:text-amber-400">
                      <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                      {(card.marketValue || 0).toLocaleString()}
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
                  <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Starting Bid (IxC)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="100"
                    className="border-input text-foreground h-8 bg-black/5 font-mono text-xs dark:bg-black/20"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Buyout Price (optional)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={buyoutPrice}
                    onChange={(e) => setBuyoutPrice(e.target.value)}
                    placeholder="None"
                    className="border-input text-foreground h-8 bg-black/5 font-mono text-xs dark:bg-black/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Listing Duration
                </label>
                <Select value={duration} onValueChange={(v) => setDuration(v as "30" | "60")}>
                  <SelectTrigger className="border-input text-foreground h-8 w-full bg-black/5 text-xs dark:bg-black/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
                    <SelectItem value="30">30 minutes (Express)</SelectItem>
                    <SelectItem value="60">60 minutes (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-muted-foreground text-[10px] leading-tight">
                Listing fee: 5 IxCredits • Market fee: 10% on sales over 100 IxCredits
              </p>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="border-input text-foreground hover:bg-accent bg-transparent text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedCardId || !startingPrice || createAuction.isPending}
            className="border-none bg-gradient-to-r from-amber-600 to-yellow-600 text-xs font-bold text-white"
          >
            {createAuction.isPending ? "Creating..." : "Create Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Auctions Tab Component ─────────────────────────────────
export function VaultAuctionsTab() {
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
      <div className="grid grid-cols-3 gap-3">
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

      {/* Tabs */}
      <Card className="glass-surface border-border/40 bg-black/5 p-4 dark:bg-black/25">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
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
                {activeAuctions.map((auction: any) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    onBid={placeBid}
                    onBuyout={executeBuyout}
                    isBidding={isBidding}
                    isBuyingOut={isBuyingOut}
                  />
                ))}
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
                {endingSoon.map((auction: any) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    onBid={placeBid}
                    onBuyout={executeBuyout}
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
                {myListings.map((auction: any) => {
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
                      <span className="flex items-center gap-0.5 font-mono text-sm font-bold text-amber-600 dark:text-amber-500">
                        <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {currentBid.toLocaleString()}
                      </span>
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
                {myBids.map((auction: any) => {
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
        </Tabs>
      </Card>

      <CreateAuctionModal open={createAuctionOpen} onClose={() => setCreateAuctionOpen(false)} />
    </div>
  );
}
