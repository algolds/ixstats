"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";

/** The Wallet's title with its actions: the daily claim (only while it is claimable) and the Store. */
export function VaultWalletHeader() {
  const { open: openDailyReward } = useDailyReward();
  const balance = api.vault.getBalance.useQuery();

  return (
    <ShellPageHeader
      title="Wallet"
      phoneOnly={false}
      className="px-0"
      actions={
        <>
          {balance.data?.canClaimDailyBonus && (
            <Button type="button" size="sm" onClick={openDailyReward}>
              Claim daily reward
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/vault/store">Store</Link>
          </Button>
        </>
      }
    />
  );
}
