/** @jest-environment node */
import sharp from "sharp";
import type { LineString, MultiLineString, Polygon } from "geojson";
import {
  altitudeStyles,
  bandLabel,
  clearSkippedBands,
  modeFilter,
  SEA_BARRIER,
  type ElevationBand,
} from "~/lib/maps/import/png/elevation";
import { runLayerEngine, type LayerEngineResult } from "~/lib/maps/import/png/layer-engine";
import {
  chainLines,
  pruneSpurs,
  removeCorners,
  simplifyLine,
  skeletonLines,
  thin,
} from "~/lib/maps/import/png/rivers";
import { engineContext } from "~/lib/maps/import/progress";
import { polygonPlanarArea } from "~/lib/maps/ring-assembly";

type Rgb = [number, number, number];

const W = 240;
const H = 120;
/** 1 px is 1.5° × 1.5° on this 240 × 120 globe. */
const DEG = 1.5;
const PX = DEG * DEG;
const ctx = () => engineContext(() => undefined, { sliceMs: Infinity });

/** Eurth's legend, lowest band first. */
const EURTH_BANDS: ElevationBand[] = [
  { color: "#a5bf8e", min: 0, max: 50 },
  { color: "#b8cda6", min: 50, max: 500 },
  { color: "#c6d6b7", min: 500, max: 2000 },
  { color: "#d7e4cd", min: 2000, max: 4000 },
  { color: "#d6ccad", min: 4000, max: 8000 },
  { color: "#ffffff", min: 8000, max: null },
];
/** The test's bands: lowlands, hills, highlands and white peaks (out of order, as a legend may list them). */
const BANDS: ElevationBand[] = [
  { color: "#ffffff", min: 2000, max: null },
  { color: "#a5bf8e", min: 0, max: 50 },
  { color: "#b8cda6", min: 50, max: 500 },
  { color: "#c6d6b7", min: 500, max: 2000 },
];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const RIVER = "#5184c8";

const inBox = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  x >= x0 && x < x1 && y >= y0 && y < y1;

/**
 * The world: a continent (x 30-210, y 20-100) with a lake (x 150-160, y 88-96), and polar ice (y 108-119, land
 * round the globe). Bands nest: hills x 60-180 y 35-85, highlands x 90-150 y 45-75, a peak x 110-130 y 55-65.
 * A white flag (x 40-46, y 25-29) sits on the lowlands. A river runs along y 92 from the coast (x 30) to x 100,
 * broken for one pixel at x 70 by a border, with a tributary down x 80 from y 80; a 5 px stroke of river colour
 * (a label) sits at x 190, y 30; the lake has a river-coloured outline.
 */
function region(x: number, y: number): "sea" | "lake" | "ice" | "land" {
  if (y >= 108) return "ice";
  if (inBox(x, y, 150, 88, 160, 96)) return "lake";
  return inBox(x, y, 30, 20, 210, 100) ? "land" : "sea";
}

function blankPixel(x: number, y: number): Rgb {
  const r = region(x, y);
  return r === "land" || r === "ice" ? [200, 200, 200] : [255, 255, 255];
}

function riverAt(x: number, y: number): boolean {
  if (y === 92 && x >= 30 && x < 100 && x !== 70) return true;
  if (x === 80 && y >= 80 && y < 92) return true;
  if (y === 30 && x >= 190 && x < 195) return true;
  const aroundLake = inBox(x, y, 149, 87, 161, 97) && !inBox(x, y, 150, 88, 160, 96);
  return aroundLake;
}

function bandColour(x: number, y: number): string {
  if (inBox(x, y, 110, 55, 130, 65)) return "#ffffff";
  if (inBox(x, y, 90, 45, 150, 75)) return "#c6d4b5";
  if (inBox(x, y, 60, 35, 180, 85)) return "#b8c9a4";
  if (inBox(x, y, 40, 25, 46, 29)) return "#ffffff";
  return "#a5bb8c";
}

function geographyPixel(x: number, y: number): Rgb {
  const r = region(x, y);
  if (r === "ice") return [255, 255, 255];
  if (r === "sea" || r === "lake") return rgb("#76d5f5");
  if (riverAt(x, y)) return rgb(RIVER);
  if (x === 70 && y >= 80) return rgb("#94000b"); // a national border
  return rgb(bandColour(x, y));
}

