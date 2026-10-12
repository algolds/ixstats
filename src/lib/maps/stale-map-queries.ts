import type { QueryClient } from "@tanstack/react-query";

/** Key prefix of every layer query: `[prefix, realmId, version, format, layer, bucket]`. */
export const MAP_LAYER_QUERY_KEY = "map-layer";

// Versioned map queries never go stale: a bump moves the key, so the old version's entries are dead weight (the
// layers alone are ~5 MB parsed per version) that React Query would keep for its 2 h gcTime. The bytes stay in the
// browser's HTTP cache, so dropping them costs nothing. Queries something still observes are left alone.

/** Drop a realm's layer queries for every map version but `version`. */
export function dropStaleLayerQueries(client: QueryClient, realmId: string, version: number): void {
  client.removeQueries({
    queryKey: [MAP_LAYER_QUERY_KEY, realmId],
    predicate: (query) => query.queryKey[2] !== version && query.getObserversCount() === 0,
  });
}

/** The tRPC reads that follow the map version: `[[router, procedure], { input: { realm, version }, type }]`. */
const OVERLAY_PROCEDURES = [
  ["geoCore", "getMapBundleMarkers"],
  ["geoCore", "getMapBundleDetail"],
];

type OverlayKey = readonly [readonly string[], { input?: { realm?: string; version?: number } }?];

/** Drop the markers and detail queries of a realm (by slug; undefined = the viewer's own) for every map version but `version`. */
export function dropStaleOverlayQueries(
  client: QueryClient,
  realm: string | undefined,
  version: number
): void {
  for (const procedure of OVERLAY_PROCEDURES) {
    client.removeQueries({
      queryKey: [procedure],
      predicate: (query) => {
        const input = (query.queryKey as OverlayKey)[1]?.input;
        return (
          typeof input?.version === "number" &&
          input.realm === realm &&
          input.version !== version &&
          query.getObserversCount() === 0
        );
      },
    });
  }
}
