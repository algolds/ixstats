import { renderHook } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

type LayerCall = { layers: string[]; realm?: string; enabled?: boolean };

let mockLayerCall: LayerCall = { layers: [] };
let mockLayers: Record<string, FeatureCollection> | undefined;
let mockBundle: Record<string, unknown> | undefined;

jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: (call: LayerCall) => {
    mockLayerCall = call;
    return { layers: mockLayers };
  },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    countryGeo: {
      getCountryGeoBundle: { useQuery: () => ({ data: mockBundle, isLoading: false }) },
    },
  },
}));

import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";

const political: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { _id: "Urcea" },
      geometry: { type: "Point", coordinates: [0, 0] },
    },
  ],
};

beforeEach(() => {
  mockLayerCall = { layers: [] };
  mockLayers = undefined;
  mockBundle = undefined;
});

describe("useCountryMapEmbed", () => {
  it("draws the neighbours from the political layer /maps downloads, once a country is named", () => {
    mockLayers = { political };
    const { result } = renderHook(() => useCountryMapEmbed("c1"));

    expect(mockLayerCall).toMatchObject({ layers: ["political"], enabled: true });
    expect(result.current.worldPolitical).toBe(political);
  });

  it("downloads no layer until a country is named", () => {
    renderHook(() => useCountryMapEmbed(null));
    expect(mockLayerCall).toMatchObject({ layers: ["political"], enabled: false });
  });

  it("draws the country's own neighbours until the layer arrives", () => {
    mockBundle = { neighbors: [{ type: "Feature", properties: {}, geometry: null }] };
    const { result } = renderHook(() => useCountryMapEmbed("c1"));
    expect(result.current.worldPolitical?.features).toHaveLength(1);
  });
});
