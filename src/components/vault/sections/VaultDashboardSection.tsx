import { useVaultStats } from "~/hooks/vault/useVaultStats";
import type { Figure } from "./dashboard/credits";
import { VaultBalanceCard } from "./dashboard/VaultBalanceCard";
import { VaultHoldings } from "./dashboard/VaultHoldings";
import { VaultLatestUnlock } from "./dashboard/VaultLatestUnlock";
import { VaultShowcase } from "./dashboard/VaultShowcase";
import { VaultStatement } from "./dashboard/VaultStatement";
import { VaultWalletHeader } from "./dashboard/VaultWalletHeader";
import { VaultWikiSignal } from "./dashboard/VaultWikiSignal";

/**
 * The Wallet page: the title, the balance, the showcase, then the statement beside the Vault list
 * and the latest unlock. The DOM order is the phone order (Your Vault and the latest unlock before
 * the statement); from `lg` the statement takes the left two thirds and the list column the right.
 */
export function VaultDashboardSection() {
  const { stats, loading, error } = useVaultStats();
  const figure = (value: number): Figure => (error ? null : loading ? undefined : value);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-3">
        <VaultWalletHeader />
        <VaultWikiSignal />
      </div>
      <div className="lg:col-span-3">
        <VaultBalanceCard
          totalCards={figure(stats.totalCards)}
          deckValue={figure(stats.deckValue)}
        />
      </div>
      <div className="lg:col-span-3">
        <VaultShowcase />
      </div>
      <div className="flex flex-col gap-4 lg:col-start-3 lg:row-start-4">
        <VaultHoldings />
        <VaultLatestUnlock />
      </div>
      <div className="lg:col-span-2 lg:col-start-1 lg:row-start-4">
        <VaultStatement />
      </div>
    </div>
  );
}
