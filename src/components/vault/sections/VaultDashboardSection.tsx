import { ShellPageHeader } from "~/components/shell/ShellPageHeader";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import type { Figure } from "./dashboard/credits";
import { VaultBalanceCard } from "./dashboard/VaultBalanceCard";
import { VaultHoldings } from "./dashboard/VaultHoldings";
import { VaultUnlocks } from "./dashboard/VaultUnlocks";
import { VaultShowcase } from "./dashboard/VaultShowcase";
import { VaultStatement } from "./dashboard/VaultStatement";
import { VaultMarkTile } from "./dashboard/VaultTitle";

/**
 * The Wallet page. The DOM order is the phone order (balance, achievements, title and Your Vault column, showcase,
 * statement). From `lg`, three columns: balance and achievements side by side (equal width and height; the balance
 * takes both columns when there are none), the showcase under them, the Vault column on the right over both
 * rows, then the statement across the page. `lg:pt-14` clears Halo's floating band, which the desktop page has no
 * header toolbar to do.
 */
export function VaultDashboardSection() {
  const { stats, loading, error } = useVaultStats();
  const figure = (value: number): Figure => (error ? null : loading ? undefined : value);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6 lg:pt-14">
      <div className="lg:col-span-3 lg:hidden">
        <ShellPageHeader title="Vault" leading={<VaultMarkTile />} className="px-0 sm:px-4" />
      </div>
      <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:self-stretch lg:has-[+div:not(:empty)]:col-span-1">
        <VaultBalanceCard
          totalCards={figure(stats.totalCards)}
          deckValue={figure(stats.deckValue)}
        />
      </div>
      <div className="empty:hidden lg:col-start-2 lg:row-start-1 lg:self-stretch">
        <VaultUnlocks />
      </div>
      <div className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
        <VaultHoldings />
      </div>
      <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
        <VaultShowcase />
      </div>
      <div className="lg:col-span-3 lg:row-start-3">
        <VaultStatement />
      </div>
    </div>
  );
}
