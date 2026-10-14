"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import { CreditsFigure, sumFigures, type Figure } from "./credits";

interface VaultAccountHeroProps {
  /** The card deck's value: undefined while the stats load, null if they failed. */
  deckValue: Figure;
  unopenedPacks: number;
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** The account at a glance: balance, level, today's earnings, net worth, streak and the actions that apply. */
export function VaultAccountHero({ deckValue, unopenedPacks }: VaultAccountHeroProps) {
  const { open: openDailyReward } = useDailyReward();
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
      data-slot="vault-account-hero"
      className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-footnote text-label-secondary">
          IxCredits{level.data ? ` · Level ${level.data.vaultLevel} account` : ""}
        </p>
        <div className="text-large-title text-tint tabular-nums">
          <CreditsFigure amount={credits} symbolClassName="size-6" />
        </div>
        <div className="text-footnote text-label-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
          {today > 0 && (
            <span className="text-success tabular-nums">+{today.toLocaleString()} today</span>
          )}
          <span data-slot="net-worth" className="inline-flex items-center gap-1.5">
            <span>Net worth</span>
            <span className="text-label tabular-nums">
              <CreditsFigure amount={sumFigures(credits, deckValue)} skeletonClassName="h-4 w-16" />
            </span>
          </span>
          {streak > 0 && <span className="tabular-nums">Day {streak} streak</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {balance.data?.canClaimDailyBonus && (
          <Button type="button" onClick={openDailyReward}>
            Claim daily reward
          </Button>
        )}
        {unopenedPacks > 0 && (
          <Button asChild variant="secondary">
            <Link href="/vault/store?tab=store">Open {plural(unopenedPacks, "pack")}</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/vault/store">Store</Link>
        </Button>
      </div>
    </Card>
  );
}
