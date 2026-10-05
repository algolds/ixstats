"use client";

import React, { useState, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { IxCreditsSymbol } from "../../../IxCreditsSymbol";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { vaultNotify } from "~/lib/vault/vault-notifications";
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
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

interface CreateAuctionModalProps {
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
      inventoryData
        ?.filter((ownership) => !ownership.isLocked)
        .map((ownership) => ({
          id: ownership.cards?.id ?? ownership.id,
          ownershipId: ownership.id,
          title: ownership.cards?.title ?? "Unknown",
          rarity: ownership.cards?.rarity ?? "COMMON",
          artwork: ownership.cards?.artwork || "/images/cards/placeholder-nation.png",
          marketValue: ownership.cards?.marketValue || 0,
          cardType: ownership.cards?.cardType ?? "NS_IMPORT",
        })) || [],
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
    LEGENDARY: "text-yellow",
    EPIC: "text-purple",
    RARE: "text-blue",
    UNCOMMON: "text-green",
    COMMON: "text-label-secondary",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="border-separator bg-surface-elevated text-label max-w-md">
        <DialogHeader>
          <DialogTitle>Create auction listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Card */}
          <div>
            <label className="text-label-secondary text-footnote mb-2 block">
              Select card to sell
            </label>
            {inventoryLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="rounded-control bg-fill-4 h-10" />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <p className="text-label-secondary text-footnote py-3 text-center">
                No cards in inventory
              </p>
            ) : (
              <div className="border-separator rounded-control bg-surface-secondary max-h-48 space-y-1 overflow-y-auto border p-2">
                {cards.length > 0 ? (
                  <FacetListSection variant="plain" aria-label="Cards in inventory">
                    {cards.map((card: any) => (
                      <FacetRow
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        selected={selectedCardId === card.id}
                        selectionStyle="tint"
                        itemClassName="rounded-control-sm overflow-hidden"
                        leading={
                          <span className="bg-fill-3 border-separator relative block h-8 w-8 shrink-0 overflow-hidden rounded border">
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
                          </span>
                        }
                        title={
                          <span className="text-footnote font-semibold">
                            {card.title}
                            <span
                              className={cn(
                                "text-caption ml-2",
                                rarityColor[card.rarity] || "text-label-secondary"
                              )}
                            >
                              {card.rarity}
                            </span>
                          </span>
                        }
                        trailing={
                          <span className="text-footnote text-yellow flex items-center gap-0.5 tabular-nums">
                            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                            {(card.marketValue || 0).toLocaleString()}
                          </span>
                        }
                      />
                    ))}
                  </FacetListSection>
                ) : (
                  <div className="text-footnote text-label-secondary py-6 text-center">
                    No cards available. Your cards are all listed or locked in trades.
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
                  <label className="text-label-secondary text-footnote mb-1 flex items-center gap-1">
                    Starting bid (<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="100"
                    className="border-separator text-label bg-surface-secondary text-footnote h-8 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-label-secondary text-footnote mb-1 block">
                    Buyout price (optional)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={buyoutPrice}
                    onChange={(e) => setBuyoutPrice(e.target.value)}
                    placeholder="None"
                    className="border-separator text-label bg-surface-secondary text-footnote h-8 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-label-secondary text-footnote mb-1 block">
                  Listing duration
                </label>
                <Select value={duration} onValueChange={(v) => setDuration(v as "30" | "60")}>
                  <SelectTrigger className="border-separator text-label bg-surface-secondary text-footnote h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-elevated border-separator text-label">
                    <SelectItem value="30">30 minutes (Express)</SelectItem>
                    <SelectItem value="60">60 minutes (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-label-secondary text-footnote leading-tight">
                Listing fee: 5 IxCredits • Market fee: 10% on sales over 100 IxCredits
              </p>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleClose} className="bg-transparent">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedCardId || !startingPrice || createAuction.isPending}
          >
            {createAuction.isPending ? "Creating..." : "Create listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
