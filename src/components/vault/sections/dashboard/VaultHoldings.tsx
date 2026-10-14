"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MultiplePages, ShoppingBag, Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { pickFeaturedStoreItem } from "~/lib/vault/featured-store-item";
import { Credits, CreditsFigure, formatCredits, type Figure } from "./credits";

interface VaultHoldingsProps {
  totalCards: number;
  /** The card deck's value: undefined while the stats load, null if they failed. */
  deckValue: Figure;
  unopenedPacks: number;
}

/** A holding is a whole-card link into its home page. */
function Holding({
  href,
  title,
  icon,
  children,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(focusRing, "rounded-card block")}>
      <Card content="entity" padding="sm" interactive className="flex h-full flex-col gap-2">
        <CardTitle icon={icon} className="text-subhead">
          {title}
        </CardTitle>
        {children}
      </Card>
    </Link>
  );
}

function AchievementsHolding() {
  const { data: summary, isError } = api.achievements.getMySummary.useQuery();
  return (
    <Holding href="/vault/achievements" title="Achievements" icon={<Trophy />}>
      {summary ? (
        <>
          <p className="text-body tabular-nums">
            {summary.unlocked} of {summary.activeTotal} unlocked
          </p>
          <Progress
            value={summary.unlocked}
            max={summary.activeTotal}
            aria-label="Achievements unlocked"
          />
          <p className="text-footnote text-label-secondary tabular-nums">
            {formatCredits(summary.points)} points
            {summary.rank !== null && ` · Rank ${summary.rank}`}
          </p>
        </>
      ) : isError ? (
        <p className="text-footnote text-label-secondary">Unavailable</p>
      ) : (
        <Skeleton className="h-12 w-full" />
      )}
    </Holding>
  );
}

function CardsHolding({ totalCards, deckValue, unopenedPacks }: VaultHoldingsProps) {
  return (
    <Holding href="/vault/cards" title="Cards" icon={<MultiplePages />}>
      <p className="text-body tabular-nums">{totalCards.toLocaleString()} cards</p>
      <p className="text-footnote text-label-secondary flex items-center gap-1.5 tabular-nums">
        <CreditsFigure amount={deckValue} skeletonClassName="h-4 w-16" />
        <span>deck value</span>
      </p>
      {unopenedPacks > 0 && (
        <p className="text-footnote text-tint">
          {unopenedPacks} {unopenedPacks === 1 ? "pack" : "packs"} waiting
        </p>
      )}
    </Holding>
  );
}

function StoreHolding() {
  const { data: items } = api.vault.listStoreItems.useQuery();
  const { data: owned } = api.vault.getPurchasedItems.useQuery();
  const featured = items && owned ? pickFeaturedStoreItem(items, owned.purchaseCounts) : undefined;
  return (
    <Holding href="/vault/store" title="Store" icon={<ShoppingBag />}>
      {featured ? (
        <>
          <p className="text-body truncate">{featured.name}</p>
          <p className="text-footnote text-label-secondary flex items-center gap-1 tabular-nums">
            <Credits amount={featured.price} />
          </p>
        </>
      ) : items && owned ? (
        <p className="text-body">Browse the store</p>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </Holding>
  );
}

function WikiLinkPrompt() {
  const { data: links } = api.ixnayid.listWikiLinks.useQuery();
  // Quiet until the links load, so a linked player never sees the prompt flash.
  if (!links || links.some((link) => link.source === "ixwiki" && link.verified)) return null;
  return (
    <Card variant="well" padding="sm" className="col-span-2 lg:col-span-1">
      <Link
        href="/settings?tab=account"
        className={cn(focusRing, "rounded-control-sm text-footnote text-tint hover:underline")}
      >
        Link your wiki account to earn from edits
      </Link>
    </Card>
  );
}

/** What the player holds across the Vault: one tile per home (two by two on a phone), then the wiki prompt. */
export function VaultHoldings(props: VaultHoldingsProps) {
  return (
    <div data-slot="vault-holdings" className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      <AchievementsHolding />
      <CardsHolding {...props} />
      <StoreHolding />
      <WikiLinkPrompt />
    </div>
  );
}
