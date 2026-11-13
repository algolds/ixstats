"use client";

import { useState } from "react";
import { Page } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Pill } from "./terminal/brand";
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
  const contracts = api.exchange.listContracts.useQuery({ scope, realmId: overview.realmId });
  const activeCompanies = overview.companies.filter((c) => c.status === "ACTIVE");
  const realmNations = overview.nations.filter((n) => n.realmId === overview.realmId);
  const rows = contracts.data ?? [];

  const refresh = () => {
    void contracts.refetch();
    onChanged();
  };

  return (
    <div className="space-y-4">
      <LensCard app="exchange" padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardTitle icon={<Page />}>Contracts</CardTitle>
            {!contracts.isLoading && (
              <Badge variant="secondary" className="font-mono tabular-nums">
                {rows.length}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {overview.isOpen && (
              <Pill onClick={() => setPosting(true)}>Post a contract or tender</Pill>
            )}
          </div>
        </div>
      </LensCard>

      {overview.isOpen && (
        <Sheet open={posting} onOpenChange={setPosting}>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Post a contract or tender</SheetTitle>
              <SheetDescription>
                Escrow work from a company, nation treasury, or realm faucet for bids.
              </SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <ContractForm
                realmId={overview.realmId}
                companies={activeCompanies}
                nations={realmNations.length > 0 ? realmNations : overview.nations}
                walletBalance={overview.wallet.sovereigns}
                canManageRealm={overview.canManageRealm}
                onDone={() => {
                  setPosting(false);
                  setScope("mine");
                  refresh();
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {contracts.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <LensCard app="exchange" padding="lg">
          <EmptyState
            compact
            icon={<Page />}
            title={scope === "open" ? "No open contracts" : "No contracts yet"}
            message={
              scope === "open"
                ? "When a company or nation posts work in this realm, it shows up here for bids."
                : "Contracts your companies post, bid on or win show up here."
            }
          />
        </LensCard>
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
    </div>
  );
}
