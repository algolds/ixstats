"use client";

import { Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { CardTitle } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { CreditsFigure, type Figure } from "./credits";
import { DailyRewardTile } from "./DailyRewardTile";

interface VaultBalanceCardProps {
  /** The card count: undefined while the stats load, null if they failed. */
  totalCards: Figure;
  /** The card deck's value: undefined while the stats load, null if they failed. */
  deckValue: Figure;
}

const plural = (count: number, one: string) =>
  `${count.toLocaleString()} ${one}${count === 1 ? "" : "s"}`;

function sumFigures(a: Figure, b: Figure): Figure {
  if (a === undefined || b === undefined) return undefined;
  if (a === null || b === null) return null;
  return a + b;
}

function DeckCountMeta({ totalCards }: { totalCards: Figure }) {
  if (totalCards === undefined) return <Skeleton as="span" className="h-3.5 w-16" />;
  if (totalCards === null) return <span aria-label="Unavailable">–</span>;
  if (totalCards === 0) return <span>No cards yet</span>;
  return <span className="tabular-nums">{plural(totalCards, "card")}</span>;
}

/**
 * Apple Cash / Apple Card statement summary: spendable IxCredits lead figure with collector level
 * and today's delta, hairline split for card deck value and total net worth, and a 1-tap daily
 * reward prompt when today's claim is waiting.
 */
export function VaultBalanceCard({ totalCards, deckValue }: VaultBalanceCardProps) {
  const balance = api.vault.getBalance.useQuery();
  const level = api.vault.getVaultLevel.useQuery();
  const earnings = api.vault.getTodayEarnings.useQuery();

  const credits: Figure = balance.isError
    ? null
    : balance.isLoading
      ? undefined
      : (balance.data?.credits ?? 0);
  const today = earnings.data?.total ?? 0;
  const netWorth = sumFigures(credits, deckValue);

  return (
    <LensCard
      app="vault"
      content="data"
      padding="md"
      data-slot="vault-balance-card"
      className="flex h-full flex-1 flex-col justify-between gap-4 overflow-hidden"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle icon={<Wallet />}>Balance</CardTitle>
          {level.data && (
            <Badge variant="secondary" className="tabular-nums">
              Level {level.data.vaultLevel} collector
            </Badge>
          )}
        </div>

        <Stat
          size="lg"
          label="Spendable IxCredits"
          value={<CreditsFigure amount={credits} animate symbolClassName="size-7" />}
          delta={
            today > 0 ? { value: `+${today.toLocaleString()} today`, direction: "up" } : undefined
          }
        />
      </div>

      <div className="space-y-3">
        <div
          data-slot="net-worth-split"
          className="border-separator sm:divide-separator grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 sm:gap-0 sm:divide-x"
        >
          <div data-slot="deck-value-summary" className="flex flex-col gap-0.5 sm:pr-4">
            <div className="text-footnote text-label-secondary flex items-center justify-between gap-2">
              <span>Card deck value</span>
              <DeckCountMeta totalCards={totalCards} />
            </div>
            <div className="text-title-3 text-label font-semibold tabular-nums">
              <CreditsFigure
                amount={deckValue}
                skeletonClassName="h-6 w-20"
                symbolClassName="size-4"
              />
            </div>
          </div>

          <div
            data-slot="net-worth-summary"
            className="border-separator flex flex-col gap-0.5 border-t pt-3 sm:border-t-0 sm:pt-0 sm:pl-4"
          >
            <span className="text-footnote text-label-secondary">Total net worth</span>
            <div className="text-title-3 text-label font-semibold tabular-nums">
              <CreditsFigure
                amount={netWorth}
                skeletonClassName="h-6 w-24"
                symbolClassName="size-4"
              />
            </div>
          </div>
        </div>

        <div className="empty:hidden">
          <DailyRewardTile onlyWhenReady />
        </div>
      </div>
    </LensCard>
  );
}
