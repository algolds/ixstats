/**
 * The map's data, keyed by the realm and its map version: each layer downloads from a URL naming the realm, the map
 * version and the loader format, so a moved version or format is a new URL and old bytes are never reused; a refusal
 * is final; nothing of another realm is ever on show. The overlay queries name the version too and drop older ones,
 * tiled sources wait for the version and follow it, and a country's map embed draws the country's own realm, never the
 * viewer's.
 *
 * Folds: src/tests/hooks/use-map-data-batched.test.tsx, src/tests/components/maps/use-world-map-layers-tiles.test.ts,
 * src/tests/hooks/use-country-map-embed.test.tsx
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ReactNode } from "react";

type Version = { realmId: string; version: number } | undefined;
type LayerHooks = typeof import("~/hooks/useMapLayerData");
type LayerCall = Parameters<LayerHooks["useMapLayerData"]>[0];

let mockVersion: Version;
let mockMarkers: { data?: { features: object; capitals: object; realmId: string } };
let mockDetail: { data?: { cities: object; subdivisions: object } };
let mockMarkersInput: unknown;
let mockDetailInput: unknown;
let mockBundle: { country: { realmSlug: string | null }; cities: [] } | undefined;
const mockUtils = { realms: { map: { version: { invalidate: jest.fn() } } } };

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => mockUtils,
    realms: {
      map: { version: { useQuery: () => ({ data: mockVersion, error: null }) } },
    },
    geoCore: {
      getMapBundleMarkers: {
        useQuery: (input: unknown) => {
          mockMarkersInput = input;
          return mockMarkers;
        },
      },
      getMapBundleDetail: {
        useQuery: (input: unknown) => {
          mockDetailInput = input;
          return mockDetail;
        },
      },
    },
    countryGeo: {
      getCountryGeoBundle: { useQuery: () => ({ data: mockBundle, isLoading: false }) },
    },
  },
}));

// A getter, so a test can move the loader's output format
let mockFormat = 1;
jest.mock("~/lib/maps/layer-format", () => ({
  get LAYER_FORMAT_VERSION() {
    return mockFormat;
  },
}));
jest.mock("~/lib/maps/legacy-map-cache", () => ({ dropLegacyMapCache: () => undefined }));
const mockDropStaleOverlays = jest.fn();
jest.mock("~/lib/maps/stale-map-queries", () => ({
  ...jest.requireActual("~/lib/maps/stale-map-queries"),
  dropStaleOverlayQueries: (...args: unknown[]) => mockDropStaleOverlays(...args),
}));
const mockApplyVectorTiles = jest.fn();
jest.mock("~/lib/maps/decorative-tiles", () => ({
  ...jest.requireActual("~/lib/maps/decorative-tiles"),
  applyVectorTiles: (...args: unknown[]) => mockApplyVectorTiles(...args),
  tileUrlTemplate: (source: { realmId: string; version: number }, layer: string) =>
    `tiles/${source.realmId}/${source.version}/${layer}`,
}));
/** The layer hooks run for real unless a test stands in for them (the map's and the embed's own hooks). */
const mockLayers: {
  decoded?: (call: LayerCall) => {
    layers: Record<string, FeatureCollection> | undefined;
    error?: Error | null;
    isPending?: boolean;
  };
} = {};
jest.mock("~/hooks/useMapLayerData", () => {
  const actual = jest.requireActual<LayerHooks>("~/hooks/useMapLayerData");
  return {
    ...actual,
    useDecodedMapLayers: (call: LayerCall) =>
      (mockLayers.decoded ?? actual.useDecodedMapLayers)(call),
  };
});

import { useWorldMapLayers } from "~/components/maps/core/hooks/useWorldMapLayers";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { useMapDataBatched } from "~/hooks/useMapDataBatched";
import { useMapLayerData } from "~/hooks/useMapLayerData";

const packedSquare = (id: string) => ({
  type: "FeatureCollection",
  packed: 4,
  features: [
    {
      type: "Feature",
      properties: { _id: id },
      geometry: {
        type: "Polygon",
        coordinates: [[0, 0, 10000, 0, 0, 10000, -10000, 0, 0, -10000]],
      },
    },
  ],
});

