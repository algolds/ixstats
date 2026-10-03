"use client";

import { Button } from "~/components/ui/button";
import React from "react";
import Link from "next/link";
import {
  Coins,
  Gift,
  StatUp as TrendingUp,
  RefreshDouble as RefreshCw,
  Cart as ShoppingCart,
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
    isLoading: balanceLoading,
    refresh: refreshBalance,
  } = useVaultBalance();

  const claimBonusMutation = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      soundEffects.bloom();
      notify.success(`Claimed ${data.bonus} IxC daily bonus`);
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
    notify.success("Vault status refreshed");
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Vault status"
        category="Vault"
        description="Your IxCredits balance, daily login bonus and Vault level."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Open Vault</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
            <Button
              type="button"
              onClick={handleRefresh}
              data-cuelume-press="soft"
              title="Sync with server"
              variant="secondary"
              size="icon-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* Balance and daily bonus */}
      <SettingsGroup title="Balance and rewards" description="Your credits and daily streak.">
        <SettingsRow
          label="Available IxCredits"
          description="Credits you can spend on card packs, marketplace trades and cosmetics"
          icon={Coins}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-3">
            <span className="text-foreground text-base font-bold tabular-nums">
              {balanceLoading ? "..." : (balance ?? 0).toLocaleString()} IxC
            </span>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Daily login bonus"
          description={`Claim every day to keep your streak (${loginStreak} ${loginStreak === 1 ? "day" : "days"} so far)`}
          icon={Gift}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={() => claimBonusMutation.mutate()}
            disabled={claimBonusMutation.isPending}
            data-cuelume-press="soft"
            variant="default"
            size="sm"
          >
            {claimBonusMutation.isPending ? "Claiming..." : "Claim daily bonus"}
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {/* Level and activity */}
      <SettingsGroup
        title="Level and activity"
        description="Your Vault level and lifetime credits."
      >
        <SettingsRow
          label="Vault level"
          description={`Tier ${vaultLevel} (${vaultXp.toLocaleString()} XP earned)`}
          icon={Crown}
          glyphClass="bg-muted/60 text-foreground"
        >
          <span className="border-border/60 bg-muted/40 text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold">
            Level {vaultLevel}
          </span>
        </SettingsRow>

        <SettingsRow
          label="Lifetime activity"
          description={`Earned ${lifetimeEarned.toLocaleString()} IxC, spent ${lifetimeSpent.toLocaleString()} IxC`}
          icon={TrendingUp}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="text-right">
            <p className="text-foreground text-xs font-semibold">
              +{todayEarned.toLocaleString()} IxC today
            </p>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
