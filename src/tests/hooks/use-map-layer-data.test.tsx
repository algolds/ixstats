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

// A getter, so a test can move the loader's output format
let mockFormat = 1;
jest.mock("~/lib/maps/layer-format", () => ({
  get LAYER_FORMAT_VERSION() {
    return mockFormat;
  },
}));
const mockDropLegacy = jest.fn();
jest.mock("~/lib/maps/legacy-map-cache", () => ({
  dropLegacyMapCache: () => mockDropLegacy(),
}));

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
  mockDropLegacy.mockClear();
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

describe("useMapLayerData", () => {
  it("fetches each layer from its versioned URL", async () => {
    const { result } = renderHook(
      () => useMapLayerData({ layers: ["political", "background"], bucket: 2 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(urls().sort()).toEqual([
      "/api/map-layers/default/3/background?bucket=2&format=1",
      "/api/map-layers/default/3/political?bucket=2&format=1",
    ]);
    expect(Object.keys(result.current.packed ?? {}).sort()).toEqual(["background", "political"]);
  });
  it("refetches when the map version changes, showing the old data until the new answers", async () => {
    const { result, rerender } = renderHook(() => useMapLayerData({ layers: ["political"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const before = result.current.packed?.political;
    expect(before?.features[0]?.properties?._id).toBe(
      "/api/map-layers/default/3/political?bucket=1&format=1"
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

    await waitFor(() =>
      expect(urls()).toContain("/api/map-layers/default/4/political?bucket=1&format=1")
    );
    // the map keeps drawing the previous version while the new one downloads
    expect(result.current.packed?.political).toBe(before);

    await act(async () => release());
    await waitFor(() =>
      expect(result.current.packed?.political?.features[0]?.properties?._id).toBe(
        "/api/map-layers/default/4/political?bucket=1&format=1"
      )
    );
  });
  it("escapes the realm in the URL", async () => {
    mockVersion = { realmId: "a/b", version: 0 };
    const { result } = renderHook(() => useMapLayerData({ layers: ["background"] }), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(urls()).toEqual(["/api/map-layers/a%2Fb/0/background?bucket=1&format=1"]);
  });

  it("asks for new URLs when the loader format changes, so bytes cached under the old format are not reused", async () => {
    const { result, rerender } = renderHook(() => useMapLayerData({ layers: ["political"] }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    mockFormat = 2;
    rerender();

    await waitFor(() =>
      expect(urls()).toContain("/api/map-layers/default/3/political?bucket=1&format=2")
    );
  });

  it("shows nothing of the previous realm while a new one loads, and not if it fails", async () => {
    const { result, rerender } = renderHook(
      ({ realm }: { realm: string }) => useMapLayerData({ layers: ["political"], realm }),
      { wrapper, initialProps: { realm: "a" } }
    );
    await waitFor(() => expect(result.current.packed?.political).toBeDefined());

    // another realm: its version arrives, its layer does not (yet, then never)
    mockVersion = { realmId: "r_b", version: 1 };
    // the first request is held back; it and every retry then fail
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

  it("does not retry a layer the server refused: a 404 or 403 is final", async () => {
    fetchMock.mockImplementation(
      async () => ({ ok: false, status: 404, json: async () => ({}) }) as never
    );
    const { result } = renderHook(() => useMapLayerData({ layers: ["political"] }), { wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error?.message).toMatch(/political.*404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
