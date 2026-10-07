/**
 * IxWorld's prime meridian (lng 56.1842) is its own: the meridian line, the home view and the R (reset view)
 * shortcut use it only on IxWorld's map; any other realm's map centres on the origin with no meridian line.
 */
import { fireEvent, render, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapKeyboardControls } from "~/components/maps/core/MapKeyboardControls";
import { useWorldMapLayers } from "~/components/maps/core/hooks/useWorldMapLayers";
import { IXWORLD_PRIME_MERIDIAN_LNG, MAP_DEFAULTS, mapHomeCenter } from "~/lib/maps/map-config";

describe("mapHomeCenter", () => {
  it("is IxWorld's prime meridian on IxWorld and the origin elsewhere", () => {
    expect(mapHomeCenter(true)).toEqual([IXWORLD_PRIME_MERIDIAN_LNG, 0]);
    expect(mapHomeCenter(false)).toEqual([0, 0]);
    expect(MAP_DEFAULTS.center).toEqual([0, 0]);
  });
});

describe("R (reset view)", () => {
  function flyToAfterReset(homeCenter?: [number, number]) {
    const flyTo = jest.fn();
    const mapRef = { current: { getMap: () => ({ flyTo }) as unknown as MapLibreMap } };
    render(<MapKeyboardControls mapRef={mapRef as never} homeCenter={homeCenter} />);
    fireEvent.keyDown(window, { key: "r" });
    return flyTo.mock.calls[0]?.[0];
  }

  it("flies to the realm's home centre", () => {
    expect(flyToAfterReset(mapHomeCenter(true))).toMatchObject({ center: [56.1842, 0] });
  });

  it("flies to the origin when no home centre is given", () => {
    expect(flyToAfterReset()).toMatchObject({ center: [0, 0] });
  });
});

describe("graticule", () => {
  /** A map that records the graticule source it is given; every other call is a no-op. */
  function fakeMap() {
    const sources = new Map<
      string,
      { data: { features: Array<{ properties: { label: string } }> } }
    >();
    const map = new Proxy({} as Record<string, unknown>, {
      get: (_target, name) => {
        if (name === "addSource") return (id: string, spec: never) => sources.set(id, spec);
        if (name === "getSource") return () => undefined;
        if (name === "getLayer") return () => undefined;
        if (name === "getStyle") return () => ({ layers: [] });
        return jest.fn();
      },
    });
    return { map: map as unknown as MapLibreMap, sources };
  }

  function graticuleNames(showPrimeMeridian: boolean) {
    const { map, sources } = fakeMap();
    renderHook(() =>
      useWorldMapLayers({
        map,
        isLoaded: true,
        layers: [],
        projectionMode: "mercator",
        updateDistanceFade: jest.fn(),
        labelFeaturesRef: { current: null },
        fullLayerDataRef: { current: new Map() },
        showPrimeMeridian,
      })
    );
    return sources.get("graticule")!.data.features.map((f) => f.properties.label);
  }

  it("draws IxWorld's prime meridian on IxWorld only", () => {
    expect(graticuleNames(true)).toEqual(["Equator", "Prime Meridian"]);
    expect(graticuleNames(false)).toEqual(["Equator"]);
  });
});
