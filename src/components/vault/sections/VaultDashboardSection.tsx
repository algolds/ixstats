"use client";

import { api } from "~/trpc/react";
import { PageHeader } from "~/components/shell/PageHeader";
import { StreakPill } from "~/components/vault/StreakPill";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import type { Figure } from "./dashboard/credits";
import { VaultBalanceCard } from "./dashboard/VaultBalanceCard";
import { VaultUnlocks } from "./dashboard/VaultUnlocks";
import { VaultShowcase } from "./dashboard/VaultShowcase";
import { VaultStatement } from "./dashboard/VaultStatement";
import { VaultMarkTile } from "./dashboard/VaultTitle";

/**
 * The Wallet page (`/vault`): Apple Wallet / bank statement layout with zero duplicate in-page
 * navigation rails (all Vault destinations live in the global `AppSidebar`).
 */
export function VaultDashboardSection() {
  const { stats, loading, error } = useVaultStats();
  const balance = api.vault.getBalance.useQuery();
  const streak = balance.data?.loginStreak ?? 0;
  const figure = (value: number): Figure => (error ? null : loading ? undefined : value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        leading={<VaultMarkTile />}
        actions={streak > 0 ? <StreakPill streak={streak} /> : undefined}
        bleed
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col lg:col-span-12 lg:self-stretch lg:has-[+div:not(:empty)]:col-span-8">
          <VaultBalanceCard
            totalCards={figure(stats.totalCards)}
            deckValue={figure(stats.deckValue)}
          />
        </div>
        <div className="empty:hidden lg:col-span-4 lg:self-stretch">
          <VaultUnlocks />
        </div>
        <div className="lg:col-span-12">
          <VaultShowcase />
        </div>
        <div className="lg:col-span-12">
          <VaultStatement />
        </div>
      </div>
    </div>
  );
}
