"use client";

import React from "react";
import Link from "next/link";
import {
  Coins,
  Gift,
  StatUp as TrendingUp,
  RefreshDouble as RefreshCw,
  Cart as ShoppingCart,
  Flash,
  OpenNewWindow as ExternalLink,
  Crown,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useVaultBalance } from "~/hooks/vault/useVaultBalance";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";

export function VaultStatusPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  const {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    todayEarned,
    vaultLevel,
    vaultXp,
    loginStreak,
    premiumMultiplier,
    isPremium,
    isLoading: balanceLoading,
    refresh: refreshBalance,
  } = useVaultBalance();

  const claimBonusMutation = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      soundEffects.bloom();
      notify.success(`Claimed +${data.bonus} IxC daily bonus!`);
      void refreshBalance();
      void utils.vault.getBalance.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to claim bonus");
    },
  });

  const handleRefresh = async () => {
    soundEffects.press();
    await refreshBalance();
    void utils.vault.invalidate();
    notify.success("Vault status updated");
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Vault Status"
        category="Vault"
        description="Monitor your spendable IxCredits balance, claim daily login rewards, and track vault economy multipliers."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/vault"
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Open Vault</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <button
              type="button"
              onClick={handleRefresh}
              data-cuelume-press="soft"
              title="Sync with server"
              className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-[0.97]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {/* Spendable Currency & Daily Bonus */}
      <SettingsGroup
        title="Spendable Currency & Rewards"
        description="Current credit balances and daily streak rewards."
      >
        <SettingsRow
          label="Available IxCredits"
          description="Spendable platform credits used for card packs, marketplace trades, and cosmetic upgrades"
          icon={Coins}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-3">
            <span className="text-foreground text-base font-extrabold tracking-tight">
              {balanceLoading ? "..." : (balance ?? 0).toLocaleString()} IxC
            </span>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Daily Login Reward"
          description={`Claim daily bonus to maintain your login streak (${loginStreak} consecutive ${loginStreak === 1 ? "day" : "days"})`}
          icon={Gift}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={() => claimBonusMutation.mutate()}
            disabled={claimBonusMutation.isPending}
            data-cuelume-press="soft"
            className="facet-interactive bg-foreground text-background hover:bg-foreground/90 rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {claimBonusMutation.isPending ? "Claiming..." : "Claim Daily Bonus"}
          </button>
        </SettingsRow>
      </SettingsGroup>

      {/* Vault Tier & Progression */}
      <SettingsGroup
        title="Vault Tier & Progression"
        description="Account level, lifetime economic volume, and reward multipliers."
      >
        <SettingsRow
          label="Account Vault Level"
          description={`Tier ${vaultLevel} (${vaultXp.toLocaleString()} XP earned)`}
          icon={Crown}
          glyphClass="bg-muted/60 text-foreground"
        >
          <span className="border-border/60 bg-muted/40 text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold">
            Level {vaultLevel}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Reward Multiplier"
          description={
            isPremium
              ? `Active premium boost (${premiumMultiplier}× yield on all platform rewards)`
              : `Standard yield multiplier (${premiumMultiplier}× base rate)`
          }
          icon={Flash}
          glyphClass="bg-muted/60 text-foreground"
        >
          <span className="border-border/60 bg-muted/40 text-foreground rounded-xl border px-3 py-1.5 text-xs font-semibold">
            {premiumMultiplier}× Yield
          </span>
        </SettingsRow>

        <SettingsRow
          label="Lifetime Economic Activity"
          description={`Total earned: ${lifetimeEarned.toLocaleString()} IxC · Total spent: ${lifetimeSpent.toLocaleString()} IxC`}
          icon={TrendingUp}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="text-right">
            <p className="text-foreground text-xs font-semibold">
              +{todayEarned.toLocaleString()} IxC Today
            </p>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