/** fetch answers each layer URL with a packed collection whose feature id names the URL it came from. */
const fetchMock = jest.fn(async (url: string, _init?: { signal?: AbortSignal }) => ({
  ok: true,
  status: 200,
  json: async () => packedSquare(url),
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const urls = () => fetchMock.mock.calls.map(([url]) => url);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  mockFormat = 1;
  mockVersion = { realmId: "default", version: 3 };
  mockMarkers = {};
  mockDetail = {};
  mockMarkersInput = undefined;
  mockDetailInput = undefined;
  mockBundle = undefined;
  mockLayers.decoded = undefined;
  mockDropStaleOverlays.mockClear();
  mockApplyVectorTiles.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async (url) => ({
    ok: true,
    status: 200,
    json: async () => packedSquare(url),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("the map's layers", () => {
  it("download each layer from a URL naming the realm (escaped), its map version and the loader format", async () => {
    mockVersion = { realmId: "a/b", version: 3 };
    const { result } = renderHook(
      () => useMapLayerData({ layers: ["political", "background"], bucket: 2 }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(urls().sort()).toEqual([
      "/api/map-layers/a%2Fb/3/background?bucket=2&format=1",
      "/api/map-layers/a%2Fb/3/political?bucket=2&format=1",
    ]);
    expect(Object.keys(result.current.packed ?? {}).sort()).toEqual(["background", "political"]);
  });

  it("download again when the map version or the loader format moves, keeping the old map drawn until the new one answers", async () => {
    const { result, rerender } = renderHook(() => useMapLayerData({ layers: ["political"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const before = result.current.packed?.political;

    let release: () => void = () => {};
    fetchMock.mockImplementationOnce(
      (url) =>
        new Promise((resolve) => {
          release = () =>
            resolve({ ok: true, status: 200, json: async () => packedSquare(url) } as never);
        })
    );
    mockVersion = { realmId: "default", version: 4 };
    rerender();
    await waitFor(() =>
      expect(urls()).toContain("/api/map-layers/default/4/political?bucket=1&format=1")
    );
    expect(result.current.packed?.political).toBe(before);
    await act(async () => release());
    await waitFor(() =>
      expect(result.current.packed?.political?.features[0]?.properties?._id).toBe(
        "/api/map-layers/default/4/political?bucket=1&format=1"
      )
    );

    // Bytes cached under the old loader format are not reused
    mockFormat = 2;
    rerender();
    await waitFor(() =>
      expect(urls()).toContain("/api/map-layers/default/4/political?bucket=1&format=2")
    );
  });

  it("show nothing of the previous realm while a new one loads, and not if it fails", async () => {
    const { result, rerender } = renderHook(
      ({ realm }: { realm: string }) => useMapLayerData({ layers: ["political"], realm }),
      { wrapper, initialProps: { realm: "a" } }
    );
    await waitFor(() => expect(result.current.packed?.political).toBeDefined());

    // another realm: its version arrives, its layer does not (yet, then never)
    mockVersion = { realmId: "r_b", version: 1 };
    let fail: () => void = () => {};
    const refused = { ok: false, status: 500, json: async () => ({}) } as never;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          fail = () => resolve(refused);
        })
    );
    fetchMock.mockImplementation(async () => refused);
    rerender({ realm: "b" });
    await waitFor(() =>
      expect(urls()).toContain("/api/map-layers/r_b/1/political?bucket=1&format=1")
    );
    expect(result.current.packed).toBeUndefined();

    await act(async () => fail());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.packed).toBeUndefined();
  });

  it("do not retry a layer the server refused: a 404 is final", async () => {
    fetchMock.mockImplementation(
      async () => ({ ok: false, status: 404, json: async () => ({}) }) as never
    );
    const { result } = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/political.*404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the map's overlays", () => {
  it("name the realm's map version, drop older versions' queries, and show nothing of a realm switched away from", () => {
    mockLayers.decoded = () => ({ layers: undefined, error: null, isPending: true });
    const cities = { type: "FeatureCollection", features: [{ id: "city" }] };
    mockVersion = undefined;
    const { result, rerender } = renderHook(
      ({ realm }: { realm: string }) => useMapDataBatched(undefined, 5, realm),
      { wrapper, initialProps: { realm: "eurth" } }
    );
    expect(mockDropStaleOverlays).not.toHaveBeenCalled();

    mockVersion = { realmId: "r_eurth", version: 3 };
    mockMarkers = {
      data: {
        features: { pois: { type: "FeatureCollection", features: [] } },
        capitals: { type: "FeatureCollection", features: [] },
        realmId: "r_eurth",
      },
    };
    mockDetail = { data: { cities, subdivisions: packedSquare("sub") } };
    rerender({ realm: "eurth" });
    expect(mockMarkersInput).toEqual({ realm: "eurth", version: 3 });
    expect(mockDetailInput).toEqual({ realm: "eurth", version: 3 });
    expect(mockDropStaleOverlays).toHaveBeenLastCalledWith(queryClient, "eurth", 3);
    expect(result.current.overlayFeatures?.cities).toBe(cities);

    // An edit moves the version: new queries, and the older ones go
    mockVersion = { realmId: "r_eurth", version: 4 };
    rerender({ realm: "eurth" });
    expect(mockMarkersInput).toEqual({ realm: "eurth", version: 4 });
    expect(mockDetailInput).toEqual({ realm: "eurth", version: 4 });
    expect(mockDropStaleOverlays).toHaveBeenLastCalledWith(queryClient, "eurth", 4);
    expect(mockDropStaleOverlays).toHaveBeenCalledTimes(2);

    // Another realm, whose version and overlays have not answered yet
    mockVersion = undefined;
    mockMarkers = {};
    mockDetail = {};
    rerender({ realm: "other" });
    expect(result.current.overlayFeatures).toBeUndefined();
    expect(result.current.capitalsGeoJson).toBeUndefined();
  });

  it("ask for tiles only once the realm's map version is known, and for new ones only when it moves", () => {
    const sources: Record<string, object> = {
      "source-political": { type: "geojson", setData: jest.fn() },
      "source-rivers": { type: "vector" },
    };
    const map = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === "getSource") return (id: string) => sources[id];
          if (name === "getLayer") return () => undefined;
          return jest.fn();
        },
      }
    ) as unknown as MapLibreMap;
    const { rerender } = renderHook(
      ({ version }: { version: number | undefined }) =>
        useWorldMapLayers({
          isLoaded: true,
          projectionMode: "globe",
          updateDistanceFade: () => {},
          labelFeaturesRef: { current: null },
          map,
          layers: [],
          tileSource: version === undefined ? undefined : { realmId: "r_eurth", version },
        }),
      { initialProps: { version: undefined as number | undefined } }
    );
    expect(mockApplyVectorTiles).not.toHaveBeenCalled();

    rerender({ version: 3 });
    expect(mockApplyVectorTiles).toHaveBeenCalledTimes(3);
    rerender({ version: 3 });
    expect(mockApplyVectorTiles).toHaveBeenCalledTimes(3);
    rerender({ version: 4 });
    expect(mockApplyVectorTiles.mock.calls.slice(3).map((c) => c[2])).toEqual([
      "tiles/r_eurth/4/altitudes",
      "tiles/r_eurth/4/rivers",
      "tiles/r_eurth/4/lakes",
    ]);
  });
});

describe("a country's map embed", () => {
  it("downloads no layer until the country's realm is known, then draws the neighbours from that realm, not the viewer's", () => {
    const political: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { _id: "Urcea" },
          geometry: { type: "Point", coordinates: [0, 0] },
        },
      ],
    };
    let asked: LayerCall | undefined;
    let answer: Record<string, FeatureCollection> | undefined;
    mockLayers.decoded = (call) => {
      asked = call;
      return { layers: answer };
    };
    const { result, rerender } = renderHook(() => useCountryMapEmbed("c1"));
    expect(asked).toMatchObject({ realm: undefined, enabled: false });

    mockBundle = { country: { realmSlug: "eurth" }, cities: [] };
    answer = { political };
    rerender();
    expect(asked).toMatchObject({ layers: ["political"], realm: "eurth", enabled: true });
    expect(result.current.worldPolitical).toBe(political);
  });
});
