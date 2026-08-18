"use client";

import React from "react";
import { motion } from "motion/react";
import { BarChart3, History, Package, Award, Gift, ArrowRightLeft, ShoppingBag, Star } from "lucide-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { CardPriceHistoryChart } from "../CardPriceHistoryChart";
import type { CardInstance } from "~/types/cards-display";

export interface TransferEvent {
  id: string;
  action: string;
  fromUserName?: string | null;
  toUserName?: string | null;
  price?: number | null;
  createdAt: string | Date;
}

export function CardMarketTab({
  card,
  rarityConfig,
  isLoadingProvenance,
  provenanceEvents,
}: {
  card: CardInstance;
  rarityConfig: { color: string };
  isLoadingProvenance?: boolean;
  provenanceEvents?: TransferEvent[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="glass-hierarchy-child rounded-lg p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5" />
          Market History
        </h3>

        {/* Market stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="glass-hierarchy-child rounded-lg p-4">
            <p className="text-muted-foreground mb-1 text-xs">Current Value</p>
            <p className={cn("flex items-baseline gap-1 text-2xl font-bold", rarityConfig.color)}>
              <IxCreditsSymbol size="1em" variant="ic" />
              {card.marketValue.toLocaleString()}
            </p>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-4">
            <p className="text-muted-foreground mb-1 text-xs">Total Supply</p>
            <p className="text-foreground text-2xl font-bold">
              {card.totalSupply.toLocaleString()}
            </p>
          </div>
          <div className="glass-hierarchy-child rounded-lg p-4">
            <p className="text-muted-foreground mb-1 text-xs">Last Trade</p>
            <p className="text-foreground text-sm font-semibold">
              {card.lastTrade ? new Date(card.lastTrade).toLocaleDateString() : "Never"}
            </p>
          </div>
        </div>

        {/* Market chart */}
        <div className="mt-4">
          <CardPriceHistoryChart cardId={card.id} />
        </div>
      </div>

      {/* Provenance & Ownership Timeline */}
      <div className="glass-hierarchy-child rounded-lg p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
          <History className="h-5 w-5 text-amber-500" />
          Provenance & Ownership History
        </h3>

        {isLoadingProvenance ? (
          <div className="flex h-32 items-center justify-center">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : !provenanceEvents || provenanceEvents.length === 0 ? (
          <div className="text-muted-foreground flex h-24 items-center justify-center text-xs">
            No ownership transfer events recorded for this card
          </div>
        ) : (
          <div className="relative ml-3 space-y-6 border-l border-border/60 pl-6">
            {provenanceEvents.map((event) => {
              let icon = <Package className="h-4 w-4 text-white" />;
              let actionLabel = "Transferred";
              let colorClass = "bg-blue-500";

              if (event.action === "PACK_OPEN") {
                icon = <Package className="h-4 w-4 text-white" />;
                actionLabel = "Pulled from Card Pack";
                colorClass = "bg-purple-500";
              } else if (event.action === "DAILY_CLAIM") {
                icon = <Award className="h-4 w-4 text-white" />;
                actionLabel = "Claimed as Daily Bonus";
                colorClass = "bg-yellow-500";
              } else if (event.action === "GIFT") {
                icon = <Gift className="h-4 w-4 text-white" />;
                actionLabel = event.fromUserName
                  ? `Gifted from ${event.fromUserName} to ${event.toUserName}`
                  : `Gifted to ${event.toUserName}`;
                colorClass = "bg-pink-500";
              } else if (event.action === "TRADE") {
                icon = <ArrowRightLeft className="h-4 w-4 text-white" />;
                actionLabel = event.fromUserName
                  ? `Traded from ${event.fromUserName} to ${event.toUserName}`
                  : `Traded to ${event.toUserName}`;
                colorClass = "bg-teal-500";
              } else if (
                event.action === "AUCTION_BUYOUT" ||
                event.action === "AUCTION_END"
              ) {
                icon = <ShoppingBag className="h-4 w-4 text-white" />;
                actionLabel = `Purchased at Auction by ${event.toUserName}`;
                if (event.price) {
                  actionLabel += ` for ${event.price.toLocaleString()} IxC`;
                }
                colorClass = "bg-amber-500";
              } else if (event.action === "ADMIN") {
                icon = <Star className="h-4 w-4 text-white" />;
                actionLabel = `Assigned by Admin to ${event.toUserName}`;
                colorClass = "bg-red-500";
              }

              return (
                <div key={event.id} className="relative flex flex-col items-start gap-1 text-left">
                  {/* Dot Indicator */}
                  <div
                    className={cn(
                      "absolute top-0.5 -left-[37px] flex h-6 w-6 items-center justify-center rounded-full shadow-md",
                      colorClass
                    )}
                  >
                    {icon}
                  </div>
                  <div className="text-foreground text-sm font-semibold">{actionLabel}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

