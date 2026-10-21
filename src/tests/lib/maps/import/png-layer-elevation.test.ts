/** @jest-environment node */
import sharp from "sharp";
import type { LineString, MultiLineString, Polygon } from "geojson";
import {
  altitudeStyles,
  type ElevationBand,
} from "~/lib/maps/import/png/elevation";
import { runLayerEngine, type LayerEngineResult } from "~/lib/maps/import/png/layer-engine";
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
  it("maps Eurth's six bands onto Ixnay's coast band and bands 1, 3, 5, 7 and 8 by their lowest elevation", () => {
    expect(altitudeStyles(EURTH_BANDS)).toEqual([
      { subgroup: "coastlines", fill: "#a8c995", zoneId: "zone_0", label: "0–50 m" },
      { subgroup: "Altitude-1", fill: "#c3d3a1", zoneId: "zone_1", label: "50–500 m" },
      { subgroup: "Altitude-3", fill: "#f7e6b8", zoneId: "zone_3", label: "500–2,000 m" },
      { subgroup: "Altitude-5", fill: "#bea276", zoneId: "zone_5", label: "2,000–4,000 m" },
      { subgroup: "Altitude-7", fill: "#796142", zoneId: "zone_7", label: "4,000–8,000 m" },
      { subgroup: "Altitude-8", fill: "#4f4236", zoneId: "zone_8", label: "8,000 m and above" },
    ]);
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

  it("stores the bands nested, as Ixnay does: each covers the land at or above its lowest elevation", () => {
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
});
