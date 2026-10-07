import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

const applyVectorTiles = jest.fn();
jest.mock("~/lib/maps/decorative-tiles", () => ({
  ...jest.requireActual("~/lib/maps/decorative-tiles"),
  applyVectorTiles: (...args: unknown[]) => applyVectorTiles(...args),
  tileUrlTemplate: (realmId: string, layer: string) => `tiles/${realmId}/${layer}`,
}));

import { useWorldMapLayers } from "~/components/maps/core/hooks/useWorldMapLayers";

const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
const borders: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { _id: "a" }, geometry: { type: "Point", coordinates: [0, 0] } },
  ],
};

/** A map whose every method is a no-op mock, except the sources this test cares about. */
function fakeMap(riversType: "vector" | "geojson" = "vector") {
  const politicalSetData = jest.fn();
  const riversSetData = jest.fn();
  const sources: Record<string, object> = {
    "source-political": { type: "geojson", setData: politicalSetData },
    "source-rivers":
      riversType === "vector" ? { type: "vector" } : { type: "geojson", setData: riversSetData },
  };
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "getSource") return (id: string) => sources[id];
        if (name === "getLayer") return () => undefined;
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  return { map, politicalSetData, riversSetData, method: (name: string) => methods.get(name) };
}

const baseProps = {
  isLoaded: true,
  projectionMode: "globe" as const,
  updateDistanceFade: () => {},
  labelFeaturesRef: { current: null },
};

describe("useWorldMapLayers with tiled layers", () => {
  beforeEach(() => applyVectorTiles.mockClear());

  it("never pushes GeoJSON into a tiled layer's source", () => {
    const { map, politicalSetData } = fakeMap();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() =>
      useWorldMapLayers({
        ...baseProps,
        map,
        layers: [
          { type: "rivers", data: empty, visible: true },
          { type: "political", data: borders, visible: true },
        ],
      })
    );

    expect(politicalSetData).toHaveBeenCalledWith(borders);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("points the three tiled sources at the realm's tiles, and again after each style change", () => {
    const { map, method } = fakeMap();

    renderHook(() => useWorldMapLayers({ ...baseProps, map, layers: [], tileRealmId: "r_eurth" }));

    expect(applyVectorTiles.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["altitudes", "tiles/r_eurth/altitudes"],
      ["rivers", "tiles/r_eurth/rivers"],
      ["lakes", "tiles/r_eurth/lakes"],
    ]);
    expect(method("on")).toHaveBeenCalledWith("styledata", expect.any(Function));
  });

  it("waits for the realm before asking for tiles", () => {
    const { map } = fakeMap();
    renderHook(() => useWorldMapLayers({ ...baseProps, map, layers: [] }));
    expect(applyVectorTiles).not.toHaveBeenCalled();
  });

  it("re-pushes country data after a theme change, which re-applies the style's empty sources", () => {
    const { map, politicalSetData } = fakeMap();
    const layers = [{ type: "political" as const, data: borders, visible: true }];
    const { rerender } = renderHook(
      ({ theme }: { theme: "standard" | "dark" }) =>
        useWorldMapLayers({ ...baseProps, map, layers, theme }),
      { initialProps: { theme: "standard" } }
    );
    expect(politicalSetData).toHaveBeenCalledTimes(1);

    rerender({ theme: "dark" });
    expect(politicalSetData).toHaveBeenCalledTimes(2);

    rerender({ theme: "dark" });
    expect(politicalSetData).toHaveBeenCalledTimes(2);
  });

  it("keeps faded-out country names out of label collision", () => {
    const { map, method } = fakeMap();
    renderHook(() =>
      useWorldMapLayers({
        ...baseProps,
        map,
        layers: [{ type: "country_labels", data: borders, visible: true }],
      })
    );
    expect(method("addLayer")).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "country-name-labels",
        filter: [">", ["coalesce", ["get", "_distFade"], 1], 0],
      })
    );
  });

  it("still pushes rivers GeoJSON on a map that draws them from GeoJSON (the map pipeline lab)", () => {
    const { map, riversSetData } = fakeMap("geojson");
    const rivers: FeatureCollection = { ...borders };
    renderHook(() =>
      useWorldMapLayers({
        ...baseProps,
        map,
        layers: [{ type: "rivers", data: rivers, visible: true }],
      })
    );
    expect(riversSetData).toHaveBeenCalledWith(rivers);
  });
});