function encode(pixel: (x: number, y: number) => Rgb): Promise<Buffer> {
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set(pixel(x, y), (y * W + x) * 3);
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

const areaPx = (features: Array<{ geometry: Polygon | LineString | MultiLineString }>) =>
  features.reduce(
    (sum, f) =>
      sum + (f.geometry.type === "Polygon" ? polygonPlanarArea(f.geometry.coordinates) : 0),
    0
  ) / PX;
const lonOf = (x: number) => x * DEG - 180;
/** Within `share` (1%): the mode filter rounds a band's pixel corners, which shows most on a small band. */
const expectNear = (actual: number, expected: number, share = 0.01) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThan(share);
const latOf = (y: number) => 90 - y * DEG;

describe("altitudeStyles", () => {
  it("maps Eurth's six bands onto IxWorld's coast band and bands 1, 3, 5, 7 and 8 by their lowest elevation", () => {
    expect(altitudeStyles(EURTH_BANDS)).toEqual([
      { subgroup: "coastlines", fill: "#a8c995", zoneId: "zone_0", label: "0–50 m" },
      { subgroup: "Altitude-1", fill: "#c3d3a1", zoneId: "zone_1", label: "50–500 m" },
      { subgroup: "Altitude-3", fill: "#f7e6b8", zoneId: "zone_3", label: "500–2,000 m" },
      { subgroup: "Altitude-5", fill: "#bea276", zoneId: "zone_5", label: "2,000–4,000 m" },
      { subgroup: "Altitude-7", fill: "#796142", zoneId: "zone_7", label: "4,000–8,000 m" },
      { subgroup: "Altitude-8", fill: "#4f4236", zoneId: "zone_8", label: "8,000 m and above" },
    ]);
  });

  it("steps up a band when two realm bands start in one IxWorld band, and stops at the top band", () => {
    const bands = [0, 10, 20, 5000, 6000, 7000].map((min) => ({
      color: "#000000",
      min,
      max: null,
    }));
    expect(altitudeStyles(bands).map((s) => s.subgroup)).toEqual([
      "coastlines",
      "Altitude-1",
      "Altitude-2",
      "Altitude-8",
      "Altitude-8",
      "Altitude-8",
    ]);
    expect(bandLabel({ color: "#000000", min: -200, max: 0 })).toBe("-200–0 m");
  });
});

describe("PNG layer engine: elevation bands and rivers from a geography map", () => {
  let result: LayerEngineResult;
  let smoothed: LayerEngineResult;
  beforeAll(async () => {
    const geography = await encode(geographyPixel);
    const sources = {
      land: await encode(blankPixel),
      ice: geography,
      elevation: { image: geography, bands: BANDS },
      rivers: { image: geography, colours: [RIVER] },
    };
    const minRegionPixels = { land: 4, icecaps: 400, elevation: 16 };
    result = await runLayerEngine(
      sources,
      { simplify: 0, smooth: 0, elevationSmoothing: 0, minRegionPixels },
      ctx()
    );
    smoothed = await runLayerEngine(sources, { minRegionPixels }, ctx());
  });

  const band = (r: LayerEngineResult, subgroup: string) =>
    r.layers.altitudes!.filter((f) => f.properties["ixmap-subgroup"] === subgroup);

  it("stores the bands nested, as IxWorld does: each covers the land at or above its lowest elevation", () => {
    const land = 180 * 80 - 10 * 8 + W * 12;
    expectNear(areaPx(band(result, "coastlines")), land);
    expectNear(areaPx(band(result, "Altitude-1")), 120 * 50);
    expectNear(areaPx(band(result, "Altitude-3")), 60 * 30);
    expectNear(areaPx(band(result, "Altitude-5")), 20 * 10, 0.08);
    expect(band(result, "Altitude-5")[0]!.properties).toMatchObject({
      fill: "#bea276",
      zoneId: "zone_5",
      zoneName: "2,000 m and above",
      elevationMin: 2000,
      elevationMax: null,
      elevationLabel: "2,000 m and above",
    });
  });

  it("clears a white flag on the lowlands and keeps the polar ice as the coast band only", () => {
    const peaks = band(result, "Altitude-5");
    expect(peaks).toHaveLength(1);
    const lons =
      peaks[0]!.geometry.type === "Polygon"
        ? peaks[0]!.geometry.coordinates[0]!.map((p) => p[0]!)
        : [];
    expect(Math.min(...lons)).toBeCloseTo(lonOf(110));
    expect(
      band(result, "coastlines").some(
        (f) => f.geometry.type === "Polygon" && f.geometry.coordinates[0]!.some((p) => p[1] === -90)
      )
    ).toBe(true);
    expect(
      band(result, "Altitude-1").every(
        (f) =>
          f.geometry.type === "Polygon" &&
          f.geometry.coordinates[0]!.every((p) => p[1]! > latOf(100))
      )
    ).toBe(true);
  });

  it("traces the river as one system across a one-pixel break, without the lake's outline or a label stroke", () => {
    const rivers = result.layers.rivers!;
    expect(rivers).toHaveLength(1);
    expect(rivers[0]!.properties).toMatchObject({
      fill: "#6f95ff",
      "ixmap-subgroup": null,
      id: "river-1",
    });
    const geometry = rivers[0]!.geometry;
    const lines =
      geometry.type === "MultiLineString"
        ? geometry.coordinates
        : geometry.type === "LineString"
          ? [geometry.coordinates]
          : [];
    const points = lines.flat();
    for (const line of lines) {
      expect(new Set(line.map((p) => `${p[0]},${p[1]}`)).size).toBeGreaterThan(1);
    }
    const lons = points.map((p) => p[0]!);
    // From near the coast (2 px margin) to the river's source at x 100; nothing near the lake (x 149-161).
    expect(Math.min(...lons)).toBeGreaterThan(lonOf(31));
    expect(Math.min(...lons)).toBeLessThan(lonOf(36));
    expect(Math.max(...lons)).toBeGreaterThan(lonOf(97));
    expect(Math.max(...lons)).toBeLessThan(lonOf(101));
    // The tributary reaches up the x 80 line.
    expect(Math.max(...points.map((p) => p[1]!))).toBeGreaterThan(latOf(82));
  });

  it("smooths the traced edges by default: no right-angle pixel corners left on a band", () => {
    const hills = band(smoothed, "Altitude-3")[0]!;
    const ring = hills.geometry.type === "Polygon" ? hills.geometry.coordinates[0]! : [];
    expect(ring).not.toContainEqual([lonOf(90), latOf(45)]);
    expect(areaPx([hills])).toBeGreaterThan(60 * 30 * 0.95);
    expect(areaPx([hills])).toBeLessThan(60 * 30);
  });
});

describe("band raster helpers", () => {
  /** A 12 × 12 raster from rows of digits ("s" for sea, "." for unlabelled). */
  const raster = (rows: string[]) =>
    Uint16Array.from(rows.join(""), (c) => (c === "s" ? SEA_BARRIER : c === "." ? 0 : Number(c)));

  it("clears a patch that skips a band and keeps one that steps", async () => {
    const rows = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) =>
        x < 2 && y < 2 ? "3" : x >= 5 && y >= 5 ? "2" : "1"
      ).join("")
    );
    const labels = raster(rows);
    await expect(clearSkippedBands(labels, 8, 8, ctx())).resolves.toBe(4);
    expect(labels[0]).toBe(0);
    expect(labels[63]).toBe(2);
  });

  it("clears a thin line among unmatched pixels when unlabelled pixels count, and keeps the sea", async () => {
    const rows = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => (x === 0 ? "s" : y === 6 || y === 7 ? "2" : ".")).join(
        ""
      )
    );
    const labels = raster(rows);
    await modeFilter(labels, 12, 12, 2, ctx(), true);
    expect(labels[6 * 12 + 6]).toBe(0);
    expect(labels[6 * 12]).toBe(SEA_BARRIER);
    const kept = raster(rows);
    await modeFilter(kept, 12, 12, 2, ctx());
    expect(kept[6 * 12 + 6]).toBe(2);
  });
});

