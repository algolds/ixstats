"use client";

import { useState } from "react";
import { Page } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { ContractForm } from "./ContractForm";
import { ContractRow } from "./ContractRow";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Scope = "open" | "mine";

/** Open contracts to bid on, my contracts, and the form to post one. */
export function ContractsCard({
  overview,
  onChanged,
}: {
  overview: Overview;
  onChanged: () => void;
}) {
  const [scope, setScope] = useState<Scope>("open");
  const [posting, setPosting] = useState(false);
  const contracts = api.exchange.listContracts.useQuery({ scope });
  const activeCompanies = overview.companies.filter((c) => c.status === "ACTIVE");
  const rows = contracts.data ?? [];

  const refresh = () => {
    void contracts.refetch();
    onChanged();
  };

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<Page />}>Contracts</CardTitle>
        <SegmentedControl
          aria-label="Contracts"
          size="sm"
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          options={[
            { value: "open", label: "Open" },
            { value: "mine", label: "Mine" },
          ]}
        />
      </div>

      {overview.isOpen && (activeCompanies.length > 0 || overview.nations.length > 0) && (
        <div className="space-y-3">
          <Button size="sm" variant="secondary" onClick={() => setPosting((p) => !p)}>
            {posting ? "Close" : "Post a contract"}
          </Button>
          {posting && (
            <ContractForm
              companies={activeCompanies}
              nations={overview.nations}
              walletBalance={overview.wallet.sovereigns}
              onDone={() => {
                setPosting(false);
                setScope("mine");
                refresh();
              }}
            />
          )}
        </div>
      )}

      {contracts.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={<Page />}
          title={scope === "open" ? "No open contracts" : "No contracts yet"}
          message={
            scope === "open"
              ? "When a company posts work, it shows up here for bids."
              : "Contracts your companies post, bid on or win show up here."
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <ContractRow
              key={c.id}
              contract={c}
              companies={activeCompanies}
              isOpen={overview.isOpen}
              onDone={refresh}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
