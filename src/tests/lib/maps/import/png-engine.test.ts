/** @jest-environment node */
import area from "@turf/area";
import booleanIntersects from "@turf/boolean-intersects";
import intersect from "@turf/intersect";
import { featureCollection, feature } from "@turf/helpers";
import type { MultiPolygon, Polygon } from "geojson";
import { runPngEngine } from "~/lib/maps/import/png/engine";
import { buildNationGeometries } from "~/lib/maps/import/build";
import { resolveGeoreference } from "~/lib/maps/import/georef";
import { deltaE2000, hexToRgb, rgbToLab } from "~/lib/maps/import/colour";
import { engineContext } from "~/lib/maps/import/progress";
import { polygonPlanarArea } from "~/lib/maps/ring-assembly";
import type { EngineResult } from "~/lib/maps/import/options";
import {
  BROWN,
  encode,
  GREEN,
  hex,
  MAP_H,
  MAP_W,
  OCEAN,
  paint,
  PURPLE,
  RED,
  YELLOW,
  type Rgb,
} from "~/tests/fixtures/map-import-images";

const ctx = () => engineContext(() => undefined, { sliceMs: Infinity });
const whole = resolveGeoreference(undefined, MAP_W, MAP_H).transform;

/** The palette colour of the result nearest a truth colour, or undefined when none is within ΔE 12. */
function keyFor(result: EngineResult, rgb: Rgb): string | undefined {
  const lab = rgbToLab(rgb);
  return result.regions.find((r) => r.colour && deltaE2000(rgbToLab(hexToRgb(r.colour)), lab) < 12)
    ?.key;
}

function mapping(result: EngineResult): Record<string, string> {
  return {
    [keyFor(result, RED)!]: "Red",
    [keyFor(result, GREEN)!]: "Green",
    [keyFor(result, YELLOW)!]: "Yellow",
    [keyFor(result, BROWN)!]: "Yellow",
    [keyFor(result, OCEAN)!]: "Ocean",
  };
}

const planarArea = (g: Polygon | MultiPolygon) =>
  (g.type === "Polygon" ? [g.coordinates] : g.coordinates).reduce(
    (s, p) => s + polygonPlanarArea(p),
    0
  );

function nationsOf(result: EngineResult, transform = whole) {
  const built = buildNationGeometries(result, mapping(result), transform);
  return Object.fromEntries(built.nations.map((n) => [n.nation, n.geometry]));
}

describe("PNG engine: anti-aliased map with black border lines", () => {
  let result: EngineResult;
  beforeAll(async () => {
    // Specks under 100 px merge: the 8×8 purple speck (62 px once its border line is shared out), not the island.
    const png = await encode(paint({ antiAlias: true, borders: true }), "png");
    result = await runPngEngine(png, { minRegionPixels: 100 }, ctx());
  });

  it("finds the true colours only, not the blends or the border lines", () => {
    const colours = result.regions.map((r) => r.colour);
    expect(colours).toHaveLength(6); // ocean, red, green, yellow, brown, the purple speck
    for (const rgb of [OCEAN, RED, GREEN, YELLOW, BROWN, PURPLE])
      expect(keyFor(result, rgb)).toBeDefined();
    expect(result.report.filledPixels).toBeGreaterThan(0);
  });

  it("merges the speck into its largest neighbour and reports it", () => {
    const speck = result.regions.find((r) => r.key === keyFor(result, PURPLE));
    expect(speck?.pixels).toBe(0);
    expect(result.report.mergedRegions?.count).toBeGreaterThanOrEqual(1);
  });

  it("removes the border lines so neighbours touch, without overlapping", () => {
    const nations = nationsOf(result);
    const red = feature(nations.Red!);
    const green = feature(nations.Green!);
    expect(booleanIntersects(red, green)).toBe(true);
    const overlap = intersect(featureCollection([red, green]));
    expect(overlap ? area(overlap) : 0).toBeLessThan(area(green) * 0.001);
  });

  it("tiles the image: the regions' areas add up to the whole map (no gaps, no overlaps)", () => {
    const built = buildNationGeometries(
      result,
      Object.fromEntries(result.regions.map((r) => [r.key, r.key])),
      null
    );
    const total = built.nations.reduce((s, n) => s + planarArea(n.geometry), 0);
    expect(Math.abs(total - MAP_W * MAP_H) / (MAP_W * MAP_H)).toBeLessThan(0.002);
  });

  it("keeps a lake inside a nation as a hole and an island as a second polygon", () => {
    const nations = nationsOf(result);
    expect(nations.Red!.type).toBe("Polygon");
    expect((nations.Red as Polygon).coordinates).toHaveLength(2); // outline + lake
    expect(nations.Green!.type).toBe("MultiPolygon");
    expect((nations.Green as MultiPolygon).coordinates).toHaveLength(2); // mainland + island
  });

  it("merges two colours of one nation along their shared border", () => {
    const yellow = nationsOf(result).Yellow!;
    expect(yellow.type).toBe("Polygon");
    expect((yellow as Polygon).coordinates).toHaveLength(1);
  });

  it("georeferences pixels as a whole-globe map by default", () => {
    const green = nationsOf(result).Green!;
    const lons = (green as MultiPolygon).coordinates.flat(2).map((p) => p[0]!);
    expect(Math.min(...lons)).toBeGreaterThan(-180);
    expect(Math.max(...lons)).toBeLessThanOrEqual(180);
    // The island (x 140–154 of 160) sits at lon 135–166.5.
    expect(Math.max(...lons)).toBeCloseTo(166.5, 0);
  });
});

describe("PNG engine: JPEG compression noise", () => {
  it("still finds the true colours and touching borders", async () => {
    const jpeg = await encode(paint({ antiAlias: true, borders: true, noise: 6 }), "jpeg");
    const result = await runPngEngine(jpeg, {}, ctx());
    const nationColours = [OCEAN, RED, GREEN, YELLOW, BROWN];
    for (const rgb of nationColours) expect(keyFor(result, rgb)).toBeDefined();
    const significant = result.regions.filter((r) => (r.pixels ?? 0) > 0);
    expect(significant.length).toBeLessThanOrEqual(nationColours.length + 1);
    const nations = nationsOf(result);
    expect(booleanIntersects(feature(nations.Red!), feature(nations.Green!))).toBe(true);
  });
});

describe("PNG engine: colour key", () => {
  it("uses the key's colours as the palette and names the regions", async () => {
    const png = await encode(paint({ borders: true }), "png");
    const result = await runPngEngine(
      png,
      {
        colourKey: [
          { hex: hex(RED), nation: "Red" },
          { hex: hex(GREEN), nation: "Green" },
          { hex: hex(YELLOW), nation: "Yellow" },
          { hex: hex(BROWN), nation: "Yellow" },
        ],
        waterColours: [hex(OCEAN)],
      },
      ctx()
    );
    expect(result.regions.map((r) => r.key).sort()).toEqual(
      [hex(RED), hex(GREEN), hex(YELLOW), hex(BROWN), hex(OCEAN)].sort()
    );
    expect(result.regions.find((r) => r.key === hex(RED))?.name).toBe("Red");
    expect(result.regions.find((r) => r.key === hex(OCEAN))?.water).toBe(true);
    // The purple speck matches no key colour: reported, and filled from its neighbour.
    expect(result.report.unmatchedColours?.[0]?.hex).toBe(hex(PURPLE));
  });
});
