import type { Map as MapLibreMap } from "maplibre-gl";
import {
  MAX_TILE_ZOOM,
  applyVectorTiles,
  isTileCoord,
  tileUrlTemplate,
} from "~/lib/maps/decorative-tiles";

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

const riversLayer: Layer = {
  id: "fill-rivers",
  type: "line",
  source: "source-rivers",
  paint: { "line-color": "#5295c4" },
  layout: { visibility: "visible" },
  filter: [">", ["get", "_areaSqKm"], 0],
};

describe("applyVectorTiles", () => {
  it("swaps a GeoJSON source for tiles, keeping its layer's place and style", () => {
    const map = fakeMap({ "source-rivers": { type: "geojson" } }, [
      { id: "fill-lakes", type: "fill", source: "source-lakes" },
      riversLayer,
      { id: "fill-icecaps", type: "fill", source: "source-icecaps" },
    ]);

    applyVectorTiles(map as unknown as MapLibreMap, "rivers", "https://x/t/{z}/{x}/{y}");

    expect(map.sources["source-rivers"]).toMatchObject({
      type: "vector",
      tiles: ["https://x/t/{z}/{x}/{y}"],
      maxzoom: 6,
    });
    expect(map.layers.map((l) => l.id)).toEqual(["fill-lakes", "fill-rivers", "fill-icecaps"]);
    expect(map.layers[1]).toEqual({ ...riversLayer, "source-layer": "rivers" });
  });

  it("leaves a tile source on the same URL alone", () => {
    const setTiles = jest.fn();
    const map = fakeMap({ "source-rivers": { type: "vector", tiles: ["u"], setTiles } }, []);
    applyVectorTiles(map as unknown as MapLibreMap, "rivers", "u");
    expect(setTiles).not.toHaveBeenCalled();
    expect(map.addSource).not.toHaveBeenCalled();
  });

  it("re-points a tile source when the realm's URL changes", () => {
    const setTiles = jest.fn();
    const map = fakeMap({ "source-rivers": { type: "vector", tiles: ["old"], setTiles } }, []);
    applyVectorTiles(map as unknown as MapLibreMap, "rivers", "new");
    expect(setTiles).toHaveBeenCalledWith(["new"]);
  });
});

describe("tileUrlTemplate", () => {
  it("names the realm, the map version and the layer, so a new version is a new URL", () => {
    const url = (version: number) => tileUrlTemplate({ realmId: "r_eurth", version }, "rivers");
    expect(url(7)).toBe(`${window.location.origin}/api/map-tiles/r_eurth/7/rivers/{z}/{x}/{y}`);
    expect(url(8)).not.toBe(url(7));
  });

  it("encodes the realm segment", () => {
    expect(tileUrlTemplate({ realmId: "a b", version: 0 }, "lakes")).toContain("/a%20b/0/lakes/");
  });
});

describe("isTileCoord", () => {
  it.each([
    [0, 0, 0],
    [3, 7, 7],
    [MAX_TILE_ZOOM, 63, 0],
  ])("accepts %i/%i/%i", (z, x, y) => expect(isTileCoord(z, x, y)).toBe(true));

  it.each([
    [MAX_TILE_ZOOM + 1, 0, 0],
    [-1, 0, 0],
    [2, 4, 0],
    [2, 0, -1],
    [1.5, 0, 0],
    [2, 0.5, 0],
    [Number.NaN, 0, 0],
  ])("rejects %s/%s/%s", (z, x, y) => expect(isTileCoord(z, x, y)).toBe(false));
});
