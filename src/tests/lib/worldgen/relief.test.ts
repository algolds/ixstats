/**
 * Relief module: heights from generator cells and from altitude bands, tileable detail, and the hillshade.
 */
import { makeRng } from "~/lib/worldgen/v2/helpers/rng";
import { kmPerDegreeLng } from "~/lib/maps/planet";
import {
  addDetail,
  heightsFromBands,
  heightsFromCells,
  hillshade,
  type HeightGrid,
} from "~/lib/worldgen/relief";

/** Shading tests run at the production size so slopes in metres per pixel are realistic. */
const W = 2048;
const H = 1024;

/** Equal-area-ish jittered lattice packed as [lng, lat, h, ...]; `rows` rows pole to pole. */
function latticeCells(
  rows: number,
  heightAt: (lng: number, lat: number) => number,
  seed = 1
): Float32Array {
  const rng = makeRng(seed);
  const out: number[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = -90 + ((j + 0.5) * 180) / rows;
    const count = Math.max(4, Math.round(2 * rows * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < count; i++) {
      const lng = -180 + ((i + 0.5 + (rng() - 0.5) * 0.3) * 360) / count;
      const la = lat + ((rng() - 0.5) * 0.3 * 180) / rows;
      out.push(lng, la, heightAt(lng, la));
    }
  }
  return Float32Array.from(out);
}

const grid = (width: number, fill: (x: number, y: number) => number): HeightGrid => {
  const height = width >> 1;
  const metres = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) metres[y * width + x] = fill(x, y);
  return { width, height, metres };
};

/** Element-wise equality without jest walking a hundred thousand elements. */
const sameValues = (a: Float32Array, b: Float32Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const metresPerPixelX = (y: number, width: number, height: number): number => {
  const lat = 90 - ((y + 0.5) * 180) / height;
  return (kmPerDegreeLng(lat) * 1000 * 360) / width;
};

describe("relief/heightsFromCells", () => {
  it("leaves no gap column at x = 0 or x = width - 1 when cells straddle the antimeridian", () => {
    const wrapped = (lng: number) => Math.abs(lng) > 150;
    const cells = latticeCells(36, (lng, lat) => (wrapped(lng) && Math.abs(lat) < 40 ? 1000 : 0));
    const width = 1024;
    const height = 512;
    const g = heightsFromCells(cells, width);
    for (let y = 0; y < height; y++) {
      const lat = 90 - ((y + 0.5) * 180) / height;
      if (Math.abs(lat) > 25) continue;
      expect(g.metres[y * width]).toBeGreaterThan(900);
      expect(g.metres[y * width + width - 1]).toBeGreaterThan(900);
    }
  });

  it("does not streak a seam-crossing triangle across the middle of the map", () => {
    const cells = latticeCells(36, (lng, lat) =>
      Math.abs(lng) > 150 && Math.abs(lat) < 40 ? 1000 : 0
    );
    const width = 1024;
    const height = 512;
    const g = heightsFromCells(cells, width);
    // Open sea between -100 and 100 degrees of longitude must stay at 0 on every row.
    const x0 = Math.round((80 / 360) * width);
    const x1 = Math.round((280 / 360) * width);
    let max = 0;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x < x1; x++) max = Math.max(max, g.metres[y * width + x]!);
    }
    expect(max).toBe(0);
  });

  it("ignores non-finite cells and returns an empty grid for too few cells", () => {
    const few = heightsFromCells(Float32Array.from([10, 10, 100, 20, 20, 100]), 256);
    expect(few.metres.every((v) => v === 0)).toBe(true);
    const cells = latticeCells(30, () => 300);
    cells[0] = Number.NaN;
    cells[5] = Number.NaN;
    const g = heightsFromCells(cells, 256);
    expect(g.metres[64 * 256 + 128]).toBeCloseTo(300, 1);
  });

  it("carries the site nearest a pole to that pole's edge, only when a site is within a degree of it", () => {
    // Land from 60S to 60N: nothing is drawn beyond, so the sea at the poles stays flat
    const short: number[] = [];
    for (let lat = -60; lat <= 60; lat += 10) {
      for (let lng = -175; lng <= 175; lng += 10) short.push(lng, lat, 400);
    }
    const g = heightsFromCells(Float32Array.from(short), 256);
    expect(g.metres[0 * 256 + 128]).toBe(0);
    expect(g.metres[127 * 256 + 128]).toBe(0);
    // A mesh reaches the poles: its polar sites' heights reach the top and bottom rows
    const polar = [...short, -120, 89.8, 700, 0, 89.8, 700, 120, 89.8, 700];
    polar.push(-120, -89.8, 900, 0, -89.8, 900, 120, -89.8, 900);
    const reached = heightsFromCells(Float32Array.from(polar), 256);
    expect(reached.metres[0 * 256 + 128]).toBeGreaterThan(650);
    expect(reached.metres[127 * 256 + 128]).toBeGreaterThan(850);
  });
});

