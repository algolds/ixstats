/**
 * The editor's relief preview: the server tiles' height and hillshade pipeline at 1024x512, warped to the Web
 * Mercator rows an image source is drawn in.
 */

import { makeRng } from "~/lib/worldgen/v2/helpers/rng";
import { PREVIEW_RELIEF_WIDTH, previewRelief } from "~/lib/worldgen/relief-preview";

/** Jittered lattice packed as [lng, lat, h, ...], `rows` rows pole to pole, with a cone of rock at (lng, lat). */
function coneWorld(rows: number, peak: { lng: number; lat: number; metres: number }): Float32Array {
  const rng = makeRng(3);
  const out: number[] = [];
  const radius = 14;
  for (let j = 0; j < rows; j++) {
    const lat = -90 + ((j + 0.5) * 180) / rows;
    const count = Math.max(4, Math.round(2 * rows * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < count; i++) {
      const lng = -180 + ((i + 0.5 + (rng() - 0.5) * 0.3) * 360) / count;
      const la = lat + ((rng() - 0.5) * 0.3 * 180) / rows;
      const away = Math.hypot((lng - peak.lng) * Math.cos((la * Math.PI) / 180), la - peak.lat);
      out.push(lng, la, away < radius ? peak.metres * (1 - away / radius) : 0);
    }
  }
  return Float32Array.from(out);
}

/** Alpha-weighted mean row and column of the visible pixels, and how many there are. */
function visibleCentroid(rgba: Uint8Array, width: number) {
  let sumRow = 0;
  let sumCol = 0;
  let weight = 0;
  let visible = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    const a = rgba[i]!;
    if (a === 0) continue;
    const px = (i - 3) / 4;
    sumRow += Math.floor(px / width) * a;
    sumCol += (px % width) * a;
    weight += a;
    visible++;
  }
  return { row: sumRow / weight, col: sumCol / weight, visible };
}

describe("worldgen/relief-preview", () => {
  const peakLat = 60;
  const rgba = previewRelief(coneWorld(90, { lng: 0, lat: peakLat, metres: 4500 }));

  it("is a 1024 px Web Mercator world, the size of a zoom 2 tile pyramid", () => {
    expect(PREVIEW_RELIEF_WIDTH).toBe(1024);
    expect(rgba.width).toBe(1024);
    expect(rgba.height).toBe(1024);
    expect(rgba.rgba.byteLength).toBe(1024 * 1024 * 4);
  });

  it("shades the mountain and leaves the sea transparent", () => {
    const { visible } = visibleCentroid(rgba.rgba, rgba.width);
    expect(visible).toBeGreaterThan(500);
    // A far corner of open ocean
    const corner = (400 * rgba.width + 900) * 4;
    expect(rgba.rgba[corner + 3]).toBe(0);
  });

  it("draws the mountain at its Mercator row, not its equirectangular one", () => {
    const { row, col } = visibleCentroid(rgba.rgba, rgba.width);
    const phi = (peakLat * Math.PI) / 180;
    const mercatorRow = 1024 * (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI));
    const equirectangularRow = ((90 - peakLat) / 180) * 1024;
    expect(Math.abs(row - mercatorRow)).toBeLessThan(25);
    expect(Math.abs(row - equirectangularRow)).toBeGreaterThan(100);
    expect(Math.abs(col - 512)).toBeLessThan(25);
  });
});
