/** @jest-environment node */
import sharp from "sharp";
import type { Polygon, Position } from "geojson";
import {
  runLayerEngine,
  type LayerEngineResult,
  type LayerFeature,
} from "~/lib/maps/import/png/layer-engine";
import { layerEngineOptionsSchema } from "~/lib/maps/import/png/layer-engine-options";
import { engineContext } from "~/lib/maps/import/progress";
import { polygonPlanarArea } from "~/lib/maps/ring-assembly";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";

type Rgb = [number, number, number];

const W = 200;
const H = 100;
const SEA: Rgb = [255, 255, 255];
const LAND: Rgb = [210, 219, 221];
const DARK_SEA: Rgb = [28, 28, 28];

const KEY: ClimateKey = {
  system: "Köppen",
  zones: [
    { code: "Af", name: "Tropical Rainforest", color: "#0037ff" },
    { code: "Cfb", name: "Oceanic", color: "#21c200" },
    { code: "BSh", name: "Hot Semi-Arid", color: "#fba200" },
    { code: "EF", name: "Ice Cap", color: "#686868" },
  ],
};
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

/**
 * The test world, a whole globe 200 × 100 px: continent A (x 20-80) crossed by two 2 px border lines (x 50 and
 * y 30, meeting in a junction no single line pass closes) and holding a round lake; continent B (x 88-120) across an 8 px strait; a north-south strip C (x 140-150) that cuts
 * the sea in two halves which meet across the antimeridian; and a polar strip D (y 92-99) round the whole globe.
 */
function region(x: number, y: number): "A" | "B" | "C" | "D" | "islet" | "lake" | "line" | null {
  if (y >= 92) return "D";
  if (x >= 170 && x < 173 && y >= 10 && y < 13) return "islet";
  if (x >= 140 && x < 150) return "C";
  if (y < 20 || y >= 70) return null;
  if (x >= 20 && x < 80) {
    if (Math.hypot(x + 0.5 - 35, y + 0.5 - 45) < 6) return "lake";
    return x === 50 || x === 51 || y === 30 || y === 31 ? "line" : "A";
  }
  return x >= 88 && x < 120 ? "B" : null;
}

function landPixel(x: number, y: number): Rgb {
  const r = region(x, y);
  return r === null || r === "lake" || r === "line" ? SEA : LAND;
}

/** Zones: A west of the line Af, east Cfb (with a white legend box holding a BSh swatch), B Cfb, C BSh, D EF. */
function climatePixel(x: number, y: number): Rgb {
  const r = region(x, y);
  if (r === null || r === "lake") return DARK_SEA;
  if (r === "A" && x >= 60 && x < 76 && y >= 54 && y < 68) {
    return x >= 64 && x < 68 && y >= 58 && y < 62 ? rgbOf("#fba200") : [255, 255, 255];
  }
  if (r === "D") return rgbOf("#686868");
  if (r === "C") return rgbOf("#fba200");
  if (r === "B" || x >= 50) return rgbOf("#21c200");
  return rgbOf("#0037ff");
}

/** Ice: D is white; a 3 × 3 white speck on B is a label, and the white islet a halo; neither is ice. */
function icePixel(x: number, y: number): Rgb {
  if (region(x, y) === "D") return [250, 250, 252];
  if (x >= 100 && x < 103 && y >= 30 && y < 33) return [255, 255, 255];
  if (region(x, y) === "islet") return [252, 252, 252];
  return landPixel(x, y) === LAND ? [120, 160, 90] : [100, 180, 230];
}

