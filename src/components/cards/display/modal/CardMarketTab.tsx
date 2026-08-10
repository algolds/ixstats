"use client";

import React from "react";
import { motion } from "motion/react";
import { BarChart3 } from "lucide-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { CardPriceHistoryChart } from "../CardPriceHistoryChart";
import type { CardInstance } from "~/types/cards-display";

export function CardMarketTab({
  card,
  rarityConfig,
}: {
  card: CardInstance;
  rarityConfig: { color: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
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
    </motion.div>
  );
}
