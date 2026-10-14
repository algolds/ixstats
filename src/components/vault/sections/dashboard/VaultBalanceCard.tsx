"use client";

import { Wallet } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { CreditsFigure, sumFigures, type Figure } from "./credits";

interface VaultBalanceCardProps {
  /** The card count: undefined while the stats load, null if they failed. */
  totalCards: Figure;
  /** The card deck's value: undefined while the stats load, null if they failed. */
  deckValue: Figure;
}

const plural = (count: number, one: string) =>
  `${count.toLocaleString()} ${one}${count === 1 ? "" : "s"}`;

/** "312 cards · ◈ 6,440": the card side of net worth. */
function CardsShare({ totalCards, deckValue }: VaultBalanceCardProps) {
  if (totalCards === undefined) return <Skeleton className="h-4 w-24" />;
  if (totalCards === null) return <span aria-label="Unavailable">–</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {plural(totalCards, "card")} ·{" "}
      <CreditsFigure amount={deckValue} skeletonClassName="h-4 w-12" />
    </span>
  );
}

/** Net worth is the balance plus the card deck's value; the bar shows how much of it is credits. */
function NetWorth({ credits, ...cards }: VaultBalanceCardProps & { credits: Figure }) {
  const total = sumFigures(credits, cards.deckValue);
  return (
    <Card data-slot="net-worth" variant="well" padding="md" className="flex flex-col gap-3">
      <Stat
        size="sm"
        label="Net worth"
        value={<CreditsFigure amount={total} animate skeletonClassName="h-7 w-24" />}
      />
      {typeof total === "number" && typeof credits === "number" && total > 0 && (
        <Progress value={credits} max={total} aria-label="Credits as a share of net worth" />
      )}
      <div className="text-footnote text-label-secondary flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1 tabular-nums">
          Credits{" "}
          <CreditsFigure amount={credits} skeletonClassName="h-4 w-12" symbolClassName="size-3" />
        </span>
        <CardsShare {...cards} />
      </div>
    </Card>
  );
}

/** The account: IxCredits balance, collector level, today's earnings and streak, then net worth. */
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
      padding="lg"
      data-slot="vault-balance-card"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <CardTitle icon={<Wallet />}>Balance</CardTitle>
        {level.data && <Badge>Level {level.data.vaultLevel} collector</Badge>}
      </div>
      <div className="grid items-end gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
        <Stat
          size="lg"
          label="IxCredits"
          value={<CreditsFigure amount={credits} animate symbolClassName="size-7" />}
          delta={
            today > 0 ? { value: `+${today.toLocaleString()} today`, direction: "up" } : undefined
          }
          hint={streak > 0 ? `Day ${streak} streak` : undefined}
        />
        <NetWorth credits={credits} totalCards={totalCards} deckValue={deckValue} />
      </div>
    </Card>
  );
}
