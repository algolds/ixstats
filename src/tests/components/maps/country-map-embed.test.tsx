/** CountryMapEmbed camera focus: point flyTo and subdivision fitBounds convert coordinates through the flat projection. */
import { render } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { toCarrierLngLat } from "~/lib/maps/flat-projection";

const flyTo = jest.fn();
const fitBounds = jest.fn();
const once = jest.fn();

const mockMap = {
  flyTo,
  fitBounds,
  once,
};

let mockState: Record<string, unknown> = {};

jest.mock("~/components/maps/widgets/hooks/useCountryMapEmbedState", () => ({
  useCountryMapEmbedState: () => mockState,
}));

jest.mock("~/components/maps/widgets/hooks/useCountryMapEmbedLayers", () => ({
  useCountryMapEmbedLayers: () => {},
}));

import { CountryMapEmbed } from "~/components/maps/widgets/CountryMapEmbed";
import { populateEmbedMap } from "~/components/maps/widgets/embed-map-layers";

beforeEach(() => {
  flyTo.mockReset();
  fitBounds.mockReset();
  once.mockReset();
  mockState = {
    containerRef: { current: null },
    mapRef: { current: mockMap },
    mapReady: true,
    isLoading: false,
    hasGeometry: true,
    bbox: { minLng: 10, minLat: 40, maxLng: 20, maxLat: 44 },
    highlightIdsMemo: new Set<string>(),
    highlightNamesMemo: new Set<string>(),
    worldPolitical: null,
    subdivisions: [
      {
        id: "sub-1",
        name: "Inosia",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [12, 38],
              [16, 38],
              [16, 43],
              [12, 38],
            ],
          ],
        },
      },
    ],
  };
});

describe("CountryMapEmbed focus", () => {
  it("converts a point focus to carrier coordinates before flyTo", () => {
    render(<CountryMapEmbed countryId="c1" focus={{ kind: "point", lng: 12.5, lat: 41.9 }} />);
    expect(flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: toCarrierLngLat(12.5, 41.9),
        zoom: 7,
      })
    );
  });

  it("converts both corners of a subdivision's bounds to carrier coordinates before fitBounds", () => {
    render(<CountryMapEmbed countryId="c1" focus={{ kind: "subdivision", id: "sub-1" }} />);
    expect(fitBounds).toHaveBeenLastCalledWith(
      [toCarrierLngLat(12, 38), toCarrierLngLat(16, 43)],
      expect.objectContaining({ padding: 40 })
    );
  });

  it("re-baselines city reveal on idle after an insetRight refit", () => {
    let zoom = 5;
    const listeners = new Map<string, () => void>();
    const idleCallbacks: Array<() => void> = [];
    const setFilter = jest.fn();
    const fakeMap = {
      getLayer: () => true,
      getSource: () => undefined,
      setLayoutProperty: jest.fn(),
      removeLayer: jest.fn(),
      removeSource: jest.fn(),
      addSource: jest.fn(),
      addLayer: jest.fn(),
      hasImage: () => true,
      getZoom: () => zoom,
      getCanvas: () => ({ style: {} }),
      setFilter,
      fitBounds,
      on: (event: string, cb: () => void) => {
        if (event === "zoom") listeners.set(event, cb);
      },
      once: (event: string, cb: () => void) => {
        if (event === "idle") idleCallbacks.push(cb);
      },
      flyTo,
    };
    mockState = {
      ...mockState,
      mapRef: { current: fakeMap },
      geometry: { type: "Polygon", coordinates: [] },
      cities: [{ id: "k1", name: "Kora", coordinates: [12, 41], isNationalCapital: true }],
      capital: null,
    };
    // The user's own opening fit settles at zoom 5, then the user zooms in to 8: all tiers show.
    populateEmbedMap(fakeMap as unknown as MapLibreMap, {
      state: mockState as never,
      countryId: "c1",
      showNeighbors: false,
      showCities: true,
      showSubdivisions: false,
      boundsPadding: 40,
    });
    idleCallbacks.splice(0).forEach((cb) => cb());
    zoom = 8;
    listeners.get("zoom")?.();
    expect(JSON.stringify(setFilter.mock.lastCall)).toContain(
      '">=",["coalesce",["get","population"],0],0'
    );

    const { rerender } = render(<CountryMapEmbed countryId="c1" insetRight={0} />);
    idleCallbacks.length = 0;
    // The inset refit lands at zoom 7; the idle after it must make 7 the new baseline.
    zoom = 7;
    rerender(<CountryMapEmbed countryId="c1" insetRight={240} />);
    expect(fitBounds).toHaveBeenLastCalledWith(
      [toCarrierLngLat(10, 40), toCarrierLngLat(20, 44)],
      expect.objectContaining({
        padding: { top: 40, bottom: 40, left: 40, right: 280 },
      })
    );
    expect(idleCallbacks).toHaveLength(1);
    idleCallbacks[0]?.();
    expect(JSON.stringify(setFilter.mock.lastCall)).toContain("1000000000000000");
  });
});
