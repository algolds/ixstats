/**
 * Relief module: heights from generator cells and from altitude bands, tileable detail, and the hillshade.
 */

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { makeRng } from "~/lib/worldgen/v2/helpers/rng";
import { kmPerDegreeLat, kmPerDegreeLng } from "~/lib/maps/planet";
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
  it("returns a 2:1 grid at the requested width and fills land with the cell height", () => {
    const cells = latticeCells(40, () => 500);
    const g = heightsFromCells(cells, 512);
    expect(g.width).toBe(512);
    expect(g.height).toBe(256);
    expect(g.metres).toHaveLength(512 * 256);
    expect(g.metres[128 * 512 + 256]).toBeCloseTo(500, 1);
    expect(g.metres[60 * 512 + 100]).toBeCloseTo(500, 1);
  });

  it("clamps sea (negative) heights to 0", () => {
    const cells = latticeCells(40, (lng) => (lng < 0 ? -3000 : 800));
    const g = heightsFromCells(cells, 512);
    let min = Infinity;
    for (const v of g.metres) min = Math.min(min, v);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(g.metres[128 * 512 + 100]).toBe(0);
    expect(g.metres[128 * 512 + 400]).toBeGreaterThan(700);
  });

  it("reaches a single high cell's height at the cell and slopes down around it", () => {
    const cells = latticeCells(40, () => 100);
    // Raise one cell near the middle of the map.
    let peak = 0;
    let best = Infinity;
    for (let i = 0; i < cells.length; i += 3) {
      const d = Math.hypot(cells[i]!, cells[i + 1]!);
      if (d < best) {
        best = d;
        peak = i;
      }
    }
    cells[peak + 2] = 4000;
    const g = heightsFromCells(cells, 512);
    const px = Math.round(((cells[peak]! + 180) / 360) * 512 - 0.5);
    const py = Math.round(((90 - cells[peak + 1]!) / 180) * 256 - 0.5);
    expect(g.metres[py * 512 + px]).toBeGreaterThan(3000);
    expect(g.metres[py * 512 + px + 12]).toBeLessThan(g.metres[py * 512 + px]!);
  });

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

  it("rises monotonically from the coast to the centre of nested bands", () => {
    const width = 256;
    const height = 128;
    const g = heightsFromBands(discs(width, height, 128), width, height, zones);
    const row = (height / 2) * width;
    let prev = -1;
    for (let x = 128 - 62; x <= 128; x++) {
      const v = g.metres[row + x]!;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(g.metres[row + 128]).toBeGreaterThan(900);
    expect(g.metres[row + 128 - 59]).toBeLessThan(40);
  });

  it("interpolates inside one band instead of stepping", () => {
    const width = 256;
    const height = 128;
    const g = heightsFromBands(discs(width, height, 128), width, height, zones);
    const row = (height / 2) * width;
    // Zone 2 (value 2) spans radii 42..60: expect several distinct heights across it.
    const seen = new Set<number>();
    for (let x = 128 - 59; x <= 128 - 43; x++) seen.add(Math.round(g.metres[row + x]!));
    expect(seen.size).toBeGreaterThan(5);
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

  it("lets a band with nothing above it climb towards its ceiling", () => {
    const width = 128;
    const height = 64;
    const zg = new Uint8Array(width * height);
    for (let y = 16; y < 48; y++) for (let x = 32; x < 96; x++) zg[y * width + x] = 1;
    const g = heightsFromBands(zg, width, height, [{ min: 0, max: 99 }]);
    const centre = g.metres[32 * width + 64]!;
    const edge = g.metres[32 * width + 32]!;
    expect(centre).toBeGreaterThan(85);
    expect(edge).toBeLessThan(20);
  });

  it("treats values above the zone count as the top zone", () => {
    const zg = new Uint8Array(64 * 32).fill(7);
    zg.fill(0, 0, 64 * 4);
    const g = heightsFromBands(zg, 64, 32, [
      { min: 0, max: 50 },
      { min: 50, max: 90 },
    ]);
    for (const v of g.metres) expect(v).toBeLessThanOrEqual(90);
  });
});

describe("relief/addDetail", () => {
  it("does nothing at zero ruggedness and never touches sea", () => {
    const g = grid(512, (x, y) => (y > 100 ? 0 : 400 + x * 0.1));
    const before = Float32Array.from(g.metres);
    addDetail(g, 0);
    expect(sameValues(g.metres, before)).toBe(true);
    addDetail(g, 1);
    let seaChanged = 0;
    for (let i = 0; i < before.length; i++) if (before[i] === 0 && g.metres[i] !== 0) seaChanged++;
    expect(seaChanged).toBe(0);
    expect(sameValues(g.metres, before)).toBe(false);
  });

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

  it("scales the detail with altitude and ruggedness", () => {
    const spread = (altitude: number, ruggedness: number): number => {
      const g = grid(512, () => altitude);
      addDetail(g, ruggedness);
      let sum = 0;
      for (const v of g.metres) sum += (v - altitude) ** 2;
      return Math.sqrt(sum / g.metres.length);
    };
    expect(spread(3000, 1)).toBeGreaterThan(spread(100, 1) * 3);
    expect(spread(1500, 1)).toBeGreaterThan(spread(1500, 0.3) * 2);
  });

  it("tiles seamlessly: the pattern repeats every eighth of the width", () => {
    const g = grid(2048, () => 1200);
    addDetail(g, 0.8);
    const row = 400 * 2048;
    for (let x = 0; x < 2048 - 256; x += 37) {
      expect(g.metres[row + x + 256]).toBeCloseTo(g.metres[row + x]!, 3);
    }
  });

  it("looks the same at half the width (detail is placed in world space)", () => {
    const big = grid(2048, () => 1200);
    const small = grid(1024, () => 1200);
    addDetail(big, 0.8);
    addDetail(small, 0.8);
    for (let x = 0; x < 1024; x += 53) {
      expect(small.metres[100 * 1024 + x]).toBeCloseTo(big.metres[200 * 2048 + x * 2]!, 3);
    }
  });
});

describe("relief/hillshade", () => {
  const alphaOf = (rgba: Uint8ClampedArray, i: number) => rgba[i * 4 + 3]!;
  const mppEq = metresPerPixelX(H / 2, W, H);
  const cx = 1024;
  const cy = 512;

  /** A cone with a 4 % physical slope and a 12 pixel radius, wrapping horizontally. */
  const cone = (centre: number): HeightGrid =>
    grid(W, (x, y) => {
      const dx = Math.min(Math.abs(x - centre), W - Math.abs(x - centre));
      return Math.max(0, (12 - Math.hypot(dx, y - cy)) * 0.04 * mppEq);
    });

  it("returns RGBA the size of the grid", () => {
    expect(hillshade(grid(W, () => 0))).toHaveLength(W * H * 4);
  });

  it("leaves flat land and sea fully transparent", () => {
    const opaque = (rgba: Uint8ClampedArray) => {
      let n = 0;
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0) n++;
      return n;
    };
    expect(opaque(hillshade(grid(W, () => 700)))).toBe(0);
    expect(opaque(hillshade(grid(W, () => 0)))).toBe(0);
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

  it("puts shadow on the east face of a north-south ridge and light on its west face", () => {
    const ridge = grid(W, (x) => Math.max(0, 8000 - Math.abs(x - cx) * 0.04 * mppEq * 1.0));
    const rgba = hillshade(ridge);
    const row = cy * W;
    expect(alphaOf(rgba, row + cx + 4)).toBeGreaterThan(20);
    expect(rgba[(row + cx + 4) * 4]).toBe(0);
    expect(alphaOf(rgba, row + cx - 4)).toBeGreaterThan(5);
    expect(rgba[(row + cx - 4) * 4]).toBe(255);
  });

  it("caps the shadow near 0.55 and the light near 0.2 on the steepest faces", () => {
    const alphas = (rgba: Uint8ClampedArray, white: boolean) => {
      let max = 0;
      for (let i = 0; i < W * H; i++) {
        if (rgba[i * 4] === (white ? 255 : 0) && alphaOf(rgba, i) > max) max = alphaOf(rgba, i);
      }
      return max;
    };
    // A cliff facing away from the light is as dark as it gets; a steep face looking straight at it, as bright.
    const away = hillshade(
      grid(W, (x, y) => 1 + 8000 * Math.max(0, Math.min(1, (cx + cy - x - y) / 4)))
    );
    const towards = hillshade(
      grid(W, (x, y) => 1 + 8000 * Math.max(0, Math.min(1, (x + y - cx - cy) / 4)))
    );
    expect(alphas(away, false)).toBeLessThanOrEqual(Math.round(0.56 * 255));
    expect(alphas(away, false)).toBeGreaterThan(Math.round(0.5 * 255));
    expect(alphas(towards, true)).toBeLessThanOrEqual(Math.round(0.21 * 255));
    expect(alphas(towards, true)).toBeGreaterThan(Math.round(0.18 * 255));
  });

  it("shades the same physical slope equally at 0 and 60 degrees latitude", () => {
    // A 4 % physical slope: each pixel's rise follows its row's width in metres.
    const rowAt = (lat: number) => Math.round(((90 - lat) / 180) * H - 0.5);
    const ramp = grid(W, () => 0);
    for (let y = 0; y < H; y++) {
      const step = -0.04 * metresPerPixelX(y, W, H);
      for (let x = 0; x < W; x++)
        ramp.metres[y * W + x] = 8000 + step * Math.max(-10, Math.min(10, x - cx));
    }
    const rgba = hillshade(ramp);
    const eq = alphaOf(rgba, rowAt(0) * W + cx);
    const hi = alphaOf(rgba, rowAt(60) * W + cx);
    expect(eq).toBeGreaterThan(10);
    expect(Math.abs(eq - hi)).toBeLessThanOrEqual(2);

    // One fixed rise per pixel is a steeper physical slope the further from the equator.
    const fixed = grid(W, (x) => 8000 - 0.04 * mppEq * Math.max(-10, Math.min(10, x - cx)));
    const naive = hillshade(fixed);
    expect(
      Math.abs(alphaOf(naive, rowAt(0) * W + cx) - alphaOf(naive, rowAt(60) * W + cx))
    ).toBeGreaterThan(4);
  });

  it("scales the north-south slope by the metres per degree of latitude", () => {
    const rise = (kmPerDegreeLat() * 1000 * 180) / H; // metres per pixel row
    // Heights fall to the south by a 5 % physical slope: the face looks away from the light.
    const south = grid(W, (_x, y) => 8000 - 0.05 * rise * Math.max(-8, Math.min(8, y - cy)));
    const rgba = hillshade(south);
    expect(alphaOf(rgba, cy * W + cx)).toBeGreaterThan(20);
    expect(rgba[(cy * W + cx) * 4]).toBe(0);
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

describe("relief/performance", () => {
  const rows = 228; // about 66,600 cells, the size of a default world
  const cells = latticeCells(
    rows,
    (lng, lat) => 1500 * Math.sin((lng * Math.PI) / 40) * Math.cos((lat * Math.PI) / 30) - 200,
    7
  );

  it("rasterises 66k cells into a 2048x1024 grid within budget", () => {
    const t0 = performance.now();
    const g = heightsFromCells(cells, 2048);
    const ms = performance.now() - t0;
    expect(cells.length / 3).toBeGreaterThan(60000);
    expect(g.metres.some((v) => v > 500)).toBe(true);
    expect(ms).toBeLessThan(600 * TIMING_BUDGET_SCALE);
  });

  it("hillshades 2048x1024 within budget", () => {
    const g = heightsFromCells(cells, 2048);
    addDetail(g, 0.7);
    const t0 = performance.now();
    const rgba = hillshade(g);
    const ms = performance.now() - t0;
    expect(rgba).toHaveLength(2048 * 1024 * 4);
    expect(ms).toBeLessThan(700 * TIMING_BUDGET_SCALE);
  });

  it("derives band heights at 2048x1024 within budget", () => {
    const width = 2048;
    const height = 1024;
    const zones = Array.from({ length: 9 }, (_, k) => ({ min: k * 500, max: k * 500 + 499 }));
    const zg = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = Math.hypot((x - 1024) / 2, y - 512);
        zg[y * width + x] = r > 400 ? 0 : Math.min(9, 1 + Math.floor((400 - r) / 44));
      }
    }
    const t0 = performance.now();
    const g = heightsFromBands(zg, width, height, zones);
    const ms = performance.now() - t0;
    expect(g.metres[512 * width + 1024]).toBeGreaterThan(3500);
    expect(ms).toBeLessThan(1500 * TIMING_BUDGET_SCALE);
  });
});
