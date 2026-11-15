"use client";

import { useAuth } from "@clerk/nextjs";
import { WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { CompaniesCard } from "../CompaniesCard";
import { ContractsCard } from "../ContractsCard";
import { SignInPrompt } from "./SignInPrompt";

/** The signed-in workspace that Companies and Tenders share (getOverview is per player). */
function useOverview(realmId: string) {
  const { isSignedIn } = useAuth();
  const utils = api.useUtils();
  const overview = api.exchange.getOverview.useQuery({ realmId }, { enabled: !!isSignedIn });
  return { isSignedIn, overview, refresh: () => void utils.exchange.invalidate() };
}

function OverviewError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <LensCard app="exchange" padding="lg">
      <EmptyState
        role="alert"
        compact
        icon={<WarningCircle />}
        title="The corporate desk did not load"
        message={message ?? "Try again in a moment."}
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    </LensCard>
  );
}

/** Unified Corporate & Procurement Desk: tenders lead when opened via /exchange/tenders. */
export function TendersPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  const directory = api.exchange.listCompanies.useQuery({ realmId }, { enabled: !!isSignedIn });
  if (!isSignedIn) {
    return (
      <SignInPrompt
        title="Companies & tenders"
        message="Sign in to charter companies and bid on tenders."
      />
    );
  }
  if (overview.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!overview.data) {
    return (
      <OverviewError message={overview.error?.message} onRetry={() => void overview.refetch?.()} />
    );
  }
  return (
    <div className="space-y-6">
      <ContractsCard overview={overview.data} onChanged={refresh} primaryAction />
      <CompaniesCard
        overview={overview.data}
        directoryCompanies={directory.data ?? []}
        onChanged={refresh}
        primaryAction={false}
      />
    </div>
  );
}

/** Unified Corporate & Procurement Desk: companies lead when opened via /exchange/companies. */
export function MyCompaniesPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  const directory = api.exchange.listCompanies.useQuery({ realmId }, { enabled: !!isSignedIn });
  if (!isSignedIn) {
    return (
      <SignInPrompt
        title="Companies & tenders"
        message="Sign in to charter companies and bid on tenders."
      />
    );
  }
  if (overview.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!overview.data) {
    return (
      <OverviewError message={overview.error?.message} onRetry={() => void overview.refetch?.()} />
    );
  }
  return (
    <div className="space-y-6">
      <CompaniesCard
        overview={overview.data}
        directoryCompanies={directory.data ?? []}
        onChanged={refresh}
        primaryAction
      />
      <ContractsCard overview={overview.data} onChanged={refresh} primaryAction={false} />
    </div>
  );
}
