import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Version = { realmId: string; version: number } | undefined;

let mockVersion: Version;
let mockVersionError: Error | null = null;
const mockInvalidateVersion = jest.fn();
const mockUtils = { realms: { map: { version: { invalidate: mockInvalidateVersion } } } };
const mockVersionQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => mockUtils,
    realms: {
      map: {
        version: {
          useQuery: (input: unknown, opts: unknown) => {
            mockVersionQuery(input, opts);
            return { data: mockVersion, error: mockVersionError };
          },
        },
      },
    },
  },
}));

import {
  mapLayerUrl,
  useRetryMapLayers,
  useDecodedMapLayers,
  useMapLayerData,
} from "~/hooks/useMapLayerData";

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
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockVersion = { realmId: "default", version: 3 };
  mockVersionError = null;
  mockVersionQuery.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async (url) => ({
    ok: true,
    status: 200,
    json: async () => packedSquare(url),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("mapLayerUrl", () => {
  it("names the realm, the map version, the layer and the zoom bucket", () => {
    expect(mapLayerUrl("default", 3, "political", 1)).toBe(
      "/api/map-layers/default/3/political?bucket=1"
    );
  });

  it("escapes the realm", () => {
    expect(mapLayerUrl("a/b", 0, "background", 2)).toBe(
      "/api/map-layers/a%2Fb/0/background?bucket=2"
    );
  });
});

describe("useMapLayerData", () => {
  it("fetches each layer from its versioned URL", async () => {
    const { result } = renderHook(
      () => useMapLayerData({ layers: ["political", "background"], bucket: 2 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(urls().sort()).toEqual([
      "/api/map-layers/default/3/background?bucket=2",
      "/api/map-layers/default/3/political?bucket=2",
    ]);
    expect(Object.keys(result.current.packed ?? {}).sort()).toEqual(["background", "political"]);
    expect(result.current.realmId).toBe("default");
  });

  it("defaults to the mid zoom bucket and asks the version of the realm it was given", async () => {
    const { result } = renderHook(
      () => useMapLayerData({ layers: ["political"], realm: "eurth" }),
      {
        wrapper,
      }
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(urls()).toEqual(["/api/map-layers/default/3/political?bucket=1"]);
    expect(mockVersionQuery).toHaveBeenCalledWith({ realm: "eurth" }, expect.anything());
  });

  it("waits for the version, fetching nothing and reporting it is pending", () => {
    mockVersion = undefined;
    const { result } = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.packed).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a version it could not get, rather than waiting for it forever", () => {
    mockVersion = undefined;
    mockVersionError = new Error("version query failed");
    const { result } = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });
    expect(result.current.error?.message).toBe("version query failed");
  });

  it("holds every request back while disabled, the version query included", () => {
    renderHook(() => useMapLayerData({ layers: ["political"], enabled: false }), { wrapper });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockVersionQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
  });

  it("refetches when the map version changes, showing the old data until the new answers", async () => {
    const { result, rerender } = renderHook(() => useMapLayerData({ layers: ["political"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const before = result.current.packed?.political;
    expect(before?.features[0]?.properties?._id).toBe(
      "/api/map-layers/default/3/political?bucket=1"
    );

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

    await waitFor(() => expect(urls()).toContain("/api/map-layers/default/4/political?bucket=1"));
    // the map keeps drawing the previous version while the new one downloads
    expect(result.current.packed?.political).toBe(before);

    await act(async () => release());
    await waitFor(() =>
      expect(result.current.packed?.political?.features[0]?.properties?._id).toBe(
        "/api/map-layers/default/4/political?bucket=1"
      )
    );
  });

  it("downloads nothing again for an unchanged version, even in a fresh mount", async () => {
    const first = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });
    await waitFor(() => expect(first.result.current.isPending).toBe(false));
    first.unmount();

    const second = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });

    expect(second.result.current.packed?.political).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches only the added layer when another is switched on", async () => {
    const { result, rerender } = renderHook(
      ({ layers }: { layers: Array<"political" | "climate"> }) => useMapLayerData({ layers }),
      { wrapper, initialProps: { layers: ["political"] } }
    );
    await waitFor(() => expect(result.current.isPending).toBe(false));
    fetchMock.mockClear();

    rerender({ layers: ["political", "climate"] });
    await waitFor(() => expect(Object.keys(result.current.packed ?? {})).toContain("climate"));

    expect(urls()).toEqual(["/api/map-layers/default/3/climate?bucket=1"]);
  });

  it("reports a layer that cannot be loaded, and still delivers the others", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.includes("political")
        ? ({ ok: false, status: 500, json: async () => ({}) } as never)
        : ({ ok: true, status: 200, json: async () => packedSquare(url) } as never)
    );
    const { result } = renderHook(() => useMapLayerData({ layers: ["political", "background"] }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.error?.message).toMatch(/political.*500/);
    expect(Object.keys(result.current.packed ?? {})).toEqual(["background"]);
  });
});

describe("useRetryMapLayers", () => {
  it("asks for the map version again and downloads the layers again", async () => {
    const { result } = renderHook(
      () => ({ layers: useMapLayerData({ layers: ["political"] }), retry: useRetryMapLayers() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.layers.isPending).toBe(false));

    await act(async () => result.current.retry());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(mockInvalidateVersion).toHaveBeenCalledTimes(1);
  });
});

describe("useDecodedMapLayers", () => {
  it("decodes the packed layers to GeoJSON, keeping each decoded layer for as long as it is the same", async () => {
    const { result, rerender } = renderHook(() => useDecodedMapLayers({ layers: ["political"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.layers).toBeDefined());

    const ring = (result.current.layers!.political!.features[0]!.geometry as GeoJSON.Polygon)
      .coordinates[0]!;
    expect(ring[0]).toEqual([0, 0]);
    expect(ring[1]).toEqual([1, 0]);

    const decoded = result.current.layers;
    rerender();
    expect(result.current.layers).toBe(decoded);
  });
});
