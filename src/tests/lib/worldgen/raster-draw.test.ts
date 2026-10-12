/** Drawing on an equirectangular raster: wrapping at the antimeridian and the half-open cell fill. */

import { drawSegment, fillRing, newRaster, rampTable, toPixel } from "~/lib/worldgen/raster-draw";

const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
  data[(y * width + x) * 4 + 3]!;

describe("worldgen/raster-draw", () => {
  it("lays pixels out like the relief: column 0 is 180W, row 0 is 90N", () => {
    const raster = newRaster(360);
    expect(toPixel(-180, 90, raster)).toEqual([0, 0]);
    expect(toPixel(0, 0, raster)).toEqual([180, 90]);
    expect(toPixel(180, -90, raster)).toEqual([360, 180]);
  });

  it("draws a segment that crosses the antimeridian the short way round", () => {
    const raster = newRaster(360);
    drawSegment(raster, [358, 50], [2, 50], [255, 0, 0, 255]);
    const { data, width } = raster;
    expect([358, 359, 0, 1, 2].every((x) => alphaAt(data, width, x, 50) === 255)).toBe(true);
    // Not the long way across the world
    expect(alphaAt(data, width, 180, 50)).toBe(0);
  });

  it("fills a ring that spans the seam on both sides of it", () => {
    const raster = newRaster(360);
    fillRing(
      raster,
      [
        [-178, 10],
        [178, 10],
        [178, 20],
        [-178, 20],
        [-178, 10],
      ],
      [0, 255, 0, 255]
    );
    const { data, width } = raster;
    expect(alphaAt(data, width, 359, 75)).toBe(255);
    expect(alphaAt(data, width, 0, 75)).toBe(255);
    expect(alphaAt(data, width, 180, 75)).toBe(0);
  });

  it("paints a pixel shared by two neighbouring rings once, and leaves no gap", () => {
    const raster = newRaster(360);
    const shared = (x: number): [number, number][] => [
      [x, 0],
      [x + 10.3, 0],
      [x + 10.3, 10],
      [x, 10],
      [x, 0],
    ];
    // Half-opaque twice would be 3/4 opaque at a doubly painted pixel
    fillRing(raster, shared(-60), [255, 0, 0, 128]);
    fillRing(raster, shared(-49.7), [255, 0, 0, 128]);
    const { data, width } = raster;
    const row = 85 * width;
    for (let x = 120 + 0; x < 141; x++) expect(data[(row + x) * 4 + 3]).toBeGreaterThan(0);
    const alphas = new Set<number>();
    for (let x = 121; x < 140; x++) alphas.add(data[(row + x) * 4 + 3]!);
    expect([...alphas]).toHaveLength(1);
  });

  it("only paints where the mask is above zero", () => {
    const raster = newRaster(360);
    const mask = new Float32Array(360 * 180);
    mask[85 * 360 + 200] = 1;
    fillRing(
      raster,
      [
        [10, 0],
        [30, 0],
        [30, 10],
        [10, 10],
        [10, 0],
      ],
      [0, 0, 255, 255],
      mask
    );
    expect(alphaAt(raster.data, 360, 200, 85)).toBe(255);
    expect(alphaAt(raster.data, 360, 201, 85)).toBe(0);
  });

  it("interpolates a ramp between its stops", () => {
    const table = rampTable([
      { at: 0, color: [0, 0, 0] },
      { at: 1, color: [255, 255, 255] },
    ]);
    expect(table[0]).toBe(0);
    expect(table[255 * 3]).toBe(255);
    expect(table[128 * 3]).toBeGreaterThan(120);
    expect(table[128 * 3]).toBeLessThan(135);
  });
});
