import { act, renderHook } from "@testing-library/react";

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
let mockDetailEnabled: boolean | undefined;
/** The map version the realm answers (undefined until its query does), and what the two overlay queries were given. */
let mockVersion: { realmId: string; version: number } | undefined;
let mockMarkersCall: { input: unknown; enabled?: boolean };
let mockDetailInput: unknown;

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
        useQuery: (input: unknown, opts: { enabled?: boolean }) => {
          mockDetailInput = input;
          mockDetailEnabled = opts.enabled;
          return { data: undefined };
        },
      },
    },
  },
}));

import { getZoomBand, useMapDataBatched } from "~/hooks/useMapDataBatched";
import { CRITICAL_LAYERS } from "~/hooks/useMapData";

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

const loaded = (layers: Record<string, unknown>): LayerResult => ({
  packed: layers,
  error: null,
  isPending: false,
});
const loading: LayerResult = { packed: undefined, error: null, isPending: true };
const none: LayerResult = { packed: undefined, error: null, isPending: false };

const render = (...args: Parameters<typeof useMapDataBatched>) => {
  mockLayerCalls = [];
  return renderHook(() => {
    mockLayerCalls = [];
    return useMapDataBatched(...args);
  });
};

beforeEach(() => {
  mockCritical = loading;
  mockExtra = none;
  mockMarkers = {};
  mockDetailEnabled = undefined;
  mockVersion = { realmId: "default", version: 1 };
  mockMarkersCall = { input: undefined };
  mockDetailInput = undefined;
});

describe("useMapDataBatched layers", () => {
  it("asks for the first-paint layers at the mid bucket, for the realm the map shows", () => {
    render(undefined, undefined, "eurth");
    expect(mockLayerCalls[0]).toEqual({ layers: CRITICAL_LAYERS, realm: "eurth", bucket: 1 });
  });

  it("asks for the detail bucket only past zoom 7, not on every zoom change", () => {
    const { rerender } = renderHook(
      ({ zoom }) => {
        mockLayerCalls = [];
        return useMapDataBatched(undefined, zoom);
      },
      { initialProps: { zoom: 1.8 } }
    );
    expect(mockLayerCalls[0]?.bucket).toBe(1);

    rerender({ zoom: 5 });
    expect(mockLayerCalls[0]?.bucket).toBe(1);

    rerender({ zoom: 7.5 });
    expect(mockLayerCalls[0]?.bucket).toBe(2);
  });

  it("asks for no extra layer as GeoJSON: decorative layers come from tiles", () => {
    render(undefined, 1.8);
    expect(mockLayerCalls[1]?.layers).toEqual([]);
  });

  it("switching climate on fetches just climate, as its own request", () => {
    const { result } = render();
    act(() => result.current.toggleLayer("climate"));
    expect(mockLayerCalls[1]).toMatchObject({ layers: ["climate"], bucket: 1 });
    expect(mockLayerCalls[0]?.layers).toEqual(CRITICAL_LAYERS);
  });

  it("decodes the layers that arrive and orders them for drawing", () => {
    mockCritical = loaded({
      background: packedSquare("land"),
      political: packedSquare("borders"),
    });
    const { result } = render();

    const byType = Object.fromEntries(result.current.mapLayers.map((l) => [l.type, l]));
    expect(byType.political?.data.features[0]?.properties?._id).toBe("borders");
    expect(
      (byType.political?.data.features[0]?.geometry as GeoJSON.Polygon).coordinates[0]![1]
    ).toEqual([1, 0]);
    expect(byType.background?.visible).toBe(true);
  });

  it("lists the tiled layers with no data, visible for their toggles", () => {
    mockCritical = loaded({ political: packedSquare("borders") });
    const { result } = render();
    const byType = Object.fromEntries(result.current.mapLayers.map((l) => [l.type, l]));

    for (const type of ["altitudes", "rivers", "lakes"]) {
      expect(byType[type]?.data.features).toEqual([]);
    }
    expect(byType.altitudes?.visible).toBe(true);
  });

  it("is loading until the first layers arrive, then not, and not again for a newer version", () => {
    mockCritical = loading;
    const { result, rerender } = render();
    expect(result.current.isLoading).toBe(true);

    mockCritical = loaded({ political: packedSquare("borders") });
    rerender();
    expect(result.current.isLoading).toBe(false);

    // a new map version: the layers are pending again, the previous ones stay on show
    mockCritical = { ...loaded({ political: packedSquare("borders") }), isPending: true };
    rerender();
    expect(result.current.isLoading).toBe(false);
  });

  it("reports a layer error", () => {
    const error = new Error("Map layer political could not be loaded (500)");
    mockCritical = { packed: undefined, error, isPending: false };
    expect(render().result.current.error).toBe(error);
  });
});

describe("useMapDataBatched overlays", () => {
  it("passes the POIs and capitals the markers query answers", () => {
    const pois = { type: "FeatureCollection", features: [{ id: "poi" }] };
    const capitals = { type: "FeatureCollection", features: [{ id: "cap" }] };
    mockMarkers = { data: { features: { pois }, capitals, realmId: "r_eurth" } };

    const { result } = render();

    expect(result.current.overlayFeatures?.pois).toBe(pois);
    expect(result.current.capitalsGeoJson).toBe(capitals);
  });

  it("fetches cities and subdivisions once the viewer first passes zoom 3, and keeps them", () => {
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

  it("asks for neither until the version is known", () => {
    mockVersion = undefined;
    renderHook(() => useMapDataBatched(undefined, 5, "eurth"));

    expect(mockMarkersCall.enabled).toBe(false);
    expect(mockDetailEnabled).toBe(false);
  });

  it("asks once the version is known, the detail only past zoom 3", () => {
    renderHook(() => useMapDataBatched(undefined, 1.8));
    expect(mockMarkersCall.enabled).toBe(true);
    expect(mockDetailEnabled).toBe(false);
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
