"use client";

import { api } from "~/trpc/react";

/** A realm's map version: bumped by every change to its map, and named by its layer and tile URLs, so a new
 * version is a new URL and a browser never serves the old map. Short stale time and a refetch on mount: a change
 * made elsewhere shows once this refetches (the map also invalidates it on a live-sync event or a save). */
const VERSION_QUERY = {
  staleTime: 60_000,
  gcTime: 2 * 60 * 60_000,
} as const;

/**
 * The realm the viewer's map shows and its map version, `mapVersion: { realmId, version }` (undefined until the
 * query answers), and the error if it failed.
 * @param realm realm slug the map shows (`?realm=`); undefined = the viewer's realm
 * @param enabled false holds the query back (an embed scrolled out of view)
 */
export function useRealmMapVersion(realm?: string, enabled = true) {
  const { data, error } = api.realms.map.version.useQuery({ realm }, { ...VERSION_QUERY, enabled });
  return { mapVersion: data, error };
}