describe("relief/heightsFromBands", () => {
  const zones = [
    { min: 0, max: 99 },
    { min: 100, max: 349 },
    { min: 350, max: 499 },
    { min: 500, max: 999 },
  ];

  /** Concentric discs around (cx, cy), wrapping horizontally; value 1 outermost to 4 innermost, 0 sea. */
  const discs = (width: number, height: number, cx: number): Uint8Array => {
    const out = new Uint8Array(width * height);
    const radii = [60, 42, 26, 12];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = Math.min(Math.abs(x - cx), width - Math.abs(x - cx));
        const r = Math.hypot(dx, y - height / 2);
        for (let k = 0; k < radii.length; k++) if (r <= radii[k]!) out[y * width + x] = k + 1;
      }
    }
    return out;
  };

  it("keeps each band's heights inside its floor and ceiling, sea at 0", () => {
    const width = 256;
    const height = 128;
    const zg = discs(width, height, 128);
    const g = heightsFromBands(zg, width, height, zones);
    let outside = 0;
    for (let i = 0; i < zg.length; i++) {
      const v = zg[i]!;
      const lo = v === 0 ? 0 : zones[v - 1]!.min;
      const hi = v === 0 ? 0 : zones[v - 1]!.max;
      if (g.metres[i]! < lo || g.metres[i]! > hi) outside++;
    }
    expect(outside).toBe(0);
  });
  it("wraps distances across the antimeridian", () => {
    const width = 256;
    const height = 64;
    const zg = new Uint8Array(width * height).fill(1);
    zg.fill(0, 0, width * 8);
    zg.fill(0, width * 56);
    // A higher block only on the left of the seam: pixels just right of the seam are as close to it as the
    // pixels just left of it, through the wrap.
    for (let y = 28; y < 36; y++) for (let x = 250; x < 256; x++) zg[y * width + x] = 2;
    const g = heightsFromBands(zg, width, height, [
      { min: 0, max: 99 },
      { min: 100, max: 199 },
    ]);
    const row = 32 * width;
    expect(Math.abs(g.metres[row + 1]! - g.metres[row + 248]!)).toBeLessThan(2);
    expect(g.metres[row + 1]!).toBeGreaterThan(g.metres[row + 30]!);
  });
});

describe("relief/addDetail", () => {
  it("adds deterministic detail that keeps land above zero", () => {
    const a = grid(512, () => 30);
    const b = grid(512, () => 30);
    addDetail(a, 1);
    addDetail(b, 1);
    expect(sameValues(a.metres, b.metres)).toBe(true);
    let changed = 0;
    let min = Infinity;
    for (const v of a.metres) {
      min = Math.min(min, v);
      if (v !== 30) changed++;
    }
    expect(min).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(a.metres.length / 2);
  });
  it("tiles seamlessly: the pattern repeats every eighth of the width", () => {
    const g = grid(2048, () => 1200);
    addDetail(g, 0.8);
    const row = 400 * 2048;
    for (let x = 0; x < 2048 - 256; x += 37) {
      expect(g.metres[row + x + 256]).toBeCloseTo(g.metres[row + x]!, 3);
    }
  });
});

describe("relief/hillshade", () => {
  const alphaOf = (rgba: Uint8ClampedArray, i: number) => rgba[i * 4 + 3]!;
  const mppEq = metresPerPixelX(H / 2, W, H);
  const cx = 1024;
  const cy = 512;

  /** A cone with a 0.4 % physical slope and a 12 pixel radius, wrapping horizontally. */
  const cone = (centre: number): HeightGrid =>
    grid(W, (x, y) => {
      const dx = Math.min(Math.abs(x - centre), W - Math.abs(x - centre));
      return Math.max(0, (12 - Math.hypot(dx, y - cy)) * 0.004 * mppEq);
    });
  it("shades the SE flank of a hill black and the NW flank white", () => {
    const rgba = hillshade(cone(cx));
    const se = (cy + 5) * W + (cx + 5);
    const nw = (cy - 5) * W + (cx - 5);
    expect(alphaOf(rgba, se)).toBeGreaterThan(20);
    expect([rgba[se * 4], rgba[se * 4 + 1], rgba[se * 4 + 2]]).toEqual([0, 0, 0]);
    expect(alphaOf(rgba, nw)).toBeGreaterThan(5);
    expect([rgba[nw * 4], rgba[nw * 4 + 1], rgba[nw * 4 + 2]]).toEqual([255, 255, 255]);
    // Sea around the hill stays transparent.
    expect(alphaOf(rgba, 5 * W + 5)).toBe(0);
  });
  it("shades the same physical slope equally at 0 and 60 degrees latitude", () => {
    // A 0.4 % physical slope: each pixel's rise follows its row's width in metres.
    const rowAt = (lat: number) => Math.round(((90 - lat) / 180) * H - 0.5);
    const ramp = grid(W, () => 0);
    for (let y = 0; y < H; y++) {
      const step = -0.004 * metresPerPixelX(y, W, H);
      for (let x = 0; x < W; x++)
        ramp.metres[y * W + x] = 8000 + step * Math.max(-10, Math.min(10, x - cx));
    }
    const rgba = hillshade(ramp);
    const eq = alphaOf(rgba, rowAt(0) * W + cx);
    const hi = alphaOf(rgba, rowAt(60) * W + cx);
    expect(eq).toBeGreaterThan(10);
    expect(Math.abs(eq - hi)).toBeLessThanOrEqual(2);

    // One fixed rise per pixel is a steeper physical slope the further from the equator.
    const fixed = grid(W, (x) => 8000 - 0.004 * mppEq * Math.max(-10, Math.min(10, x - cx)));
    const naive = hillshade(fixed);
    expect(
      Math.abs(alphaOf(naive, rowAt(0) * W + cx) - alphaOf(naive, rowAt(60) * W + cx))
    ).toBeGreaterThan(4);
  });
  it("wraps across the antimeridian: a hill on the seam shades like one in the middle", () => {
    const centred = hillshade(cone(cx));
    const seamed = hillshade(cone(0));
    let mismatches = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = (y * W + ((x + cx) % W)) * 4;
        const b = (y * W + x) * 4;
        for (let k = 0; k < 4; k++) if (centred[a + k] !== seamed[b + k]) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });
});
