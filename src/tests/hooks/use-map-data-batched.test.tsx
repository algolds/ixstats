import { renderHook } from "@testing-library/react";

type LayerCall = { layers: string[]; realm?: string; bucket?: number; enabled?: boolean };
type LayerResult = {
  packed?: Record<string, unknown>;
  error: Error | null;
  isPending: boolean;
};

/** What each useMapLayerData call asked for, in call order within the last render. */
let mockLayerCalls: LayerCall[] = [];
/** What the critical layers (the first call) and any extra layers (the second) answer. */
let mockCritical: LayerResult;
let mockExtra: LayerResult;
let mockMarkers: { data?: { features: unknown; capitals: unknown; realmId: string } };
let mockDetail: { data?: { cities: unknown; subdivisions: unknown } };
/** The map version the realm answers (undefined until its query does), and what the two overlay queries were given. */
let mockVersion: { realmId: string; version: number } | undefined;
let mockMarkersCall: { input: unknown; enabled?: boolean };
let mockDetailInput: unknown;

const mockQueryClient = {};
const mockDropStaleOverlays = jest.fn();
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => mockQueryClient }));
jest.mock("~/lib/maps/stale-map-queries", () => ({
  dropStaleOverlayQueries: (...args: unknown[]) => mockDropStaleOverlays(...args),
}));

jest.mock("~/hooks/useRealmMapVersion", () => ({
  useRealmMapVersion: () => ({ mapVersion: mockVersion, error: null }),
}));

jest.mock("~/hooks/useMapLayerData", () => ({
  useMapLayerData: (call: LayerCall) => {
    mockLayerCalls.push(call);
    return call.layers.length === 0 || mockLayerCalls.length > 1 ? mockExtra : mockCritical;
  },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    geoCore: {
      getMapBundleMarkers: {
        useQuery: (input: unknown, opts: { enabled?: boolean }) => {
          mockMarkersCall = { input, enabled: opts.enabled };
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
  },
}));

import { useMapDataBatched } from "~/hooks/useMapDataBatched";
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
const loading: LayerResult = { packed: undefined, error: null, isPending: true };
const none: LayerResult = { packed: undefined, error: null, isPending: false };
beforeEach(() => {
  mockCritical = loading;
  mockExtra = none;
  mockMarkers = {};
  mockDetail = {};
  mockDropStaleOverlays.mockClear();
  mockVersion = { realmId: "default", version: 1 };
  mockMarkersCall = { input: undefined };
  mockDetailInput = undefined;
});
describe("useMapDataBatched overlay queries follow the realm's map version", () => {
  it("names the version in both queries, so a moved version is a new query that refetches", () => {
    mockVersion = { realmId: "r_eurth", version: 3 };
    const { rerender } = renderHook(() => useMapDataBatched(undefined, 5, "eurth"));
    expect(mockMarkersCall.input).toEqual({ realm: "eurth", version: 3 });
    expect(mockDetailInput).toEqual({ realm: "eurth", version: 3 });

    mockVersion = { realmId: "r_eurth", version: 4 };
    rerender();

    expect(mockMarkersCall.input).toEqual({ realm: "eurth", version: 4 });
    expect(mockDetailInput).toEqual({ realm: "eurth", version: 4 });
  });
});

describe("useMapDataBatched overlays across a map version change", () => {
  const poisV1 = { type: "FeatureCollection", features: [{ id: "poi" }] };
  const capitalsV1 = { type: "FeatureCollection", features: [{ id: "cap" }] };
  const citiesV1 = { type: "FeatureCollection", features: [{ id: "city" }] };

  const loadVersion1 = () => {
    mockVersion = { realmId: "r_eurth", version: 1 };
    mockMarkers = {
      data: { features: { pois: poisV1 }, capitals: capitalsV1, realmId: "r_eurth" },
    };
    mockDetail = { data: { cities: citiesV1, subdivisions: packedSquare("sub") } };
  };
  it("shows nothing of the previous realm while another realm's overlays load", () => {
    loadVersion1();
    const { result, rerender } = renderHook(({ realm }) => useMapDataBatched(undefined, 5, realm), {
      initialProps: { realm: "eurth" },
    });
    expect(result.current.overlayFeatures?.cities).toBe(citiesV1);

    // the other realm's version has not answered, then has but its overlays have not
    mockVersion = undefined;
    mockMarkers = {};
    mockDetail = {};
    rerender({ realm: "other" });
    expect(result.current.overlayFeatures).toBeUndefined();
    expect(result.current.capitalsGeoJson).toBeUndefined();

    mockVersion = { realmId: "r_other", version: 1 };
    rerender({ realm: "other" });
    expect(result.current.overlayFeatures).toBeUndefined();
  });

  it("drops the realm's overlay queries of older versions once the version is known and when it moves", () => {
    mockVersion = undefined;
    const { rerender } = renderHook(() => useMapDataBatched(undefined, 5, "eurth"));
    expect(mockDropStaleOverlays).not.toHaveBeenCalled();

    mockVersion = { realmId: "r_eurth", version: 3 };
    rerender();
    expect(mockDropStaleOverlays).toHaveBeenLastCalledWith(mockQueryClient, "eurth", 3);

    mockVersion = { realmId: "r_eurth", version: 4 };
    rerender();
    expect(mockDropStaleOverlays).toHaveBeenLastCalledWith(mockQueryClient, "eurth", 4);
    expect(mockDropStaleOverlays).toHaveBeenCalledTimes(2);
  });
});
