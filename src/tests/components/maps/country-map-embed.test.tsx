/** CountryMapEmbed camera focus: point flyTo and subdivision fitBounds convert coordinates through the flat projection. */
import { render } from "@testing-library/react";
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
});
