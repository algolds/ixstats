"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import {
  StatsReport as BarChart3,
  ClockRotateRight as History,
  Package,
  Trophy as Award,
  Gift,
  ArrowSeparate as ArrowRightLeft,
  ShoppingBag,
  Star,
} from "iconoir-react";
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
      transition={springSmooth}
      className="space-y-6"
    >
      <div className="bg-surface-secondary border-separator rounded-control border p-6">
        <h3 className="text-label text-title-3 mb-4 flex items-center gap-2 font-semibold">
          <BarChart3 className="h-5 w-5" />
          Market History
        </h3>

        {/* Market stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-surface-secondary border-separator rounded-control border p-4">
            <p className="text-label-secondary text-footnote mb-1">Current Value</p>
            <p className={cn("text-title-1 flex items-baseline gap-1", rarityConfig.color)}>
              <IxCreditsSymbol size="1em" variant="ic" />
              {card.marketValue.toLocaleString()}
            </p>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-4">
            <p className="text-label-secondary text-footnote mb-1">Total Supply</p>
            <p className="text-label text-title-1">{card.totalSupply.toLocaleString()}</p>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-4">
            <p className="text-label-secondary text-footnote mb-1">Last Trade</p>
            <p className="text-label text-headline">
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
      <div className="bg-surface-secondary border-separator rounded-control border p-6">
        <h3 className="text-label text-title-3 mb-4 flex items-center gap-2 font-semibold">
          <History className="text-yellow h-5 w-5" />
          Provenance & Ownership History
        </h3>

        {isLoadingProvenance ? (
          <div className="flex h-32 items-center justify-center">
            <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : !provenanceEvents || provenanceEvents.length === 0 ? (
          <div className="text-label-secondary text-footnote flex h-24 items-center justify-center">
            No ownership transfer events recorded for this card
          </div>
        ) : (
          <div className="border-separator relative ml-3 space-y-6 border-l pl-6">
            {provenanceEvents.map((event) => {
              let icon = <Package className="text-label h-4 w-4" />;
              let actionLabel: React.ReactNode = "Transferred";
              let colorClass = "bg-blue";

              if (event.action === "PACK_OPEN") {
                icon = <Package className="text-label h-4 w-4" />;
                actionLabel = "Pulled from Card Pack";
                colorClass = "bg-indigo";
              } else if (event.action === "DAILY_CLAIM") {
                icon = <Award className="text-label h-4 w-4" />;
                actionLabel = "Claimed as Daily Bonus";
                colorClass = "bg-yellow";
              } else if (event.action === "GIFT") {
                icon = <Gift className="text-label h-4 w-4" />;
                actionLabel = event.fromUserName
                  ? `Gifted from ${event.fromUserName} to ${event.toUserName}`
                  : `Gifted to ${event.toUserName}`;
                colorClass = "bg-blue";
              } else if (event.action === "TRADE") {
                icon = <ArrowRightLeft className="text-label h-4 w-4" />;
                actionLabel = event.fromUserName
                  ? `Traded from ${event.fromUserName} to ${event.toUserName}`
                  : `Traded to ${event.toUserName}`;
                colorClass = "bg-teal";
              } else if (event.action === "AUCTION_BUYOUT" || event.action === "AUCTION_END") {
                icon = <ShoppingBag className="text-label h-4 w-4" />;
                actionLabel = (
                  <span className="inline-flex items-center gap-1">
                    Purchased at Auction by {event.toUserName}
                    {event.price && (
                      <span className="text-yellow inline-flex items-center gap-0.5 font-semibold">
                        for <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {event.price.toLocaleString()}
                      </span>
                    )}
                  </span>
                );
                colorClass = "bg-yellow";
              } else if (event.action === "ADMIN") {
                icon = <Star className="text-label h-4 w-4" />;
                actionLabel = `Assigned by Admin to ${event.toUserName}`;
                colorClass = "bg-red";
              }

              return (
                <div key={event.id} className="relative flex flex-col items-start gap-1 text-left">
                  {/* Dot Indicator */}
                  <div
                    className={cn(
                      "shadow-card absolute top-0.5 -left-[37px] flex h-6 w-6 items-center justify-center rounded-full",
                      colorClass
                    )}
                  >
                    {icon}
                  </div>
                  <div className="text-label text-headline">{actionLabel}</div>
                  <div className="text-label-secondary text-footnote">
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
