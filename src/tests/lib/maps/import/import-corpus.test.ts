/** @jest-environment node */
/**
 * A corpus of realistic maps an admin imports, and what the import engines must make of them: painted political maps
 * (PNG and JPEG) traced into borders that tile the map; map art traced into land, lakes, climate and ice across the
 * antimeridian and round the pole; a geography map's elevation bands, nested as Ixnay stores them; an Inkscape SVG
 * read shape by shape and georeferenced with Mercator control points; a GeoJSON in a projected CRS refused. Then the
 * untrusted keys and names around them: a climate key read as plain data with https links only, and the region names
 * matched to the realm's nations without ever giving one region to two nations or duplicating a province.
 * Folds: src/tests/lib/maps/import/climate-key-source.test.ts, src/tests/lib/maps/import/colour-key.test.ts,
 * src/tests/lib/maps/import/georef.test.ts, src/tests/lib/maps/import/png-engine.test.ts,
 * src/tests/lib/maps/import/png-layer-elevation.test.ts, src/tests/lib/maps/import/png-layer-engine.test.ts,
 * src/tests/lib/maps/import/svg-geojson-engines.test.ts, src/tests/lib/maps/province-importer/merge-plan.test.ts,
 * src/tests/lib/maps/nation-name-matching.test.ts, src/tests/lib/svg-parser-geometry.test.ts,
 * src/tests/components/maps/region-nation-mapper.test.tsx
 */
import area from "@turf/area";
import booleanIntersects from "@turf/boolean-intersects";
import intersect from "@turf/intersect";
import { feature, featureCollection } from "@turf/helpers";
import sharp from "sharp";
import type { LineString, MultiLineString, MultiPolygon, Polygon, Position } from "geojson";
import { buildNationGeometries } from "~/lib/maps/import/build";
import { readClimateKeySource } from "~/lib/maps/import/climate-key-source";
import { deltaE2000, hexToRgb, rgbToLab } from "~/lib/maps/import/colour";
import { GeojsonImportError, inspectGeojson } from "~/lib/maps/import/geojson-engine";
import { inverseMercatorY, mercatorY, resolveGeoreference } from "~/lib/maps/import/georef";
import { checkNationName } from "~/lib/maps/import/nation-names";
import type { EngineResult } from "~/lib/maps/import/options";
import type { ElevationBand } from "~/lib/maps/import/png/elevation";
import { runPngEngine } from "~/lib/maps/import/png/engine";
import {
  runLayerEngine,
  type LayerEngineResult,
  type LayerFeature,
} from "~/lib/maps/import/png/layer-engine";
import { engineContext } from "~/lib/maps/import/progress";
import { runSvgEngine } from "~/lib/maps/import/svg-engine";
import { suggestRegionMatches } from "~/lib/maps/nation-name-matching";
import { buildProvinceMergePlan } from "~/lib/maps/province-importer/merge-plan";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import { polygonPlanarArea } from "~/lib/maps/ring-assembly";
import { LiteralParseError } from "~/lib/realms/sources/js-literal";
import {
  BROWN,
  encode as encodePainted,
  GREEN,
  MAP_H,
  MAP_W,
  OCEAN,
  paint,
  RED,
  YELLOW,
  type Rgb,
} from "~/tests/fixtures/map-import-images";

const ctx = () => engineContext(() => undefined, { sliceMs: Infinity });
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const inBox = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) =>
  x >= x0 && x < x1 && y >= y0 && y < y1;
const planarArea = (g: Polygon | MultiPolygon) =>
  (g.type === "Polygon" ? [g.coordinates] : g.coordinates).reduce(
    (s, p) => s + polygonPlanarArea(p),
    0
  );
const positionsOf = (g: Polygon | MultiPolygon): Position[] =>
  g.type === "Polygon" ? g.coordinates.flat() : g.coordinates.flat(2);

/** A whole-globe image `width` × `height` drawn pixel by pixel, as PNG. */
function encodeArt(width: number, height: number, pixel: (x: number, y: number) => Rgb) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), (y * width + x) * 3);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

