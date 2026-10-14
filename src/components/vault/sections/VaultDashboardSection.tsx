import { useVaultStats } from "~/hooks/vault/useVaultStats";
import type { Figure } from "./dashboard/credits";
import { VaultAccountHero } from "./dashboard/VaultAccountHero";
import { VaultHoldings } from "./dashboard/VaultHoldings";
import { VaultStatement } from "./dashboard/VaultStatement";

/**
 * The Wallet page: the account hero across the top, then the holdings and the statement. The DOM
 * order is the phone order (hero, holdings, statement); from `lg` the statement takes the left two
 * thirds and the holdings the right column beside it.
 */
export function VaultDashboardSection() {
  const { stats, loading, error } = useVaultStats();
  const deckValue: Figure = error ? null : loading ? undefined : stats.deckValue;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-3">
        <VaultAccountHero deckValue={deckValue} unopenedPacks={stats.unopenedPacks} />
      </div>
      <div className="lg:col-start-3 lg:row-start-2">
        <VaultHoldings
          totalCards={stats.totalCards}
          deckValue={deckValue}
          unopenedPacks={stats.unopenedPacks}
        />
      </div>
      <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
        <VaultStatement />
      </div>
    </div>
  );
}