describe("river skeleton helpers", () => {
  const grid = (rows: string[]) => {
    const width = rows[0]!.length;
    const mask = new Uint8Array(width * rows.length);
    rows.forEach((row, y) => [...row].forEach((c, x) => (mask[y * width + x] = c === "#" ? 1 : 0)));
    return { mask, width, height: rows.length };
  };

  it("thins a three-pixel band to one line and traces it end to end", () => {
    const { mask, width, height } = grid([
      "..........",
      ".########.",
      ".########.",
      ".########.",
      "..........",
    ]);
    thin(mask, width, height);
    removeCorners(mask, width, height);
    const lines = skeletonLines(mask, width, height);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points.length).toBeGreaterThanOrEqual(5);
    expect(new Set(lines[0]!.points.map((p) => p[1])).size).toBe(1);
  });

  it("traces a fork as three lines meeting at one point, prunes a short spur and joins what is left", () => {
    const { mask, width, height } = grid([
      "........#.......",
      "........#.......",
      "........#.......",
      "################",
    ]);
    const lines = skeletonLines(mask, width, height);
    expect(lines).toHaveLength(3);
    const forks = new Set(lines.flatMap((l) => [l.from, l.to]));
    expect(forks.size).toBe(4); // three free ends and one fork
    const forkId = [...forks].find((j) => lines.every((l) => l.from === j || l.to === j))!;
    const fork = lines[0]!.from === forkId ? lines[0]!.points[0] : lines[0]!.points.at(-1);
    for (const line of lines) {
      expect([line.points[0], line.points.at(-1)]).toContainEqual(fork);
    }
    expect(pruneSpurs(lines, 2)).toHaveLength(3);
    const pruned = pruneSpurs(lines, 5);
    expect(pruned).toHaveLength(2);
    const joined = chainLines(pruned);
    expect(joined).toHaveLength(1);
    const ends = [joined[0]!.points[0]![0], joined[0]!.points.at(-1)![0]];
    expect(ends.sort((x, y) => x! - y!)).toEqual([0.5, 15.5]);
  });

  it("drops the corner pixels of a step, then traces a ring as one loop", () => {
    const { mask, width, height } = grid([".####.", ".#..#.", ".####."]);
    removeCorners(mask, width, height);
    expect(mask[1]).toBe(0);
    const lines = skeletonLines(mask, width, height);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.from).toBe(lines[0]!.to);
  });

  it("simplifies a line with Douglas-Peucker, keeping its ends, and keeps a loop's far side", () => {
    const line = [
      [0, 0],
      [1, 0.1],
      [2, 0],
      [3, 2],
    ];
    expect(simplifyLine(line, 0.5)).toEqual([
      [0, 0],
      [2, 0],
      [3, 2],
    ]);
    expect(simplifyLine(line, 0)).toBe(line);
    const loop = [
      [0, 0],
      [2, 0.1],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ];
    expect(simplifyLine(loop, 0.5)).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ]);
  });
});
