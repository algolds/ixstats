import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  dropStaleLayerQueries,
  dropStaleOverlayQueries,
  MAP_LAYER_QUERY_KEY,
} from "~/lib/maps/stale-map-queries";

let client: QueryClient;

const layerKey = (realmId: string, version: number, layer = "political") => [
  MAP_LAYER_QUERY_KEY,
  realmId,
  version,
  1,
  layer,
  1,
];
const overlayKey = (proc: string, input: { realm?: string; version?: number }) => [
  ["geoCore", proc],
  { input, type: "query" },
];
const keys = (prefix: string) =>
  client
    .getQueryCache()
    .getAll()
    .map((q) => q.queryKey)
    .filter((k) => JSON.stringify(k).includes(prefix));

beforeEach(() => {
  client = new QueryClient();
});

describe("dropStaleLayerQueries", () => {
  it("drops the realm's layers of other versions and keeps the current version's", () => {
    client.setQueryData(layerKey("default", 3), "old");
    client.setQueryData(layerKey("default", 3, "background"), "old");
    client.setQueryData(layerKey("default", 4), "current");

    dropStaleLayerQueries(client, "default", 4);

    expect(keys(MAP_LAYER_QUERY_KEY)).toEqual([layerKey("default", 4)]);
  });

  it("keeps another realm's layers", () => {
    client.setQueryData(layerKey("default", 3), "old");
    client.setQueryData(layerKey("r_eurth", 1), "other realm");

    dropStaleLayerQueries(client, "default", 4);

    expect(keys(MAP_LAYER_QUERY_KEY)).toEqual([layerKey("r_eurth", 1)]);
  });

  it("keeps a layer something still shows, whatever its version", () => {
    client.setQueryData(layerKey("default", 3), "in use");
    const unsubscribe = new QueryObserver(client, {
      queryKey: layerKey("default", 3),
      queryFn: () => "in use",
      staleTime: Infinity,
    }).subscribe(() => undefined);

    dropStaleLayerQueries(client, "default", 4);
    expect(keys(MAP_LAYER_QUERY_KEY)).toHaveLength(1);

    unsubscribe();
    dropStaleLayerQueries(client, "default", 4);
    expect(keys(MAP_LAYER_QUERY_KEY)).toHaveLength(0);
  });

  it("leaves queries that are not layers alone", () => {
    client.setQueryData(["other", "default", 3], "x");
    dropStaleLayerQueries(client, "default", 4);
    expect(client.getQueryCache().getAll()).toHaveLength(1);
  });
});

describe("dropStaleOverlayQueries", () => {
  it("drops the realm's markers and detail of other versions", () => {
    client.setQueryData(overlayKey("getMapBundleMarkers", { realm: "eurth", version: 3 }), "old");
    client.setQueryData(overlayKey("getMapBundleDetail", { realm: "eurth", version: 3 }), "old");
    client.setQueryData(overlayKey("getMapBundleMarkers", { realm: "eurth", version: 4 }), "new");
    client.setQueryData(overlayKey("getMapBundleDetail", { realm: "eurth", version: 4 }), "new");

    dropStaleOverlayQueries(client, "eurth", 4);

    expect(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey)
    ).toEqual([
      overlayKey("getMapBundleMarkers", { realm: "eurth", version: 4 }),
      overlayKey("getMapBundleDetail", { realm: "eurth", version: 4 }),
    ]);
  });

  it("matches the viewer's own realm (no slug) and keeps other realms and unversioned reads", () => {
    client.setQueryData(overlayKey("getMapBundleMarkers", { version: 2 }), "old, own realm");
    client.setQueryData(overlayKey("getMapBundleMarkers", { realm: "eurth", version: 2 }), "other");
    client.setQueryData(overlayKey("getMapBundleDetail", { realm: undefined }), "unversioned");
    client.setQueryData(["geoCore", "listCountries"], "not an overlay");

    dropStaleOverlayQueries(client, undefined, 3);

    expect(client.getQueryCache().getAll()).toHaveLength(3);
    expect(client.getQueryData(overlayKey("getMapBundleMarkers", { version: 2 }))).toBeUndefined();
  });
});
