/**
 * Realm raster tiles: the Web Mercator tile pyramid built from a full-globe equirectangular image (which zoom the
 * image's width calls for, which image row each tile row shows), the premultiplied row resampling, the grey copy,
 * the tile and legend paths, and the settings upsert.
 */
import {
  isRasterTileCoord,
  mercatorLatitude,
  rasterLegendPath,
  rasterTilePath,
  remapRows,
  sameRasterLayer,
  tileSourceRows
} from "~/lib/maps/raster-tiles";
import { type RealmRasterLayer } from "~/lib/maps/realm-map-settings";
describe("Mercator rows", () => {
  it("puts tile edges where Web Mercator puts them", () => {
    // z1: the tile rows meet at the equator; z2: row 1 starts at 66.513°N
    expect(mercatorLatitude(256, 512)).toBeCloseTo(0, 9);
    expect(mercatorLatitude(256, 1024)).toBeCloseTo(66.51326, 4);
  });
});

describe("tile rows to image rows", () => {
  // An image of the zoom's equatorial resolution: 256·2^z wide, half as tall
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
});

describe("row resampling", () => {
  const image = (rows: number[][]) => ({
    width: 1,
    height: rows.length,
    data: Uint8Array.from(rows.flat()),
  });
  it("weights colour by opacity, so a transparent row's colour never bleeds in", () => {
    const src = image([
      [28, 28, 28, 0], // transparent sea of a dark colour
      [200, 0, 0, 128],
    ]);
    expect([...remapRows(src, Float64Array.from([0.5]))]).toEqual([200, 0, 0, 64]);
    expect([...remapRows(src, Float64Array.from([0]))]).toEqual([0, 0, 0, 0]);
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
  it("tells a layer as recorded from one built anew", () => {
    const built = layer({ kind: "overlay", order: 10 });
    expect(sameRasterLayer(undefined, built)).toBe(false);
    expect(sameRasterLayer({ ...built }, built)).toBe(true);
    for (const change of [
      { label: "Relief" },
      { kind: "base" as const },
      { version: "bbbbbbbb" },
      { maxZoom: 4 },
      { order: 2 },
      { legend: true },
    ]) {
      expect(sameRasterLayer({ ...built, ...change }, built)).toBe(false);
    }
  });
});
