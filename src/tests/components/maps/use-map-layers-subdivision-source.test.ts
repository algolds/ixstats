import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { useMapLayers } from "~/components/maps/editor/hooks/useMapLayers";

jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => undefined }));

interface AddedSource {
  type: string;
  promoteId?: string;
}

/** A map that remembers the sources added to it; every other call is a no-op. */
function fakeMap() {
  const sources = new Map<string, AddedSource>();
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "addSource")
          return (id: string, spec: AddedSource) => void sources.set(id, spec);
        if (name === "getSource") return (id: string) => sources.get(id);
        if (name === "getLayer") return () => undefined;
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  return { map, sources };
}

const region: EditorFeature = {
  id: "region-a",
  type: "subdivision",
  name: "Region A",
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
  properties: {},
};

describe("useMapLayers subdivisions source", () => {
  it("uses each region's id as its feature id, so updateData can move a single region", () => {
    const { map, sources } = fakeMap();
    renderHook(() =>
      useMapLayers({
        map,
        isLoaded: true,
        countryGeometry: null,
        countryBbox: null,
        features: [region],
        pendingCoordinates: null,
        gridZoomBucket: 0,
      })
    );
    expect(sources.get("editor-subdivisions")).toMatchObject({ type: "geojson", promoteId: "id" });
  });
});
