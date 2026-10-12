"use client";

import { api } from "~/trpc/react";
import type { TileSource } from "~/lib/maps/decorative-tiles";

/**
 * The realm a map shows (`?realm=` slug, else the viewer's realm as the server resolves it) and its map version,
 * from which versioned tile URLs are built: an edit bumps the version, so the next URL is new. A tiny query the
 * server memoises, so tiles need not wait for the map's layers. Undefined until it arrives.
 */
export function useRealmMapVersion(realm?: string): TileSource | undefined {
  return api.realms.map.version.useQuery(realm ? { realm } : undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  }).data;
}
