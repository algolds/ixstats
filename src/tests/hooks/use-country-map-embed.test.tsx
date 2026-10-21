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

const bundleOf = (realmSlug: string | null) => ({ country: { realmSlug }, cities: [] });

describe("useCountryMapEmbed", () => {
  it("draws the neighbours from the political layer of the country's realm", () => {
    mockBundle = bundleOf("eurth");
    mockLayers = { political };
    const { result } = renderHook(() => useCountryMapEmbed("c1"));

    expect(mockLayerCall).toMatchObject({ layers: ["political"], realm: "eurth", enabled: true });
    expect(result.current.worldPolitical).toBe(political);
  });
  it("downloads no layer until the country's realm is known: not the viewer's in its place", () => {
    renderHook(() => useCountryMapEmbed("c1"));
    expect(mockLayerCall).toMatchObject({ realm: undefined, enabled: false });
  });
});
