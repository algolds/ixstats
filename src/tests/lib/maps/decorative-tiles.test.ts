import type { Map as MapLibreMap } from "maplibre-gl";
import { applyVectorTiles, tileUrlTemplate } from "~/lib/maps/decorative-tiles";

type Source = { type: string; tiles?: string[]; setTiles?: jest.Mock };
type Layer = { id: string; type: string; source?: string; [key: string]: unknown };

/** The slice of a MapLibre map applyVectorTiles uses, backed by plain arrays. */
function fakeMap(sources: Record<string, Source>, layers: Layer[]) {
  const map = {
    sources,
    layers,
    getSource: (id: string) => sources[id],
    getStyle: () => ({ layers: layers.map((l) => ({ ...l })) }),
    removeLayer: jest.fn((id: string) =>
      layers.splice(
        layers.findIndex((l) => l.id === id),
        1
      )
    ),
    removeSource: jest.fn((id: string) => delete sources[id]),
    addSource: jest.fn((id: string, spec: Source) => {
      sources[id] = { ...spec, setTiles: jest.fn() };
    }),
    addLayer: jest.fn((spec: Layer, beforeId?: string) => {
      const at = beforeId ? layers.findIndex((l) => l.id === beforeId) : layers.length;
      layers.splice(at, 0, spec);
    }),
  };
  return map;
}

describe("applyVectorTiles", () => {
  it("re-points a tile source when the realm's URL changes", () => {
    const setTiles = jest.fn();
    const map = fakeMap({ "source-rivers": { type: "vector", tiles: ["old"], setTiles } }, []);
    applyVectorTiles(map as unknown as MapLibreMap, "rivers", "new");
    expect(setTiles).toHaveBeenCalledWith(["new"]);
  });
});

describe("tileUrlTemplate", () => {
  it("names the realm, the map version, the tile format and the layer, so a new version is a new URL", () => {
    const url = (version: number) => tileUrlTemplate({ realmId: "r_eurth", version }, "rivers");
    expect(url(7)).toBe(`${window.location.origin}/api/map-tiles/r_eurth/7/f1/rivers/{z}/{x}/{y}`);
    expect(url(8)).not.toBe(url(7));
  });

  it("is a different URL for a different tile format", () => {
    jest.resetModules();
    jest.doMock("~/lib/maps/tile-format", () => ({ TILE_FORMAT_VERSION: 2 }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const next =
        require("~/lib/maps/decorative-tiles") as typeof import("~/lib/maps/decorative-tiles");
      expect(next.tileUrlTemplate({ realmId: "r_eurth", version: 7 }, "rivers")).toBe(
        `${window.location.origin}/api/map-tiles/r_eurth/7/f2/rivers/{z}/{x}/{y}`
      );
    } finally {
      jest.dontMock("~/lib/maps/tile-format");
    }
  });

  it("encodes the realm segment", () => {
    expect(tileUrlTemplate({ realmId: "a b", version: 0 }, "lakes")).toContain(
      "/a%20b/0/f1/lakes/"
    );
  });
});
