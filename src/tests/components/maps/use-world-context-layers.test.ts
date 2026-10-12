import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useWorldContextLayers } from "~/components/maps/editor/hooks/useWorldContextLayers";

jest.mock("~/components/maps/editor/utils/map-helpers", () => ({
  ...jest.requireActual<typeof import("~/components/maps/editor/utils/map-helpers")>(
    "~/components/maps/editor/utils/map-helpers"
  ),
  prebuildSnapGrids: jest.fn(),
}));

import { prebuildSnapGrids } from "~/components/maps/editor/utils/map-helpers";

const prebuild = jest.mocked(prebuildSnapGrids);

const rivers: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    },
  ],
};

/** A map whose every method is a no-op mock, except its rivers source. */
function fakeMap(riversType: "vector" | "geojson") {
  const setData = jest.fn();
  const source = riversType === "vector" ? { type: "vector" } : { type: "geojson", setData };
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "getSource")
          return (id: string) => (id === "source-rivers" ? source : undefined);
        if (name === "getLayer") return () => undefined;
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  return { map, setData };
}

describe("useWorldContextLayers", () => {
  it("never pushes GeoJSON into a source the editor draws from vector tiles", () => {
    const { map, setData } = fakeMap("vector");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() =>
      useWorldContextLayers(
        map,
        true,
        [{ type: "rivers", data: rivers, visible: true }],
        "standard"
      )
    );
    expect(setData).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("still pushes rivers into a GeoJSON source", () => {
    const { map, setData } = fakeMap("geojson");
    renderHook(() =>
      useWorldContextLayers(
        map,
        true,
        [{ type: "rivers", data: rivers, visible: true }],
        "standard"
      )
    );
    expect(setData).toHaveBeenCalledWith(rivers);
  });
});

describe("useWorldContextLayers snap grids", () => {
  beforeEach(() => prebuild.mockReset());

  it("starts indexing the layers for snapping when they arrive, and stops when they change", () => {
    const cancel = jest.fn();
    prebuild.mockReturnValue(cancel);
    const first = [{ type: "rivers" as const, data: rivers, visible: true }];
    const second = [{ type: "rivers" as const, data: { ...rivers }, visible: true }];
    const { map } = fakeMap("vector");
    const { rerender, unmount } = renderHook(
      ({ layers }) => useWorldContextLayers(map, true, layers, "standard"),
      { initialProps: { layers: first } }
    );
    expect(prebuild).toHaveBeenCalledTimes(1);
    expect(prebuild).toHaveBeenLastCalledWith(first);
    expect(cancel).not.toHaveBeenCalled();

    rerender({ layers: second });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(prebuild).toHaveBeenLastCalledWith(second);

    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("does not wait for the map", () => {
    prebuild.mockReturnValue(jest.fn());
    const layers = [{ type: "rivers" as const, data: rivers, visible: true }];
    renderHook(() => useWorldContextLayers(null, false, layers, "standard"));
    expect(prebuild).toHaveBeenCalledWith(layers);
  });
});
