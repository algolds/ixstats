"use client";

import React from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { TrendingUp, Users, Calendar, ScrollText } from "lucide-react";
import { cn } from "~/lib/utils";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import { CardHolographicCover } from "../CardHolographicCover";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { getOwnerCount } from "~/lib/card-display-utils";
import type { CardInstance, FormattedStats } from "~/types/cards-display";

export interface CardOverviewTabProps {
  card: CardInstance;
  rarityConfig: {
    borderColor: string;
    glowColor: string;
    glowIntensity: string;
    color: string;
  };
  neonFrame: Parameters<typeof NeonFrameOverlay>[0]["neonFrame"];
  stats: FormattedStats;
  onTrade?: (card: CardInstance) => void;
  onList?: (card: CardInstance) => void;
  onViewCollection?: (countryId: string) => void;
}

export function CardOverviewTab({
  card,
  rarityConfig,
  neonFrame,
  stats,
  onTrade,
  onList,
  onViewCollection,
}: CardOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
      {/* Left: Card image */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {/* Card image */}
        <div className="relative w-full overflow-hidden rounded-2xl border-2 shadow-2xl">
          <div
            className={cn("absolute inset-0 z-10", rarityConfig.borderColor)}
            style={{
              borderWidth: "2px",
              borderRadius: "1rem",
            }}
          />
          <div className="relative h-[300px] w-full sm:h-[400px]">
            <CardHolographicCover
              cardType={card.cardType}
              rarity={card.rarity}
              wikiSource={card.wikiSource}
              title={card.title}
            />
            <Image
              src={proxyNSImage(card.artwork)}
              alt={card.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 90vw, 400px"
              unoptimized
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {card.isRetired && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                <div className="rotate-[-12deg] rounded-lg border-4 border-red-500/80 bg-red-950/90 px-4 py-2 text-center text-xl font-black tracking-widest text-red-500 uppercase shadow-2xl backdrop-blur-xs select-none">
                  Retired
                </div>
              </div>
            )}
          </div>
          {/* Rarity glow */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-20 rounded-2xl",
              rarityConfig.glowColor,
              rarityConfig.glowIntensity
            )}
          />

          {/* Neon Frame Overlay */}
          <NeonFrameOverlay neonFrame={neonFrame} className="rounded-2xl" />
        </div>

        {/* Market value & ownership */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <TrendingUp className="h-4 w-4" />
              Market Value
            </div>
            <div
              className={cn(
                "mt-1 flex items-baseline gap-1 text-xl font-bold",
                rarityConfig.color
              )}
            >
              <IxCreditsSymbol size="1em" variant="ic" />
              {card.marketValue.toLocaleString()}
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Users className="h-4 w-4" />
              Owners
            </div>
            <div className="text-foreground mt-1 text-lg font-semibold">
              {getOwnerCount(card.owners)}
            </div>
          </div>

          <div className="glass-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4" />
              Serial #{card.serialNumber ?? "—"}
            </div>
            <div className="text-foreground mt-1 text-lg font-semibold">
              {card.level > 0 ? `Lv.${card.level}` : "—"}
            </div>
          </div>
        </div>

        {/* Ownership metadata */}
        {card.acquiredAt && (
          <div className="glass-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4" />
              Acquired
            </div>
            <div className="text-foreground mt-1 text-sm font-semibold">
              {new Date(card.acquiredAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        )}

        {card.lastSalePrice != null && (
          <div className="glass-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <TrendingUp className="h-4 w-4" />
              Last Sale
            </div>
            <div className="text-foreground mt-1 flex items-baseline gap-1 text-sm font-semibold">
              <IxCreditsSymbol size="0.8em" variant="ic" />
              {card.lastSalePrice.toLocaleString()}
              {card.lastSaleDate && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {new Date(card.lastSaleDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Right: Card details */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-4"
      >
        {card.inscription && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm backdrop-blur-xs">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-amber-500 uppercase">
              <ScrollText className="h-4 w-4" />
              Card Inscription
            </div>
            <p className="text-foreground border-l-2 border-amber-500/40 bg-amber-500/[0.02] py-1 pl-3 text-sm font-medium italic">
              "{card.inscription}"
            </p>
            <div className="text-muted-foreground mt-2 text-right text-[10px] font-medium">
              Inscribed by user{" "}
              {card.inscribedById ? card.inscribedById.substring(0, 8) : "System"}
              {card.inscribedAt &&
                ` on ${new Date(card.inscribedAt).toLocaleDateString()}`}
            </div>
          </div>
        )}

        {/* Description */}
        {card.description && (
          <div className="glass-hierarchy-child rounded-lg p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">Description</h3>
            <p className="text-muted-foreground text-sm">{card.description}</p>
          </div>
        )}

        {/* Quick stats */}
        <div className="glass-hierarchy-child rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">Quick Stats</h3>
            {card.level > 1 && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500 dark:text-amber-400">
                Lv.{card.level} +{stats.totalBoost}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.base).map(([key, stat]) => (
              <div key={key}>
                <div className="text-muted-foreground text-xs">{stat.def.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ color: stat.def.color }}>
                    {stat.value}
                  </span>
                  <span className="text-muted-foreground/50 text-xs">/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {onTrade && (
            <button
              onClick={() => onTrade(card)}
              className={cn(
                "glass-hierarchy-interactive rounded-lg px-4 py-3",
                "text-foreground text-sm font-semibold dark:text-white",
                "transition-all hover:scale-105"
              )}
            >
              Trade
            </button>
          )}
          {onList && (
            <button
              onClick={() => onList(card)}
              className={cn(
                "glass-hierarchy-interactive rounded-lg px-4 py-3",
                "text-foreground text-sm font-semibold dark:text-white",
                "transition-all hover:scale-105"
              )}
            >
              List
            </button>
          )}
          {onViewCollection && card.countryId && (
            <button
              onClick={() => onViewCollection(card.countryId!)}
              className={cn(
                "glass-hierarchy-interactive col-span-2 rounded-lg px-4 py-3",
                "text-foreground text-sm font-semibold dark:text-white",
                "transition-all hover:scale-105"
              )}
            >
              View Collection
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
