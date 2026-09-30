import { renderHook, waitFor } from "@testing-library/react";

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

jest.mock("~/trpc/react", () => ({
  api: {
    // Extra (non-critical) layers load through one query per layer; none are on by default.
    useQueries: (
      _queries: unknown,
      opts?: { combine?: (results: Array<{ data?: unknown }>) => unknown }
    ) => (opts?.combine ? opts.combine([]) : []),
    users: { getProfile: { useQuery: () => ({ data: profile }) } },
    geoCore: {
      getMapBundle: { useQuery: () => bundleResult },
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

import { useMapDataBatched } from "~/hooks/useMapDataBatched";

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
});
