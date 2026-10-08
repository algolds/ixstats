/**
 * Realm raster tiles: the Web Mercator tile pyramid built from a full-globe equirectangular image (which zoom the
 * image's width calls for, which image row each tile row shows), the premultiplied row resampling, the grey copy,
 * the tile and legend paths, and the settings upsert.
 */
import {
  greyPixels,
  isRasterTileCoord,
  mercatorLatitude,
  rasterLegendPath,
  rasterMaxZoom,
  rasterTilePath,
  remapRows,
  tileSourceRows,
  withRasterLayer,
} from "~/lib/maps/raster-tiles";
import { MERCATOR_MAX_LAT, type RealmRasterLayer } from "~/lib/maps/realm-map-settings";

describe("max zoom", () => {
  it("is the first zoom whose world is at least as wide as the image", () => {
    expect(rasterMaxZoom(8000)).toBe(5); // 8192 px at z5
    expect(rasterMaxZoom(8192)).toBe(5);
    expect(rasterMaxZoom(8193)).toBe(6);
    expect(rasterMaxZoom(4000)).toBe(4);
    expect(rasterMaxZoom(2000)).toBe(3);
    expect(rasterMaxZoom(256)).toBe(0);
    expect(rasterMaxZoom(100)).toBe(0);
  });

  it("stops at the largest zoom a realm layer may have", () => {
    expect(rasterMaxZoom(1_000_000)).toBe(8);
  });
});

describe("Mercator rows", () => {
  it("spans ±85.0511° from the top edge to the bottom edge of the world", () => {
    expect(mercatorLatitude(0, 256)).toBeCloseTo(MERCATOR_MAX_LAT, 6);
    expect(mercatorLatitude(128, 256)).toBeCloseTo(0, 9);
    expect(mercatorLatitude(256, 256)).toBeCloseTo(-MERCATOR_MAX_LAT, 6);
  });

  it("puts tile edges where Web Mercator puts them", () => {
    // z1: the tile rows meet at the equator; z2: row 1 starts at 66.513°N
    expect(mercatorLatitude(256, 512)).toBeCloseTo(0, 9);
    expect(mercatorLatitude(256, 1024)).toBeCloseTo(66.51326, 4);
  });
});

describe("tile rows to image rows", () => {
  // An image of the zoom's equatorial resolution: 256·2^z wide, half as tall
  it("maps the equator to the middle of the image, 1:1 there", () => {
    const rows = tileSourceRows(1, 0, 256); // z1 top row of tiles, image 512×256
    // The last row of the northern tile row sits half a pixel above the equator: image row 127
    expect(rows[255]).toBeCloseTo(127, 3);
    const south = tileSourceRows(1, 1, 256);
    expect(south[0]! - rows[255]!).toBeCloseTo(1, 2);
  });

  it("follows the latitude of each row's centre", () => {
    const height = 4096; // z5's equirectangular height
    const rows = tileSourceRows(5, 3, height);
    for (const r of [0, 77, 255]) {
      const lat = mercatorLatitude(3 * 256 + r + 0.5, 256 * 32);
      expect(rows[r]).toBeCloseTo(((90 - lat) / 180) * height - 0.5, 9);
    }
  });

  it("stretches high latitudes: 60–80°N rows repeat image rows, never skip them", () => {
    const height = 4096;
    for (let ty = 0; ty < 32; ty++) {
      const rows = tileSourceRows(5, ty, height);
      for (let r = 1; r < 256; r++) expect(rows[r]! - rows[r - 1]!).toBeLessThanOrEqual(1.0001);
    }
    // At 70°N a Mercator row covers about a third of an image row
    const y70 =
      (256 * 32 * (1 - Math.log(Math.tan(Math.PI / 4 + (70 * Math.PI) / 360)) / Math.PI)) / 2;
    const ty = Math.floor(y70 / 256);
    const r = Math.floor(y70 - ty * 256);
    const rows = tileSourceRows(5, ty, height);
    expect(rows[r + 1]! - rows[r]!).toBeCloseTo(Math.cos((70 * Math.PI) / 180), 2);
  });

  it("stays inside the image", () => {
    const top = tileSourceRows(0, 0, 128);
    expect(Math.min(...top)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...top)).toBeLessThanOrEqual(127);
  });
});

describe("row resampling", () => {
  const image = (rows: number[][]) => ({
    width: 1,
    height: rows.length,
    data: Uint8Array.from(rows.flat()),
  });

  it("interpolates between the two nearest rows", () => {
    const src = image([
      [0, 0, 0, 255],
      [200, 100, 50, 255],
    ]);
    expect([...remapRows(src, Float64Array.from([0, 0.5, 1]))]).toEqual([
      0, 0, 0, 255, 100, 50, 25, 255, 200, 100, 50, 255,
    ]);
  });

  it("weights colour by opacity, so a transparent row's colour never bleeds in", () => {
    const src = image([
      [28, 28, 28, 0], // transparent sea of a dark colour
      [200, 0, 0, 128],
    ]);
    expect([...remapRows(src, Float64Array.from([0.5]))]).toEqual([200, 0, 0, 64]);
    expect([...remapRows(src, Float64Array.from([0]))]).toEqual([0, 0, 0, 0]);
  });

  it("keeps every column", () => {
    const src = { width: 2, height: 1, data: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]) };
    expect([...remapRows(src, Float64Array.from([0, 0]))]).toEqual([
      1, 2, 3, 255, 4, 5, 6, 255, 1, 2, 3, 255, 4, 5, 6, 255,
    ]);
  });
});

describe("grey copy", () => {
  it("is the brightest channel, alpha kept", () => {
    const px = Uint8Array.from([10, 200, 30, 255, 90, 20, 60, 7]);
    greyPixels(px);
    expect([...px]).toEqual([200, 200, 200, 255, 90, 90, 90, 7]);
  });
});

describe("tile paths", () => {
  it("validates tile coordinates against the layer's pyramid", () => {
    expect(isRasterTileCoord(0, 0, 0)).toBe(true);
    expect(isRasterTileCoord(5, 31, 31)).toBe(true);
    expect(isRasterTileCoord(5, 32, 0)).toBe(false);
    expect(isRasterTileCoord(9, 0, 0)).toBe(false);
    expect(isRasterTileCoord(-1, 0, 0)).toBe(false);
    expect(isRasterTileCoord(1.5, 0, 0)).toBe(false);
  });

  it("names the version in every URL", () => {
    const layer = { id: "geography", version: "abc12345" };
    expect(rasterTilePath("r1", layer)).toBe("/api/map-rasters/r1/geography/abc12345/{z}/{x}/{y}");
    expect(rasterLegendPath("r1", layer)).toBe("/api/map-rasters/r1/geography/abc12345/legend");
  });
});

describe("settings upsert", () => {
  const layer = (over: Partial<RealmRasterLayer>): RealmRasterLayer => ({
    id: "geography",
    label: "Geography",
    kind: "base",
    version: "aaaaaaaa",
    maxZoom: 5,
    ...over,
  });

  it("adds a new layer and replaces one with the same id", () => {
    const start = [layer({}), layer({ id: "climate", kind: "overlay", order: 1 })];
    const next = withRasterLayer(start, layer({ version: "bbbbbbbb" }));
    expect(next.map((l) => [l.id, l.version])).toEqual([
      ["geography", "bbbbbbbb"],
      ["climate", "aaaaaaaa"],
    ]);
    expect(withRasterLayer(start, layer({ id: "tectonic", kind: "overlay" }))).toHaveLength(3);
  });
});
