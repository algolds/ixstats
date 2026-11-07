"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { CompaniesCard } from "../CompaniesCard";
import { ContractsCard } from "../ContractsCard";
import { SignInPrompt } from "./SignInPrompt";

/** The signed-in workspace the tenders board and My companies share (getOverview is per player). */
function useOverview(realmId: string) {
  const { isSignedIn } = useAuth();
  const utils = api.useUtils();
  const overview = api.exchange.getOverview.useQuery({ realmId }, { enabled: !!isSignedIn });
  return { isSignedIn, overview, refresh: () => void utils.exchange.invalidate() };
}

/** Government tenders and company contracts: open, awarded and delivered. */
export function TendersPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  if (!isSignedIn)
    return <SignInPrompt title="Tenders" message="Sign in to see open tenders and bid on them." />;
  if (!overview.data) return <Skeleton className="h-64 w-full" />;
  return <ContractsCard overview={overview.data} onChanged={refresh} />;
}

/** Charter and run your companies: capital, credit, decisions and dividends. */
export function MyCompaniesPage({ realmId }: { realmId: string }) {
  const { isSignedIn, overview, refresh } = useOverview(realmId);
  const directory = api.exchange.listCompanies.useQuery({ realmId }, { enabled: !!isSignedIn });
  if (!isSignedIn)
    return <SignInPrompt title="My companies" message="Sign in to charter and run a company." />;
  if (!overview.data) return <Skeleton className="h-64 w-full" />;
  return (
    <CompaniesCard
      overview={overview.data}
      directoryCompanies={directory.data ?? []}
      onChanged={refresh}
    />
  );
}
