/** @jest-environment jsdom */
/**
 * The map version as the client caches by it. The version segment of a map URL is read strictly (digits within a
 * 32-bit integer, nothing a lenient number parse would let through); tile URLs name the realm (encoded), the map
 * version and the tile format, so a changed map or renderer is a new URL, and a source is re-pointed in place when the
 * URL moves; after a bump only the realm's stale-version queries are dropped; and the shared map surface resets its
 * style rather than carry one realm's or theme's layers into the next borrower.
 * Folds: src/tests/lib/maps/decorative-tiles.test.ts, src/tests/lib/maps/stale-map-queries.test.ts,
 * src/tests/lib/maps/map-engine.test.ts
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { applyVectorTiles, tileUrlTemplate } from "~/lib/maps/decorative-tiles";
import { MAX_MAP_VERSION, parseMapVersion } from "~/lib/maps/map-version";
import {
  dropStaleLayerQueries,
  dropStaleOverlayQueries,
  MAP_LAYER_QUERY_KEY,
} from "~/lib/maps/stale-map-queries";

type FakeMapInstance = {
  setStyle: jest.Mock;
  resize: jest.Mock;
  once: (event: string, callback: () => void) => void;
  isStyleLoaded: () => boolean;
};

jest.mock("~/lib/maps/load-maplibre", () => {
  const instances: unknown[] = [];
  class FakeMap {
    setStyle = jest.fn();
    resize = jest.fn();
    isStyleLoaded = () => false;
    constructor() {
      instances.push(this);
    }
    // The base style loads (and a replaced one reloads) a tick after it is asked for
    once(_event: string, callback: () => void) {
      queueMicrotask(callback);
    }
  }
  return { loadMaplibre: jest.fn(async () => ({ Map: FakeMap })), instances };
});

describe("the version segment of a map URL", () => {
  it.each<[string, string, number | null]>([
    ["a realm that was never edited", "0", 0],
    ["the largest version", String(MAX_MAP_VERSION), MAX_MAP_VERSION],
    ["past a 32-bit integer", String(MAX_MAP_VERSION + 1), null],
    ["a form a lenient number parse reads", "1e3", null],
  ])("reads %s strictly", (_name, segment, version) => {
    expect(parseMapVersion(segment)).toBe(version);
  });
});

describe("tile URLs", () => {
  it("name the realm (encoded), the map version, the tile format and the layer, so a new version is a new URL", () => {
    const url = (version: number) =>
      tileUrlTemplate({ realmId: "r eurth/../x", version }, "rivers");
    expect(url(7)).toBe(
      `${window.location.origin}/api/map-tiles/r%20eurth%2F..%2Fx/7/f1/rivers/{z}/{x}/{y}`
    );
    expect(url(8)).not.toBe(url(7));
  });

  it("are a different URL for a different tile format", () => {
    jest.resetModules();
    jest.doMock("~/lib/maps/tile-format", () => ({ TILE_FORMAT_VERSION: 2 }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const next =
        require("~/lib/maps/decorative-tiles") as typeof import("~/lib/maps/decorative-tiles");
      expect(next.tileUrlTemplate({ realmId: "r_eurth", version: 7 }, "rivers")).toBe(
        `${window.location.origin}/api/map-tiles/r_eurth/7/f2/rivers/{z}/{x}/{y}`
      );
    } finally {
      jest.dontMock("~/lib/maps/tile-format");
    }
  });

  it("re-point a tile source in place when the realm's URL moves", () => {
    const setTiles = jest.fn();
    const source = { type: "vector", tiles: ["old"], setTiles };
    const map = { getSource: (id: string) => (id === "source-rivers" ? source : undefined) };
    applyVectorTiles(map as unknown as MapLibreMap, "rivers", "new");
    expect(setTiles).toHaveBeenCalledWith(["new"]);
  });
});

describe("after a map version bump", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient();
  });
  const cached = () =>
    client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);

  it("drops only the realm's layers of other versions that nothing shows", () => {
    const layerKey = (realmId: string, version: number, layer = "political"): QueryKey => [
      MAP_LAYER_QUERY_KEY,
      ...[realmId, version, 1, layer, 1],
    ];
    const keep = [
      layerKey("default", 4),
      layerKey("r_eurth", 1),
      ["other", "default", 3],
      layerKey("default", 2),
    ];
    for (const key of [layerKey("default", 3), layerKey("default", 3, "background"), ...keep])
      client.setQueryData(key, "cached");
    const unsubscribe = new QueryObserver(client, {
      queryKey: layerKey("default", 2),
      queryFn: () => "on screen",
      staleTime: Infinity,
    }).subscribe(() => undefined);

    dropStaleLayerQueries(client, "default", 4);
    expect(cached()).toEqual(keep);

    unsubscribe();
    dropStaleLayerQueries(client, "default", 4);
    expect(cached()).toEqual(keep.slice(0, 3));
  });

  it("drops the realm's markers and detail of other versions, the viewer's own realm named by no slug", () => {
    const overlayKey = (proc: string, input: { realm?: string; version?: number }): QueryKey => [
      ["geoCore", proc],
      { input, type: "query" },
    ];
    const keep = [
      overlayKey("getMapBundleMarkers", { version: 3 }),
      overlayKey("getMapBundleMarkers", { realm: "eurth", version: 2 }),
      overlayKey("getMapBundleDetail", { realm: undefined }),
      ["geoCore", "listCountries"],
    ];
    const stale = [
      overlayKey("getMapBundleMarkers", { version: 2 }),
      overlayKey("getMapBundleDetail", { version: 2 }),
    ];
    for (const key of [...stale, ...keep]) client.setQueryData(key, "cached");

    dropStaleOverlayQueries(client, undefined, 3);

    expect(cached()).toEqual(keep);
  });
});

describe("the shared map surface", () => {
  type Engine = typeof import("~/lib/maps/map-engine");
  type Borrow = { theme: "standard" | "dark"; warmKey?: string };
  let engine: Engine;
  let instances: FakeMapInstance[];

  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.resetModules();
    document.body.innerHTML = "";
    engine = require("~/lib/maps/map-engine") as Engine;
    instances = (require("~/lib/maps/load-maplibre") as { instances: FakeMapInstance[] }).instances;
  });
  afterEach(() => jest.restoreAllMocks());

  /** Borrow the world map on a fresh container, wait until it is ready, hand it back. */
  async function borrow(opts: Borrow) {
    const onReady = jest.fn();
    const handle = engine.acquireSurface("world", {
      container: document.body.appendChild(document.createElement("div")),
      ...opts,
      onReady,
    });
    await handle.ready;
    handle.release();
    return onReady;
  }

  it.each<[string, Borrow, Borrow]>([
    ["the theme changed", { theme: "standard" }, { theme: "dark" }],
    [
      "the map last showed another realm",
      { theme: "standard", warmKey: "default" },
      { theme: "standard", warmKey: "r_eurth" },
    ],
    [
      "the map last showed a realm and the next one is not known yet",
      { theme: "standard", warmKey: "default" },
      { theme: "standard" },
    ],
  ])("puts the base style back when %s, and says so", async (_name, first, second) => {
    await borrow(first);
    const onReady = await borrow(second);
    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
    expect(instances[0]!.setStyle).toHaveBeenCalledWith(expect.anything(), { diff: false });
    expect(onReady).toHaveBeenCalledWith(instances[0], { styleReset: true });
  });
});
