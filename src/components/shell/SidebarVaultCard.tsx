"use client";

/**
 * The expanded sidebar's wallet: IxCredits balance, what you earned today and the daily reward,
 * above the account row. A chevron opens it to today's earnings by source, achievement progress
 * and links into the Vault; the open panel mounts (and queries) only while open. Reads the queries the Vault dashboard's wallet card reads, so the two
 * never disagree and TanStack Query dedupes them. A solid well, because it sits inside the
 * chrome's glass. Renders nothing until the balance is known (no skeleton jump in a footer that
 * is always on screen); the host only mounts it for signed-in players.
 */

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { NavArrowDown } from "iconoir-react";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Progress } from "~/components/ui/progress";
import { Stat } from "~/components/ui/stat";
import { DailyRewardStatus } from "~/components/vault/DailyRewardProvider";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

const VAULT_LINKS = [
  { href: "/vault/cards", label: "Cards" },
  { href: "/vault/store", label: "Store" },
  { href: "/vault/achievements", label: "Achievements" },
] as const;

function Earnings() {
  const { data: earnings } = api.vault.getTodayEarnings.useQuery();
  // Nothing while loading or failed: "nothing earned" would be a claim the query has not made.
  if (!earnings) return null;
  if (!earnings.sources.length) {
    return <p className="text-footnote text-label-secondary">Nothing earned yet today</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {earnings.sources.map((source) => (
        <li key={source.type} className="text-footnote flex items-baseline justify-between gap-2">
          <span className="text-label-secondary min-w-0 truncate">{source.label}</span>
          <span className="text-success tabular-nums">+{formatCredits(source.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function AchievementProgress() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  if (!summary) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        value={summary.unlocked}
        max={summary.activeTotal}
        aria-label="Achievements unlocked"
      />
      <p className="text-footnote">
        {summary.unlocked} of {summary.activeTotal} unlocked
      </p>
      <p className="text-footnote text-label-secondary">
        {formatCredits(summary.points)} points
        {summary.rank !== null && ` · Rank ${summary.rank}`}
      </p>
    </div>
  );
}

function OpenPanel() {
  return (
    <div className="border-separator flex flex-col gap-3 border-t pt-3">
      <Earnings />
      <AchievementProgress />
      <nav aria-label="Vault" className="flex flex-wrap gap-1">
        {VAULT_LINKS.map(({ href, label }) => (
          <Button key={href} asChild variant="ghost" size="xs">
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </nav>
    </div>
  );
}

interface SidebarVaultCardProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function SidebarVaultCard({ expanded, onToggle, className }: SidebarVaultCardProps) {
  const { userId } = useAuth();
  const { data: balance } = api.vault.getBalance.useQuery(undefined, { enabled: !!userId });
  const { data: earnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!userId,
  });

  if (!userId || !balance) return null;

  const today = earnings?.total ?? 0;

  return (
    <Card
      variant="well"
      padding="sm"
      data-slot="sidebar-vault-card"
      data-app="vault"
      className={cn("flex flex-col gap-2", className)}
    >
      <Collapsible open={expanded} onOpenChange={onToggle} className="flex flex-col gap-2">
        {/* The reward and the chevron are buttons, so they stay siblings of the link rather than inside it. */}
        <div className="flex items-start gap-1">
          <Link
            href="/vault"
            className={cn(
              focusRing,
              "rounded-control hover:bg-fill-4 -m-1 block min-w-0 flex-1 p-1 transition-colors"
            )}
          >
            <Stat
              size="sm"
              label="IxCredits"
              value={
                <span className="flex items-center gap-1.5">
                  <IxCreditsSymbol decorative className="size-4 shrink-0" />
                  {formatCredits(balance.credits)}
                </span>
              }
              hint={
                today > 0 ? (
                  <span className="text-success">+{formatCredits(today)} today</span>
                ) : undefined
              }
            />
          </Link>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={expanded ? "Hide earnings and progress" : "Show earnings and progress"}
            >
              <NavArrowDown
                aria-hidden
                className={cn(
                  "transition-transform motion-reduce:transition-none",
                  expanded && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <DailyRewardStatus />
        <CollapsibleContent>
          <OpenPanel />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
