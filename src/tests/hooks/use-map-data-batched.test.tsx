import { act, renderHook, waitFor } from "@testing-library/react";

type BundleResult = {
  data?: {
    worldMap: Record<string, unknown>;
    realmId?: string;
    features?: unknown;
    capitals?: unknown;
  };
  isLoading: boolean;
  error: null;
  isPlaceholderData: boolean;
};

let bundleResult: BundleResult;
const profile = { country: { realmId: "r_eurth" } };
/** The getWorldMap inputs of the per-layer queries the hook last asked for. */
let mockLayerQueries: unknown[] = [];
/** Whether the cities-and-subdivisions query was last enabled. */
let mockDetailEnabled: boolean | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    // Decorative and extra layers load through one query per layer.
    useQueries: (
      queries: (t: { geoCore: { getWorldMapPacked: (input: unknown) => unknown } }) => unknown[],
      opts?: { combine?: (results: Array<{ data?: unknown }>) => unknown }
    ) => {
      mockLayerQueries = queries({ geoCore: { getWorldMapPacked: (input) => input } });
      return opts?.combine ? opts.combine([]) : [];
    },
    users: { getProfile: { useQuery: () => ({ data: profile }) } },
    geoCore: {
      getMapBundle: { useQuery: () => bundleResult },
      getMapBundleDetail: {
        useQuery: (_input: unknown, opts: { enabled?: boolean }) => {
          mockDetailEnabled = opts.enabled;
          return { data: undefined };
        },
      },
      getWorldMap: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
  },
}));

const getCachedMapLayers = jest.fn();
const setCachedMapLayers = jest.fn();
jest.mock("~/lib/maps/map-idb-cache", () => ({
  ...jest.requireActual("~/lib/maps/map-idb-cache"),
  getCachedMapLayers: (...args: unknown[]) => getCachedMapLayers(...args),
  setCachedMapLayers: (...args: unknown[]) => setCachedMapLayers(...args),
}));

import { getZoomBand, useMapDataBatched } from "~/hooks/useMapDataBatched";

const ixworldBorders = { type: "FeatureCollection", features: [{ id: "ixworld" }] };
const eurthBorders = { type: "FeatureCollection", features: [{ id: "eurth" }] };

describe("useMapDataBatched IndexedDB cache", () => {
  beforeEach(() => {
    getCachedMapLayers.mockReset().mockResolvedValue(null);
    setCachedMapLayers.mockReset().mockResolvedValue(undefined);
  });

  it("reads the cache for the viewer's resolved realm", async () => {
    bundleResult = { data: undefined, isLoading: true, error: null, isPlaceholderData: false };
    renderHook(() => useMapDataBatched());

    await waitFor(() =>
      expect(getCachedMapLayers).toHaveBeenCalledWith({
        realm: undefined,
        viewerRealmId: "r_eurth",
      })
    );
  });

  it("never writes the cache-backed placeholder back to the cache", async () => {
    bundleResult = {
      data: { worldMap: { political: ixworldBorders } },
      isLoading: false,
      error: null,
      isPlaceholderData: true,
    };
    renderHook(() => useMapDataBatched());
    await waitFor(() => expect(getCachedMapLayers).toHaveBeenCalled());

    expect(setCachedMapLayers).not.toHaveBeenCalled();
  });

  it("writes the server's layers tagged with the realm the bundle resolved", async () => {
    bundleResult = {
      data: { worldMap: { political: eurthBorders }, realmId: "r_eurth" },
      isLoading: false,
      error: null,
      isPlaceholderData: false,
    };
    renderHook(() => useMapDataBatched());

    await waitFor(() =>
      expect(setCachedMapLayers).toHaveBeenCalledWith(
        { realm: undefined, viewerRealmId: "r_eurth" },
        { political: eurthBorders },
        "r_eurth"
      )
    );
  });

  it("asks for no layer as GeoJSON: decorative layers come from tiles", () => {
    bundleResult = { data: undefined, isLoading: true, error: null, isPlaceholderData: false };
    renderHook(() => useMapDataBatched(undefined, 1.8));
    expect(mockLayerQueries).toEqual([]);
  });

  it("switching climate on fetches just climate, as GeoJSON", () => {
    bundleResult = { data: undefined, isLoading: true, error: null, isPlaceholderData: false };
    const { result } = renderHook(() => useMapDataBatched());
    act(() => result.current.toggleLayer("climate"));
    expect(mockLayerQueries).toEqual([{ layers: ["climate"], realm: undefined }]);
  });

  it("lists the tiled layers with no data, even when an old cache entry carries rivers", () => {
    const rivers = { type: "FeatureCollection", features: [{ id: "old-river" }] };
    bundleResult = {
      data: { worldMap: { political: eurthBorders, rivers }, realmId: "r_eurth" },
      isLoading: false,
      error: null,
      isPlaceholderData: true,
    };
    const { result } = renderHook(() => useMapDataBatched());
    const byType = Object.fromEntries(result.current.mapLayers.map((l) => [l.type, l]));

    for (const type of ["altitudes", "rivers", "lakes"]) {
      expect(byType[type]?.data.features).toEqual([]);
    }
    expect(byType.altitudes?.visible).toBe(true);
    expect(byType.political?.data).toEqual(eurthBorders);
  });

  it("reports the realm the bundle resolved", () => {
    bundleResult = {
      data: { worldMap: { political: eurthBorders }, realmId: "r_eurth" },
      isLoading: false,
      error: null,
      isPlaceholderData: false,
    };
    expect(
      renderHook(() => useMapDataBatched(undefined, 1.8, "eurth")).result.current.realmId
    ).toBe("r_eurth");
  });

  it("knows the viewer's realm before the bundle arrives, so tiles start at once", () => {
    bundleResult = { data: undefined, isLoading: true, error: null, isPlaceholderData: false };
    expect(renderHook(() => useMapDataBatched()).result.current.realmId).toBe("r_eurth");
  });

  it("waits for the server's answer when the map names a realm (?realm=)", () => {
    bundleResult = {
      data: { worldMap: { political: eurthBorders } },
      isLoading: false,
      error: null,
      isPlaceholderData: true,
    };
    expect(
      renderHook(() => useMapDataBatched(undefined, 1.8, "eurth")).result.current.realmId
    ).toBeUndefined();
  });

  it("fetches cities and subdivisions once the viewer first passes zoom 3, and keeps them", () => {
    bundleResult = { data: undefined, isLoading: true, error: null, isPlaceholderData: false };
    const { rerender } = renderHook(({ zoom }) => useMapDataBatched(undefined, zoom), {
      initialProps: { zoom: 1.8 },
    });
    expect(mockDetailEnabled).toBe(false);

    rerender({ zoom: 3.2 });
    expect(mockDetailEnabled).toBe(true);

    rerender({ zoom: 1.8 });
    expect(mockDetailEnabled).toBe(true);
  });
});

describe("getZoomBand", () => {
  it("changes where data loading changes: the zoom-3 detail fetch, the zoom-4 overlays, zoom 7", () => {
    expect(getZoomBand(2.9)).not.toBe(getZoomBand(3.1));
    expect(getZoomBand(3.9)).not.toBe(getZoomBand(4.1));
    expect(getZoomBand(6.9)).not.toBe(getZoomBand(7.1));
    expect(getZoomBand(3.2)).toBe(getZoomBand(3.8));
    expect(getZoomBand(1.8)).toBe(getZoomBand(2.9));
  });
});
