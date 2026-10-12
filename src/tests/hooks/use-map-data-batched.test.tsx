import { act, renderHook } from "@testing-library/react";

type LayerCall = { layers: string[]; realm?: string; bucket?: number; enabled?: boolean };
type LayerResult = {
  packed?: Record<string, unknown>;
  error: Error | null;
  isPending: boolean;
  realmId?: string;
};

/** What each useMapLayerData call asked for, in call order within the last render. */
let mockLayerCalls: LayerCall[] = [];
/** What the critical layers (the first call) and any extra layers (the second) answer. */
let mockCritical: LayerResult;
let mockExtra: LayerResult;
let mockMarkers: { data?: { features: unknown; capitals: unknown; realmId: string } };
let mockDetailEnabled: boolean | undefined;
const profile = { country: { realmId: "r_eurth" } };

jest.mock("~/hooks/useMapLayerData", () => ({
  useMapLayerData: (call: LayerCall) => {
    mockLayerCalls.push(call);
    return call.layers.length === 0 || mockLayerCalls.length > 1 ? mockExtra : mockCritical;
  },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    users: { getProfile: { useQuery: () => ({ data: profile }) } },
    geoCore: {
      getMapBundleMarkers: { useQuery: () => mockMarkers },
      getMapBundleDetail: {
        useQuery: (_input: unknown, opts: { enabled?: boolean }) => {
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

const loaded = (layers: Record<string, unknown>, realmId = "r_eurth"): LayerResult => ({
  packed: layers,
  error: null,
  isPending: false,
  realmId,
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

describe("useMapDataBatched realm", () => {
  it("reports the realm the map version names", () => {
    mockCritical = loaded({ political: packedSquare("borders") }, "r_eurth");
    expect(render(undefined, 1.8, "eurth").result.current.realmId).toBe("r_eurth");
  });

  it("knows the viewer's realm before the version arrives, so tiles start at once", () => {
    mockCritical = loading;
    expect(render().result.current.realmId).toBe("r_eurth");
  });

  it("waits for the version when the map names a realm (?realm=)", () => {
    mockCritical = loading;
    expect(render(undefined, 1.8, "eurth").result.current.realmId).toBeUndefined();
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

describe("getZoomBand", () => {
  it("changes where data loading changes: the zoom-3 detail fetch, the zoom-4 overlays, zoom 7", () => {
    expect(getZoomBand(2.9)).not.toBe(getZoomBand(3.1));
    expect(getZoomBand(3.9)).not.toBe(getZoomBand(4.1));
    expect(getZoomBand(6.9)).not.toBe(getZoomBand(7.1));
    expect(getZoomBand(3.2)).toBe(getZoomBand(3.8));
    expect(getZoomBand(1.8)).toBe(getZoomBand(2.9));
  });
});
