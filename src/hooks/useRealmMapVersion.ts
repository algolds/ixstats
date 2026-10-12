"use client";

import { api } from "~/trpc/react";

/** A realm's map version: bumped by every change to its map, and named by its layer and tile URLs, so a new
 * version is a new URL and a browser never serves the old map. Short stale time and a refetch on focus: a change
 * made elsewhere shows once this refetches (the map also invalidates it on a live-sync event or a save). */
const VERSION_QUERY = {
  staleTime: 60_000,
  gcTime: 2 * 60 * 60_000,
  refetchOnWindowFocus: true,
} as const;

/**
 * The realm the viewer's map shows and its map version, `mapVersion: { realmId, version }` (undefined until the
 * query answers; it is the tile source for versioned tile URLs, and names the layer URLs), and the error if it
 * failed. A tiny query the server memoises, so tiles need not wait for the map's layers.
 * @param realm realm slug the map shows (`?realm=`); undefined = the viewer's realm as the server resolves it
 * @param enabled false holds the query back (an embed scrolled out of view)
 */
export function useRealmMapVersion(realm?: string, enabled = true) {
  const { data, error } = api.realms.map.version.useQuery(realm ? { realm } : undefined, {
    ...VERSION_QUERY,
    enabled,
  });
  return { mapVersion: data, error };
}
