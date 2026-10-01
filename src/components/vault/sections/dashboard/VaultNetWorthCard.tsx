"use client";

import React from "react";
import { Wallet, Component as Layers, Package, ShoppingBag } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import NumberFlow from "~/components/ui/number-flow";
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
    <FacetCard padding="lg" className="overflow-hidden">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-row bg-tint-fill text-tint shadow-card flex h-8 w-8 items-center justify-center border font-medium">
              <Wallet className="text-tint h-4.5 w-4.5" />
            </div>
            <span className="text-label-secondary text-eyebrow">MyVault Balance</span>
          </div>
          <Badge className="border-yellow/30 bg-yellow/10 text-eyebrow text-yellow shadow-card px-3 py-1">
            Tier {vaultLevel} Account
          </Badge>
        </div>

        <div className="mt-5">
          <div className="text-large-title text-yellow flex items-center gap-2">
            <IxCreditsSymbol className="text-yellow h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
            <NumberFlow value={netWorth} />
          </div>
        </div>

        <div className="border-separator text-footnote mt-6 grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <span className="text-label-secondary text-eyebrow block">Available Balance</span>
            <div className="text-title-3 text-yellow mt-1 flex items-center gap-1">
              <IxCreditsSymbol className="text-yellow h-4.5 w-4.5 shrink-0" />
              <NumberFlow value={liquidCredits} />
            </div>
          </div>
          <div>
            <span className="text-label-secondary text-eyebrow block">Card Deck Value</span>
            <div className="text-title-3 text-indigo mt-1 flex items-center gap-1">
              <IxCreditsSymbol className="text-indigo h-4.5 w-4.5 shrink-0" />
              <NumberFlow value={collectionValuation} />
            </div>
          </div>
        </div>

        {/* Quick stats inline interactive pills */}
        <div className="border-separator text-footnote mt-5 flex flex-wrap gap-2 border-t pt-4">
          <div className="border-separator bg-fill-3 text-label flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1 font-medium select-none">
            <Layers className="text-tint h-3.5 w-3.5 shrink-0" />
            <span>
              Cards:{" "}
              <strong className="text-label font-semibold">
                {totalCards} / {150 + capacityBoost}
              </strong>
            </span>
          </div>
          <div className="border-separator bg-fill-3 text-label flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1 font-medium select-none">
            <Package className="text-indigo h-3.5 w-3.5 shrink-0" />
            <span>
              Packs: <strong className="text-label font-semibold">{unopenedPacks}</strong>
            </span>
          </div>
          <div className="border-separator bg-fill-3 text-label flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1 font-medium select-none">
            <ShoppingBag className="text-blue h-3.5 w-3.5 shrink-0" />
            <span>
              Auctions: <strong className="text-label font-semibold">{activeAuctions}</strong>
            </span>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}