describe("a painted political map (PNG engine)", () => {
  /**
   * The fixture map: Red (west) and Green (east) share a wavy border; Yellow and Brown (one nation in two colours)
   * lie under Red; Red has a round lake; Green has an island in the sea and an 8×8 purple speck.
   */
  const PAINTED = [OCEAN, RED, GREEN, YELLOW, BROWN];
  const whole = resolveGeoreference(undefined, MAP_W, MAP_H).transform;

  /** The palette colour of the result nearest a truth colour, or undefined when none is within ΔE 12. */
  const keyFor = (result: EngineResult, rgb: Rgb) =>
    result.regions.find(
      (r) => r.colour && deltaE2000(rgbToLab(hexToRgb(r.colour)), rgbToLab(rgb)) < 12
    )?.key;

  function nationsOf(result: EngineResult) {
    const mapping = {
      [keyFor(result, RED)!]: "Red",
      [keyFor(result, GREEN)!]: "Green",
      [keyFor(result, YELLOW)!]: "Yellow",
      [keyFor(result, BROWN)!]: "Yellow",
      [keyFor(result, OCEAN)!]: "Ocean",
    };
    const built = buildNationGeometries(result, mapping, whole);
    return Object.fromEntries(built.nations.map((n) => [n.nation, n.geometry]));
  }

  it.each<[string, "png" | "jpeg", Parameters<typeof paint>[0], Record<string, number>]>([
    [
      "an anti-aliased PNG with black border lines",
      "png",
      { antiAlias: true, borders: true },
      { minRegionPixels: 100 },
    ],
    ["a JPEG with compression noise", "jpeg", { antiAlias: true, borders: true, noise: 6 }, {}],
  ])(
    "%s: one region per painted colour, borders that tile the map, the lake a hole and the island a polygon",
    async (_name, format, painting, options) => {
      const result = await runPngEngine(
        await encodePainted(paint(painting), format),
        options,
        ctx()
      );
      for (const rgb of PAINTED) expect(keyFor(result, rgb)).toBeDefined();
      const significant = result.regions.filter((r) => (r.pixels ?? 0) > 0);
      expect(significant.length).toBeLessThanOrEqual(PAINTED.length + 1);

      // the border lines are shared out: neighbours meet without overlapping, and the regions tile the image
      const nations = nationsOf(result);
      const red = feature(nations.Red!);
      const green = feature(nations.Green!);
      expect(booleanIntersects(red, green)).toBe(true);
      const overlap = intersect(featureCollection([red, green]));
      expect(overlap ? area(overlap) : 0).toBeLessThan(area(green) * 0.001);
      const regions = Object.fromEntries(result.regions.map((r) => [r.key, r.key]));
      const tiled = buildNationGeometries(result, regions, null).nations;
      const total = tiled.reduce((s, n) => s + planarArea(n.geometry), 0);
      expect(Math.abs(total - MAP_W * MAP_H) / (MAP_W * MAP_H)).toBeLessThan(0.002);

      expect(nations.Red!.type).toBe("Polygon");
      expect((nations.Red as Polygon).coordinates).toHaveLength(2); // outline + lake
      expect(nations.Green!.type).toBe("MultiPolygon");
      expect((nations.Green as MultiPolygon).coordinates).toHaveLength(2); // mainland + island
    }
  );
});

