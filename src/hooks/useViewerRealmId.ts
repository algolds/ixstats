"use client";

import { api } from "~/trpc/react";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

/**
 * The realm the server resolves for this viewer when a page names none: their active nation's
 * realm, else IxWorld (ruling E-h). Undefined while the profile is loading or unavailable.
 * Shares the `users.getProfile` query other map components already make.
 */
export function useViewerRealmId(): string | undefined {
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!profile) return undefined;
  return profile.country?.realmId ?? DEFAULT_REALM_ID;
}
