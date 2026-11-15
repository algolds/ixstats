"use client";

/**
 * The expanded sidebar's single-line wallet well (`Card variant="well"` inside `facet-chrome` —
 * never glass-on-glass): animated IxCredits balance (`NumberFlowDisplay`), today's positive delta,
 * an inline `facet-gold` Claim pill while the daily reward waits, and a trailing `facet-overlay`
 * Popover with today's earnings breakdown and achievement progress.
 */

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { NavArrowRight } from "iconoir-react";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Progress } from "~/components/ui/progress";
import { DailyRewardInlinePill } from "~/components/vault/DailyRewardProvider";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

function Earnings() {
  const { data: earnings } = api.vault.getTodayEarnings.useQuery();
  if (!earnings) return null;
  if (!earnings.sources.length) {
    return <p className="text-footnote text-label-secondary">Nothing earned yet today</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {earnings.sources.map((source) => (
        <li key={source.type} className="text-footnote flex items-baseline justify-between gap-2">
          <span className="text-label-secondary min-w-0 truncate">{source.label}</span>
          <span className="text-success-ink tabular-nums">+{formatCredits(source.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function AchievementProgress() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  if (!summary) return null;
  return (
    <div className="border-separator flex flex-col gap-1.5 border-t pt-2.5">
      <div className="text-footnote flex items-baseline justify-between gap-2">
        <span className="text-label font-medium">Achievements</span>
        <span className="text-label-secondary tabular-nums">
          {summary.unlocked} of {summary.activeTotal}
        </span>
      </div>
      <Progress
        value={summary.unlocked}
        max={summary.activeTotal}
        aria-label="Achievements unlocked"
      />
      <p className="text-caption text-label-secondary tabular-nums">
        {formatCredits(summary.points)} points
        {summary.rank !== null && ` · Rank ${summary.rank}`}
      </p>
    </div>
  );
}

function BreakdownPanel({ today }: { today: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-footnote text-label font-semibold">Today&apos;s earnings</span>
        {today > 0 && (
          <span className="text-footnote text-success-ink font-medium tabular-nums">
            +{formatCredits(today)}
          </span>
        )}
      </div>
      <Earnings />
      <AchievementProgress />
    </div>
  );
}

interface SidebarVaultCardProps {
  className?: string;
}

export function SidebarVaultCard({ className }: SidebarVaultCardProps) {
  const { userId } = useAuth();
  const [open, setOpen] = React.useState(false);
  const { data: balance } = api.vault.getBalance.useQuery(undefined, { enabled: !!userId });
  const { data: earnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!userId,
  });

  if (!userId || !balance) return null;

  const today = earnings?.total ?? 0;

  return (
    <Card
      variant="well"
      padding="none"
      data-slot="sidebar-vault-card"
      data-app="vault"
      className={cn(
        "rounded-row flex items-center justify-between gap-1.5 px-2.5 py-1.5",
        className
      )}
    >
      <Link
        href="/vault"
        aria-label={`Wallet: ${formatCredits(balance.credits)} IxCredits`}
        className={cn(
          focusRing,
          "rounded-control-sm hover:bg-fill-4 -ml-1 flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5 transition-colors"
        )}
      >
        <IxCreditsSymbol decorative className="text-tint size-4 shrink-0" />
        <NumberFlowDisplay
          value={Math.round(balance.credits)}
          className="text-subhead text-label font-semibold tabular-nums"
        />
        {today > 0 && (
          <span className="text-caption text-success-ink font-medium whitespace-nowrap tabular-nums">
            +{formatCredits(today)}
          </span>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <DailyRewardInlinePill />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Show earnings and progress"
              className="text-label-secondary size-6"
            >
              <NavArrowRight aria-hidden className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={10}
            data-app="vault"
            className="w-64 p-3"
          >
            <BreakdownPanel today={today} />
          </PopoverContent>
        </Popover>
      </div>
    </Card>
  );
}
