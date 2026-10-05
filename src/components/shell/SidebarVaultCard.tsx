"use client";

/**
 * The expanded sidebar's wallet: IxCredits balance, what you earned today and the daily reward,
 * above the account row. Reads the queries the Vault dashboard's wallet card reads, so the two
 * never disagree and TanStack Query dedupes them. A solid well, because it sits inside the
 * chrome's glass. Renders nothing until the balance is known (no skeleton jump in a footer that
 * is always on screen); the host only mounts it for signed-in players.
 */

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import { DailyRewardStatus } from "~/components/vault/DailyRewardProvider";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

export function SidebarVaultCard({ className }: { className?: string }) {
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
      {/* The reward is a button, so it stays a sibling of the link rather than inside it. */}
      <Link
        href="/vault"
        className={cn(
          focusRing,
          "rounded-control hover:bg-fill-4 -m-1 block p-1 transition-colors"
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
      <DailyRewardStatus />
    </Card>
  );
}
