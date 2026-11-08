"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";

/** The nation the viewer can trade for in this realm (its wealth fund), or undefined. */
export function useTreasuryActor(
  realmId: string | undefined
): { countryId: string; name: string } | undefined {
  const { isSignedIn } = useAuth();
  const overview = api.exchange.getOverview.useQuery(
    { realmId },
    { enabled: !!isSignedIn && !!realmId }
  );
  const nation = overview.data?.nations.find((n) => n.realmId === realmId);
  return nation ? { countryId: nation.id, name: nation.name } : undefined;
}