describe("map art on a whole globe (layer engine)", () => {
  const W = 200;
  const H = 100;
  /** 1 px is 1.8° × 1.8° on this 200 × 100 globe. */
  const PX = 1.8 * 1.8;
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

  /**
   * Continent A (x 20-80) crossed by two 2 px border lines (x 50 and y 30, meeting in a junction no single line pass
   * closes) and holding a round lake; continent B (x 88-120) across an 8 px strait; a north-south strip C
   * (x 140-150) that cuts the sea in two halves which meet across the antimeridian; and a polar strip D (y 92-99)
   * round the whole globe.
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
  /** A polygon layer's feature geometry (rivers are the only line layer). */
  const polygon = (f: LayerFeature): Polygon => {
    if (f.geometry.type !== "Polygon")
      throw new Error(`${f.key} is a ${f.geometry.type}, not a Polygon`);
    return f.geometry;
  };

  let result: LayerEngineResult;
  beforeAll(async () => {
    result = await runLayerEngine(
      {
        land: await encodeArt(W, H, landPixel),
        climate: { image: await encodeArt(W, H, climatePixel), key: KEY },
        ice: await encodeArt(W, H, icePixel),
      },
      { simplify: 0, smooth: 0, minRegionPixels: { climate: 30, land: 4, icecaps: 30 } },
      ctx()
    );
  });

  it("finds the lake but not the sea halves that meet across the antimeridian", () => {
    const lakes = result.layers.lakes!;
    expect(lakes).toHaveLength(1);
    expect(lakes[0]!.properties).toMatchObject({ fill: "#84daff", "ixmap-subgroup": null });
    const discPixels = Math.PI * 6 * 6;
    expect(polygonPlanarArea(polygon(lakes[0]!).coordinates) / PX).toBeGreaterThan(
      discPixels * 0.8
    );
    expect(polygonPlanarArea(polygon(lakes[0]!).coordinates) / PX).toBeLessThan(discPixels * 1.2);
  });

  it("traces the polar ice round the whole globe and drops a white label speck and a white islet", () => {
    const ice = result.layers.icecaps!;
    expect(ice).toHaveLength(1);
    expect(ice[0]!.properties).toMatchObject({ fill: "#ffffff" });
    const outline = polygon(ice[0]!).coordinates[0]!;
    const lons = outline.map((p) => p[0]!);
    expect(Math.min(...lons)).toBe(-180);
    expect(Math.max(...lons)).toBe(180);
    expect(Math.min(...outline.map((p) => p[1]!))).toBe(-90);
  });
});

describe("a geography map's elevation (layer engine)", () => {
  const W = 240;
  const H = 120;
  /** 1 px is 1.5° × 1.5° on this 240 × 120 globe. */
  const PX = 1.5 * 1.5;
  /** The legend's bands: lowlands, hills, highlands and white peaks (out of order, as a legend may list them). */
  const BANDS: ElevationBand[] = [
    { color: "#ffffff", min: 2000, max: null },
    { color: "#a5bf8e", min: 0, max: 50 },
    { color: "#b8cda6", min: 50, max: 500 },
    { color: "#c6d6b7", min: 500, max: 2000 },
  ];
  const RIVER = "#5184c8";

  /**
   * A continent (x 30-210, y 20-100) with a lake (x 150-160, y 88-96), and polar ice (y 108-119, land round the
   * globe). Bands nest: hills x 60-180 y 35-85, highlands x 90-150 y 45-75, a peak x 110-130 y 55-65. A white flag
   * (x 40-46, y 25-29) sits on the lowlands. Rivers, a national border and a label stroke are drawn over the land.
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
    return inBox(x, y, 149, 87, 161, 97) && !inBox(x, y, 150, 88, 160, 96);
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
    if (r === "sea" || r === "lake") return rgbOf("#76d5f5");
    if (riverAt(x, y)) return rgbOf(RIVER);
    if (x === 70 && y >= 80) return rgbOf("#94000b"); // a national border
    return rgbOf(bandColour(x, y));
  }

  const areaPx = (features: Array<{ geometry: Polygon | LineString | MultiLineString }>) =>
    features.reduce(
      (sum, f) =>
        sum + (f.geometry.type === "Polygon" ? polygonPlanarArea(f.geometry.coordinates) : 0),
      0
    ) / PX;
  /** Within `share` (1%): the mode filter rounds a band's pixel corners, which shows most on a small band. */
  const expectNear = (actual: number, expected: number, share = 0.01) =>
    expect(Math.abs(actual - expected) / expected).toBeLessThan(share);

  it("stores the bands nested, as Ixnay does: each covers the land at or above its lowest elevation", async () => {
    const geography = await encodeArt(W, H, geographyPixel);
    const result = await runLayerEngine(
      {
        land: await encodeArt(W, H, blankPixel),
        ice: geography,
        elevation: { image: geography, bands: BANDS },
        rivers: { image: geography, colours: [RIVER] },
      },
      {
        simplify: 0,
        smooth: 0,
        elevationSmoothing: 0,
        minRegionPixels: { land: 4, icecaps: 400, elevation: 16 },
      },
      ctx()
    );
    const band = (subgroup: string) =>
      result.layers.altitudes!.filter((f) => f.properties["ixmap-subgroup"] === subgroup);
    expectNear(areaPx(band("coastlines")), 180 * 80 - 10 * 8 + W * 12);
    expectNear(areaPx(band("Altitude-1")), 120 * 50);
    expectNear(areaPx(band("Altitude-3")), 60 * 30);
    expectNear(areaPx(band("Altitude-5")), 20 * 10, 0.08);
    expect(band("Altitude-5")[0]!.properties).toMatchObject({
      fill: "#bea276",
      zoneId: "zone_5",
      zoneName: "2,000 m and above",
      elevationMin: 2000,
      elevationMax: null,
      elevationLabel: "2,000 m and above",
    });
  });
});

