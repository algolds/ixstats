"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";

/** The signed-in viewer's Exchange overview for a realm (shared cache). */
export function useRealmOverview(realmId: string | undefined) {
  const { isSignedIn } = useAuth();
  return api.exchange.getOverview.useQuery({ realmId }, { enabled: !!isSignedIn && !!realmId });
}

/** The nation the viewer can trade for in this realm (its wealth fund), or undefined. */
export function useTreasuryActor(
  realmId: string | undefined
): { countryId: string; name: string } | undefined {
  const overview = useRealmOverview(realmId);
  const nation = overview.data?.nations.find((n) => n.realmId === realmId);
  return nation ? { countryId: nation.id, name: nation.name } : undefined;
}
