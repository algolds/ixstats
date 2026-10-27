"use client";

import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { inviteVia } from "~/lib/realms/realm-invite";

/** The invite handle in the page's `?via=` (a realm invite link), or null. */
export function useInviteVia(): string | null {
  // Null outside the App Router (tests, pages without search params).
  const params: URLSearchParams | null = useSearchParams();
  return inviteVia(params?.get("via"));
}

/**
 * The page's invite and who sent it: `inviter` is set only when `via` names a player holding a nation in the
 * realm; `pending` while that is still being checked. One query per realm and handle, shared by its callers.
 */
export function useRealmInviter(realmSlug: string) {
  const via = useInviteVia();
  const { data, isLoading } = api.realms.inviter.useQuery(
    { slug: realmSlug, via: via ?? "" },
    { enabled: !!via }
  );
  return { via, inviter: via ? (data ?? null) : null, pending: !!via && !!isLoading };
}
