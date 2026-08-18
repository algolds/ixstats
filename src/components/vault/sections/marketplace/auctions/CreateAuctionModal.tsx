"use client";

import React, { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { IxCreditsSymbol } from "../../../IxCreditsSymbol";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { proxyCardArtwork } from "~/lib/ns-image-proxy";
import { vaultNotify } from "~/lib/vault";
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

export interface CreateAuctionModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAuctionModal({ open, onClose }: CreateAuctionModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [startingPrice, setStartingPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [duration, setDuration] = useState<"30" | "60">("60");

  const utils = api.useUtils();

  const { data: inventoryData, isLoading: inventoryLoading } = api.cards.getMyCards.useQuery(
    { sortBy: "value" },
    { enabled: open }
  );

  const cards = useMemo(
    () =>
      (inventoryData
        ?.filter((ownership) => !ownership.isLocked)
        .map((ownership) => ({
          id: ownership.cards?.id ?? ownership.id,
          ownershipId: ownership.id,
          title: ownership.cards?.title ?? "Unknown",
          rarity: ownership.cards?.rarity ?? "COMMON",
          artwork: ownership.cards?.artwork || "/images/cards/placeholder-nation.png",
          marketValue: ownership.cards?.marketValue || 0,
          cardType: ownership.cards?.cardType ?? "NS_IMPORT",
        }))) || [],
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
    const selectedCard = cards.find((c) => c.id === selectedCardId);
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
                {cards.length > 0 ? (
                  cards.map((card: any) => (
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
                              src={proxyCardArtwork(card.artwork)}
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
                  ))
                ) : (
                  <div className="py-6 text-center text-[10px] text-slate-400">
                    No available cards — all your cards are either already listed or locked in
                    trades
                  </div>
                )}
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
