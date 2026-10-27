"use client";

import { Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { StreakPill } from "~/components/vault/StreakPill";
import { CreditsFigure, type Figure } from "./credits";

interface VaultBalanceCardProps {
  /** The card count: undefined while the stats load, null if they failed. */
  totalCards: Figure;
  /** The card deck's value: undefined while the stats load, null if they failed. */
  deckValue: Figure;
}

const plural = (count: number, one: string) =>
  `${count.toLocaleString()} ${one}${count === 1 ? "" : "s"}`;

/** "Your 12 cards are worth ◈ 5,000": the card deck's value, beside the spendable balance. */
function DeckLine({ totalCards, deckValue }: VaultBalanceCardProps) {
  if (totalCards === undefined) return <Skeleton className="h-4 w-48" />;
  if (totalCards === null) return <span aria-label="Unavailable">–</span>;
  if (totalCards === 0) return <span>No cards yet</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 tabular-nums">
      Your {plural(totalCards, "card")} {totalCards === 1 ? "is" : "are"} worth{" "}
      <CreditsFigure amount={deckValue} skeletonClassName="h-4 w-12" symbolClassName="size-3" />
    </span>
  );
}

/** The account: the spendable IxCredits balance with today's earnings and streak, and what the card deck is worth. */
export function VaultBalanceCard({ totalCards, deckValue }: VaultBalanceCardProps) {
  const balance = api.vault.getBalance.useQuery();
  const level = api.vault.getVaultLevel.useQuery();
  const earnings = api.vault.getTodayEarnings.useQuery();

  const credits: Figure = balance.isError
    ? null
    : balance.isLoading
      ? undefined
      : (balance.data?.credits ?? 0);
  const streak = balance.data?.loginStreak ?? 0;
  const today = earnings.data?.total ?? 0;

  return (
    <Card
      content="data"
      padding="md"
      data-slot="vault-balance-card"
      className="flex h-full flex-col gap-3 overflow-hidden"
    >
      <TextureOverlay
        texture="chevron"
        opacity={0.025}
        className="[--facet-texture-color:var(--tint)]"
      />
      <div className="relative flex items-center justify-between gap-3">
        <CardTitle icon={<Wallet />}>Balance</CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {streak > 0 && <StreakPill streak={streak} />}
          {level.data && <Badge>Level {level.data.vaultLevel} collector</Badge>}
        </div>
      </div>
      <Stat
        size="lg"
        label="IxCredits"
        value={<CreditsFigure amount={credits} animate symbolClassName="size-7" />}
        delta={
          today > 0 ? { value: `+${today.toLocaleString()} today`, direction: "up" } : undefined
        }
        className="relative"
      />
      <div data-slot="deck-line" className="text-footnote text-label-secondary relative">
        <DeckLine totalCards={totalCards} deckValue={deckValue} />
      </div>
    </Card>
  );
}
