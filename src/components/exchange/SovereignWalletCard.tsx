"use client";

import { Wallet } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Card, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import { activitySourceLabel } from "~/lib/vault/activity-labels";
import { formatSovereigns } from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];

/** ₷ balance and recent ledger rows. */
export function SovereignWalletCard({ overview }: { overview: Overview }) {
  const { wallet, transactions } = overview;
  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle icon={<Wallet />}>Sovereign wallet</CardTitle>
      <Stat label="Sovereigns" value={formatSovereigns(wallet.sovereigns)} />

      {transactions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-footnote text-label font-medium">Recent activity</h3>
          <ul className="space-y-1">
            {transactions.map((t) => (
              <li key={t.id} className="text-footnote flex items-center justify-between gap-3">
                <span className="text-label-secondary truncate">
                  {activitySourceLabel(t.source.split(":")[0] ?? t.source)}
                </span>
                <span
                  className={
                    t.sovereigns >= 0
                      ? "text-success font-medium tabular-nums"
                      : "text-label font-medium tabular-nums"
                  }
                >
                  {t.sovereigns >= 0 ? "+" : ""}
                  {formatSovereigns(t.sovereigns)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