function encode(pixel: (x: number, y: number) => Rgb): Promise<Buffer> {
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set(pixel(x, y), (y * W + x) * 3);
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

/** A polygon layer's feature geometry (rivers are the only line layer). */
const polygon = (f: LayerFeature): Polygon => {
  if (f.geometry.type !== "Polygon")
    throw new Error(`${f.key} is a ${f.geometry.type}, not a Polygon`);
  return f.geometry;
};
const polygonArea = (g: Polygon) => polygonPlanarArea(g.coordinates);
const totalArea = (features: LayerFeature[] = []) =>
  features.reduce((sum, f) => sum + polygonArea(polygon(f)), 0);
/** 1 px is 1.8° × 1.8° on this 200 × 100 globe. */
const PX = 1.8 * 1.8;

describe("PNG layer engine: land, lakes, climate and ice from map art", () => {
  let result: LayerEngineResult;
  beforeAll(async () => {
    result = await runLayerEngine(
      {
        land: await encode(landPixel),
        climate: { image: await encode(climatePixel), key: KEY },
        ice: await encode(icePixel),
      },
      { simplify: 0, smooth: 0, minRegionPixels: { climate: 30, land: 4, icecaps: 30 } },
      engineContext(() => undefined, { sliceMs: Infinity })
    );
  });

  it("traces land as one altitude band styled as IxWorld's lowest band, border lines counted as land", () => {
    const land = result.layers.altitudes!;
    // A (not split by its border lines), B (across a strait too wide to be a line), C joined to D, the islet
    expect(land).toHaveLength(4);
    for (const f of land) {
      expect(f.properties).toMatchObject({
        fill: "#a8c995",
        "ixmap-subgroup": "coastlines",
        zoneId: "land",
        zoneName: "Land",
        id: f.key,
      });
    }
    const a = land.find((f) => polygon(f).coordinates[0]!.some(([lon]) => lon === -144))!;
    expect(polygon(a).coordinates).toHaveLength(2); // outline + the lake
  });

  it("finds the lake but not the sea halves that meet across the antimeridian", () => {
    const lakes = result.layers.lakes!;
    expect(lakes).toHaveLength(1);
    expect(lakes[0]!.properties).toMatchObject({ fill: "#84daff", "ixmap-subgroup": null });
    const discPixels = Math.PI * 6 * 6;
    expect(polygonArea(polygon(lakes[0]!)) / PX).toBeGreaterThan(discPixels * 0.8);
    expect(polygonArea(polygon(lakes[0]!)) / PX).toBeLessThan(discPixels * 1.2);
  });

  it("tiles the land with climate zones: unmatched pixels filled, a legend swatch merged, the sea left out", () => {
    const climate = result.layers.climate!;
    const landArea = totalArea(result.layers.altitudes);
    expect(Math.abs(totalArea(climate) - landArea) / landArea).toBeLessThan(0.005);
    const zones = new Set(climate.map((f) => f.properties.climateId));
    expect(zones).toEqual(new Set(["Af", "Cfb", "BSh", "EF"]));
    expect(climate.filter((f) => f.properties.climateId === "BSh")).toHaveLength(1); // C only
    expect(climate.find((f) => f.properties.climateId === "Cfb")!.properties).toMatchObject({
      fill: "#21c200",
      climateName: "Cfb: Oceanic",
      "ixmap-subgroup": null,
    });
  });

  it("traces the polar ice round the whole globe and drops a white label speck and a white islet", () => {
    const ice = result.layers.icecaps!;
    expect(ice).toHaveLength(1);
    expect(ice[0]!.properties).toMatchObject({ fill: "#ffffff" });
    const outline = polygon(ice[0]!).coordinates[0]!;
    const lons = outline.map((p: Position) => p[0]!);
    expect(Math.min(...lons)).toBe(-180);
    expect(Math.max(...lons)).toBe(180);
    expect(Math.min(...outline.map((p) => p[1]!))).toBe(-90);
  });

  it("gives every feature a unique key within its layer", () => {
    for (const features of Object.values(result.layers)) {
      const keys = features.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("fills in every speck size it is not given", () => {
    expect(
      layerEngineOptionsSchema.parse({ minRegionPixels: { land: 3 } }).minRegionPixels
    ).toEqual({
      land: 3,
      climate: 512,
      icecaps: 4000,
      elevation: 64,
    });
    expect(layerEngineOptionsSchema.parse({}).minRegionPixels.climate).toBe(512);
  });

  it("refuses art that is not the land image's size", async () => {
    const small = await sharp({
      create: { width: 20, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    await expect(
      runLayerEngine(
        { land: await encode(landPixel), ice: small },
        {},
        engineContext(() => undefined, { sliceMs: Infinity })
      )
    ).rejects.toThrow(/size/);
  });
});
