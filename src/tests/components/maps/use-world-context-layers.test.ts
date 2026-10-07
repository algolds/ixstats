import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useWorldContextLayers } from "~/components/maps/editor/hooks/useWorldContextLayers";

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
