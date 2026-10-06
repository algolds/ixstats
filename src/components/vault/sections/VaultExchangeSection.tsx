"use client";

import { GraphUp, Lock } from "iconoir-react";
import { api } from "~/trpc/react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CompaniesCard } from "./exchange/CompaniesCard";
import { ContractsCard } from "./exchange/ContractsCard";
import { SovereignWalletCard } from "./exchange/SovereignWalletCard";
import { formatSovereigns, sectorLabel } from "./exchange/shared";

function CompanyDirectory() {
  const companies = api.exchange.listCompanies.useQuery();
  const rows = companies.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Card padding="lg" className="space-y-3">
      <CardTitle icon={<GraphUp />}>Leading companies</CardTitle>
      <ol className="space-y-2">
        {rows.slice(0, 10).map((c, i) => (
          <li key={c.id} className="text-footnote flex items-center justify-between gap-3">
            <span className="text-label min-w-0 truncate">
              <span className="text-label-secondary tabular-nums">{i + 1}.</span> {c.name}{" "}
              <span className="text-label-secondary">{sectorLabel(c.sectorKey)}</span>
            </span>
            <span className="text-label font-medium tabular-nums">
              {formatSovereigns(c.fairValue)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * The Exchange: the Sovereign (₷) wallet and IxCredits bridge, companies and contracts.
 * See docs/systems/exchange.md.
 */
export function VaultExchangeSection() {
  const utils = api.useUtils();
  const overview = api.exchange.getOverview.useQuery();
  const refresh = () => {
    void utils.exchange.getOverview.invalidate();
    void utils.exchange.listCompanies.invalidate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange"
        subtitle="Sovereigns, companies and contracts. Convert IxCredits to found a company, post work and bid on other players' contracts."
      />
      {overview.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !overview.data ? (
        <EmptyState
          title="The Exchange didn't load"
          message={overview.error?.message ?? "Try again in a moment."}
        />
      ) : (
        <>
          {!overview.data.isOpen && (
            <EmptyState
              compact
              icon={<Lock />}
              title="The Exchange is closed right now"
              message="Your balance and companies are safe. Trading reopens when an admin turns it back on."
            />
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <SovereignWalletCard overview={overview.data} onChanged={refresh} />
              <CompanyDirectory />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <CompaniesCard overview={overview.data} onChanged={refresh} />
              <ContractsCard overview={overview.data} onChanged={refresh} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
