"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
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

/** Unified Corporate & Procurement Desk: tenders lead when opened via /exchange/tenders. */
export function TendersPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  const directory = api.exchange.listCompanies.useQuery({ realmId }, { enabled: !!isSignedIn });
  if (!isSignedIn)
    return <SignInPrompt title="Companies & tenders" message="Sign in to charter companies and bid on tenders." />;
  if (!overview.data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <ContractsCard overview={overview.data} onChanged={refresh} />
      <CompaniesCard
        overview={overview.data}
        directoryCompanies={directory.data ?? []}
        onChanged={refresh}
      />
    </div>
  );
}

/** Unified Corporate & Procurement Desk: companies lead when opened via /exchange/companies. */
export function MyCompaniesPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  const directory = api.exchange.listCompanies.useQuery({ realmId }, { enabled: !!isSignedIn });
  if (!isSignedIn)
    return <SignInPrompt title="Companies & tenders" message="Sign in to charter companies and bid on tenders." />;
  if (!overview.data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <CompaniesCard
        overview={overview.data}
        directoryCompanies={directory.data ?? []}
        onChanged={refresh}
      />
      <ContractsCard overview={overview.data} onChanged={refresh} />
    </div>
  );
}
