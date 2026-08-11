"use client";

import React from "react";
import { Wallet, Layers, Package, ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import NumberFlow from "~/components/ui/number-flow";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

export interface VaultNetWorthCardProps {
  vaultLevel: number;
  netWorth: number;
  liquidCredits: number;
  collectionValuation: number;
  totalCards: number;
  capacityBoost: number;
  unopenedPacks: number;
  activeAuctions: number;
}

export function VaultNetWorthCard({
  vaultLevel,
  netWorth,
  liquidCredits,
  collectionValuation,
  totalCards,
  capacityBoost,
  unopenedPacks,
  activeAuctions,
}: VaultNetWorthCardProps) {
  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-purple-500/30 hover:shadow-purple-500/10"
      )}
    >
      {/* Texture Overlay */}
      <TextureOverlay texture="chevron" opacity={0.04} />

      {/* Subtle Apple-style mesh background gradient */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-600/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm backdrop-blur-md">
              <Wallet className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              MyVault Balance
            </span>
          </div>
          <Badge className="border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[9px] font-bold tracking-widest text-purple-600 dark:text-purple-400 uppercase backdrop-blur-md shadow-sm">
            Tier {vaultLevel} Account
          </Badge>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 text-4xl font-extrabold tracking-tight text-amber-500 dark:text-amber-400 sm:text-5xl drop-shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
            <IxCreditsSymbol className="h-8 w-8 shrink-0 text-amber-500 dark:text-amber-400 sm:h-10 sm:w-10" />
            <NumberFlow value={netWorth} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/40 pt-4 text-xs">
          <div>
            <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Available Balance
            </span>
            <div className="mt-1 flex items-center gap-1 text-lg font-bold text-amber-600 dark:text-amber-400">
              <IxCreditsSymbol className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <NumberFlow value={liquidCredits} />
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Card Deck Value
            </span>
            <div className="mt-1 flex items-center gap-1 text-lg font-bold text-purple-600 dark:text-purple-400">
              <IxCreditsSymbol className="h-4.5 w-4.5 shrink-0 text-purple-600 dark:text-purple-400" />
              <NumberFlow value={collectionValuation} />
            </div>
          </div>
        </div>

        {/* Quick stats inline interactive pills */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border/40 pt-4 text-[11px]">
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-medium text-foreground backdrop-blur-md transition-all hover:bg-muted/70 active:scale-95 cursor-default select-none">
            <Layers className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
            <span>
              Cards:{" "}
              <strong className="font-bold text-foreground">
                {totalCards} / {150 + capacityBoost}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-medium text-foreground backdrop-blur-md transition-all hover:bg-muted/70 active:scale-95 cursor-default select-none">
            <Package className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>
              Packs: <strong className="font-bold text-foreground">{unopenedPacks}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-medium text-foreground backdrop-blur-md transition-all hover:bg-muted/70 active:scale-95 cursor-default select-none">
            <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              Auctions: <strong className="font-bold text-foreground">{activeAuctions}</strong>
            </span>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}