describe("a drawn map", () => {
  const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="100 50 400 200">
  <rect x="100" y="50" width="400" height="200" fill="#3366cc" id="ocean"/>
  <g id="political" inkscape:label="Political" transform="translate(100 50)">
    <rect x="0" y="0" width="400" height="200" fill="#2255aa"/>
    <g id="g12"><title>Aurelia</title>
      <rect x="10" y="10" width="80" height="60" fill="#e04040"/>
      <polygon points="100,10 140,10 140,40 100,40" fill="#e04040"/>
    </g>
    <path id="Borealis" d="M 200 10 L 300 10 L 300 110 L 200 110 Z M 230 40 L 270 40 L 270 80 L 230 80 Z" fill="#40b040"/>
    <circle cx="350" cy="150" r="20" fill="#e0c040" inkscape:label="Cyrene"/>
    <g transform="scale(2)"><path d="M 10 60 L 20 60 L 20 70 L 10 70 Z" fill="#9040a0"/></g>
    <path d="M 20 150 A 20 20 0 0 1 60 150 Z" fill="#20a0a0" id="path99"/>
  </g>
  <text x="135" y="195" transform="translate(-5 -10)">Dunmore</text>
</svg>`;
  const result = runSvgEngine(SVG);
  const byName = Object.fromEntries(result.regions.map((r) => [r.name ?? r.key, r]));
  const byColour = (colour: string) => result.regions.find((r) => r.colour === colour)!;
  const geometryOf = (key: string) =>
    result.features!.features.find((f) => f.properties.key === key)!.geometry;
  const xs = (g: Polygon | MultiPolygon) => positionsOf(g).map((p) => p[0]!);

  it("reads each shape where it is drawn: the layer's translate, a nested scale, a hole as a subpath, circles and arcs", () => {
    // translate(100 50) less the viewBox origin (100, 50)
    expect(Math.min(...xs(geometryOf(byName.Aurelia!.key)))).toBeCloseTo(10, 6);
    const scaled = geometryOf(byColour("#9040a0").key);
    expect(Math.min(...xs(scaled))).toBeCloseTo(20, 6);
    expect(planarArea(scaled)).toBeCloseTo(400, 6); // 10×10 scaled by 2
    const borealis = geometryOf(byName.Borealis!.key) as Polygon;
    expect(borealis.coordinates).toHaveLength(2);
    expect(planarArea(borealis)).toBeCloseTo(100 * 100 - 40 * 40, 6);
    // A circle is drawn with 32 segments; the arc follows the half circle.
    expect(planarArea(geometryOf(byName.Cyrene!.key)) / (Math.PI * 400)).toBeGreaterThan(0.99);
    const half = geometryOf(byColour("#20a0a0").key);
    expect(planarArea(half) / ((Math.PI * 400) / 2)).toBeGreaterThan(0.97);
  });

  it("puts the borders where Mercator control points say: latitude from the inverse Mercator", () => {
    // 5 px per degree of longitude from 40°W, and per unit of Mercator y down from 70°N
    const toPixel = (lon: number, lat: number) => ({
      x: (lon + 40) * 5,
      y: (mercatorY(70) - mercatorY(lat)) * 5,
      lon,
      lat,
    });
    const points = [toPixel(-30, 65), toPixel(30, 68), toPixel(0, 55), toPixel(-10, 60)];
    const georef = resolveGeoreference(
      { projection: "mercator", controlPoints: points },
      result.width,
      result.height
    );
    expect(georef.rmseDegrees).toBeLessThan(1e-6);
    const built = buildNationGeometries(
      result,
      { [byName.Aurelia!.key]: "Aurelia", [byName.Borealis!.key]: "Borealis" },
      georef.transform
    );
    expect(built.nations.map((n) => n.nation)).toEqual(["Aurelia", "Borealis"]);
    // Aurelia spans x 10-140 and y 10-70 of the drawing (borders are stored to 5 decimals)
    const aurelia = positionsOf(built.nations[0]!.geometry);
    const lats = aurelia.map((p) => p[1]!);
    expect(Math.min(...aurelia.map((p) => p[0]!))).toBeCloseTo(-38, 4);
    expect(Math.max(...lats)).toBeCloseTo(inverseMercatorY(mercatorY(70) - 2), 4);
    expect(Math.min(...lats)).toBeCloseTo(inverseMercatorY(mercatorY(70) - 14), 4);
  });

  it("refuses a GeoJSON in a projected CRS, whose coordinates are not lon/lat", () => {
    const fc = (size: number, crs: string) =>
      JSON.stringify({
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: crs } },
        features: [
          {
            type: "Feature",
            properties: { NAME: "A" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [size, size],
                  [size * 1.1, size],
                  [size * 1.1, size * 1.1],
                  [size, size * 1.1],
                  [size, size],
                ],
              ],
            },
          },
        ],
      });
    expect(() => inspectGeojson(fc(1e6, "urn:ogc:def:crs:EPSG::3857"))).toThrow(GeojsonImportError);
    // a CRS that names Web Mercator over coordinates that are lon/lat is only warned about
    expect(inspectGeojson(fc(1, "EPSG:3857")).warnings[0]).toMatch(/valid longitude\/latitude/);
  });
});

describe("keys and names around an import", () => {
  it("reads a climate key as plain data only, keeping only its https links", () => {
    const read = (source: string) =>
      readClimateKeySource(source, { system: "Köppen", zonesBinding: "Z" });
    expect(
      read(`const Z = [{ code: "ET", name: "Tundra", color: "#B2B2B2", link: "javascript:alert(1)" },
        { code: "EF", name: "Ice Cap", color: "#686868", wiki: "https://example.org/ef" }];`).zones
    ).toEqual([
      { code: "ET", name: "Tundra", color: "#b2b2b2" },
      { code: "EF", name: "Ice Cap", color: "#686868", link: "https://example.org/ef" },
    ]);
    // the file is never run: code in it is refused, not evaluated
    expect(() => read(`const Z = [{ code: run() }];`)).toThrow(LiteralParseError);
  });

  it("gives a region two nations claim equally to neither", () => {
    const twins = [
      { id: "a", name: "Aurelia" },
      { id: "b", name: "The Aurelia" },
    ];
    expect(suggestRegionMatches([{ featureId: "f", displayName: "aurelia" }], twins)).toEqual([]);
  });

  it("flags a name that is not one of the realm's nations, with close spellings to pick", () => {
    const nations = [{ name: "Aurelia", countryId: "c1" }, { name: "Borealis" }];
    expect(checkNationName("Borealys", nations)).toMatchObject({
      status: "new",
      suggestions: [{ name: "Borealis" }],
    });
  });

  it("merges a province whose name is taken, whatever its case and spaces, instead of duplicating it (regression)", () => {
    const plan = buildProvinceMergePlan(
      [{ name: " Eryx " }, { name: "Caphiria 1" }],
      [{ id: "a", name: "eryx" }],
      false
    );
    expect(plan.map((p) => p.existingId)).toEqual(["a", null]);
  });
});
