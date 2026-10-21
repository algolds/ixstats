import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";

const applyVectorTiles = jest.fn();
jest.mock("~/lib/maps/decorative-tiles", () => ({
  ...jest.requireActual("~/lib/maps/decorative-tiles"),
  applyVectorTiles: (...args: unknown[]) => applyVectorTiles(...args),
  tileUrlTemplate: (source: { realmId: string; version: number }, layer: string) =>
    `tiles/${source.realmId}/${source.version}/${layer}`,
}));

import { useWorldMapLayers } from "~/components/maps/core/hooks/useWorldMapLayers";

/** A map whose every method is a no-op mock, except the sources this test cares about. */
function fakeMap(riversType: "vector" | "geojson" = "vector", styleLayers: string[] = []) {
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
        if (name === "getLayer")
          return (id: string) => (styleLayers.includes(id) ? { id } : undefined);
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
  it("waits for the realm's map version before asking for tiles", () => {
    const { map } = fakeMap();
    renderHook(() => useWorldMapLayers({ ...baseProps, map, layers: [] }));
    expect(applyVectorTiles).not.toHaveBeenCalled();
  });

  it("points the sources at the new URLs when the map version changes, not on an equal source", () => {
    const { map } = fakeMap();
    const { rerender } = renderHook(
      ({ version }: { version: number }) =>
        useWorldMapLayers({
          ...baseProps,
          map,
          layers: [],
          tileSource: { realmId: "r_eurth", version },
        }),
      { initialProps: { version: 3 } }
    );
    expect(applyVectorTiles).toHaveBeenCalledTimes(3);

    rerender({ version: 3 });
    expect(applyVectorTiles).toHaveBeenCalledTimes(3);

    rerender({ version: 4 });
    expect(applyVectorTiles).toHaveBeenCalledTimes(6);
    expect(applyVectorTiles.mock.calls.slice(3).map((c) => c[2])).toEqual([
      "tiles/r_eurth/4/altitudes",
      "tiles/r_eurth/4/rivers",
      "tiles/r_eurth/4/lakes",
    ]);
  });
});
