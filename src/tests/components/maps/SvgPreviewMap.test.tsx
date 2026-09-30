import { act, render } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";
import type { FeatureCollection } from "geojson";
import { SvgPreviewMap } from "~/app/admin/maps/_components/SvgPreviewMap";

const mockMapCtor = jest.fn(() => ({
  on: jest.fn(),
  remove: jest.fn(),
  fitBounds: jest.fn(),
  addSource: jest.fn(),
  addLayer: jest.fn(),
}));

jest.mock("~/lib/maps/load-maplibre", () => ({
  loadMaplibre: () => Promise.resolve({ Map: mockMapCtor, LngLatBounds: jest.fn() }),
}));
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true });
jest.mock("~/lib/maps/map-config", () => ({
  buildBaseStyle: () => ({ version: 8, sources: {}, layers: [] }),
}));

const fc: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

async function flushAsync() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("SvgPreviewMap", () => {
  beforeEach(() => {
    mockMapCtor.mockClear();
  });

  it("does not create a map when unmounted before maplibre loads", async () => {
    const { unmount } = render(<SvgPreviewMap geojson={fc} layerType="political" />);
    unmount();
    await flushAsync();

    expect(mockMapCtor).not.toHaveBeenCalled();
  });

  it("creates and removes the map on normal mount/unmount", async () => {
    const { unmount } = render(<SvgPreviewMap geojson={fc} layerType="political" />);
    await flushAsync();

    expect(mockMapCtor).toHaveBeenCalledTimes(1);
    const instance = mockMapCtor.mock.results[0]!.value;

    unmount();
    expect(instance.remove).toHaveBeenCalledTimes(1);
  });
});
