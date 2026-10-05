"use client";

import React from "react";
import { Component as Layers, Package, ShoppingBag } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import { Skeleton } from "~/components/ui/skeleton";
import { Credits } from "./credits";

/** Base card capacity before the account's capacity boost. */
const BASE_CARD_CAPACITY = 150;

interface VaultCollectionCardProps {
  vaultLevel: number;
  /** IxCredits balance plus card deck value; undefined until both are known. The balance itself lives in the Wallet card. */
  netWorth: number | undefined;
  /** Undefined while the stats load. */
  collectionValuation: number | undefined;
  totalCards: number;
  capacityBoost: number;
  unopenedPacks: number;
  activeAuctions: number;
}

/** A figure for the Stat value slot; a skeleton while its inputs are still loading. */
function CreditsFigure({ amount }: { amount: number | undefined }) {
  if (amount === undefined) return <Skeleton className="h-8 w-28" />;
  return (
    <span className="flex items-center gap-2">
      <Credits amount={amount} symbolClassName="size-4" />
    </span>
  );
}

function Count({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-separator bg-fill-3 text-label text-footnote flex cursor-default items-center gap-2 rounded-full border px-3 py-1 font-medium select-none">
      <span aria-hidden className="text-label-secondary inline-flex shrink-0 [&_svg]:size-3.5">
        {icon}
      </span>
      <span>
        {label}: <strong className="text-label font-semibold tabular-nums">{children}</strong>
      </span>
    </div>
  );
}

/** What the Wallet card does not show: deck value, net worth, account tier and holdings counts. */
export function VaultCollectionCard({
  vaultLevel,
  netWorth,
  collectionValuation,
  totalCards,
  capacityBoost,
  unopenedPacks,
  activeAuctions,
}: VaultCollectionCardProps) {
  return (
    <Card padding="lg" className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <CardTitle icon={<Layers />}>Collection</CardTitle>
        <Badge variant="warning" className="shadow-card px-3 py-1">
          Tier <span className="tabular-nums">{vaultLevel}</span> account
        </Badge>
      </div>

      <div className="border-separator grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
        <Stat label="Card deck value" value={<CreditsFigure amount={collectionValuation} />} />
        <Stat
          label="Net worth"
          value={<CreditsFigure amount={netWorth} />}
          hint="IxCredits balance plus card deck value"
        />
      </div>

      <div className="border-separator flex flex-wrap gap-2 border-t pt-4">
        <Count icon={<Layers />} label="Cards">
          {totalCards} / {BASE_CARD_CAPACITY + capacityBoost}
        </Count>
        <Count icon={<Package />} label="Packs">
          {unopenedPacks}
        </Count>
        <Count icon={<ShoppingBag />} label="Auctions">
          {activeAuctions}
        </Count>
      </div>
    </Card>
  );
}
