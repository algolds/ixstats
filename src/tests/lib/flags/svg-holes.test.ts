/** @jest-environment node */
/**
 * Lakes stay holes through the SVG → GeoJSON parser, whichever way the drawing tool wound them, and through the PNG
 * path (potrace traces a lake as an inner subpath). Areas subtract them.
 */
import type { MultiPolygon, Polygon, Position } from "geojson";
import { convertPngToSvg } from "~/lib/flags/png-to-svg";
import { parseSvgToGeoJson } from "~/lib/flags/svg-parser";
import { signedRingArea } from "~/lib/maps/ring-assembly";
import { lakeAndIslandPng } from "~/tests/fixtures/png-maps";

const svg = (path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360"><g id="political">${path}</g></svg>`;

function parseOne(path: string) {
  const feature = parseSvgToGeoJson(svg(path), "political").features[0]!;
  return { geometry: feature.geometry as Polygon | MultiPolygon, areaSqKm: feature.areaSqKm };
}

const polygonsOf = (g: Polygon | MultiPolygon) =>
  g.type === "Polygon" ? [g.coordinates] : g.coordinates;
const lngRange = (ring: Position[]) => [
  Math.round(Math.min(...ring.map((p) => p[0]!))),
  Math.round(Math.max(...ring.map((p) => p[0]!))),
];
/** Each polygon's rings as their longitude ranges, outer first. */
const shape = (g: Polygon | MultiPolygon) => polygonsOf(g).map((p) => p.map(lngRange));

function expectRfc7946(g: Polygon | MultiPolygon) {
  for (const [outer, ...holes] of polygonsOf(g)) {
    expect(signedRingArea(outer!)).toBeGreaterThan(0);
    for (const hole of holes) expect(signedRingArea(hole)).toBeLessThan(0);
  }
}

// In SVG space (y down): nation 100–200, lake 130–170 inside it, island 300–350.
const NATION_CW = "M 100 100 L 200 100 L 200 200 L 100 200 Z";
const NATION_CCW = "M 100 100 L 100 200 L 200 200 L 200 100 Z";
const LAKE_CW = "M 130 130 L 170 130 L 170 170 L 130 170 Z";
const LAKE_CCW = "M 130 130 L 130 170 L 170 170 L 170 130 Z";
const ISLAND_CW = "M 300 100 L 350 100 L 350 150 L 300 150 Z";
const ISLAND_CCW = "M 300 100 L 300 150 L 350 150 L 350 100 Z";

const LAKE_AND_ISLAND = [
  [-130, -80],
  [-115, -95],
];

describe("parseSvgToGeoJson — lakes and islands", () => {
  it.each([
    ["nation CW, lake CCW, island CW", `${NATION_CW} ${LAKE_CCW} ${ISLAND_CW}`],
    ["nation CCW, lake CW, island CCW", `${NATION_CCW} ${LAKE_CW} ${ISLAND_CCW}`],
    ["every subpath wound the same way", `${NATION_CW} ${LAKE_CW} ${ISLAND_CW}`],
  ])("%s: the lake is a hole of the nation, the island its own polygon", (_name, d) => {
    const { geometry } = parseOne(`<path id="A" d="${d}"/>`);
    expect(geometry.type).toBe("MultiPolygon");
    expect(shape(geometry)).toEqual([LAKE_AND_ISLAND, [[-30, -5]]]);
    expectRfc7946(geometry);
  });

  it("an island in a lake is land again", () => {
    const islet = "M 140 140 L 160 140 L 160 160 L 140 160 Z";
    const { geometry } = parseOne(`<path id="A" d="${NATION_CW} ${LAKE_CW} ${islet}"/>`);
    expect(shape(geometry)).toEqual([LAKE_AND_ISLAND, [[-110, -100]]]);
    expectRfc7946(geometry);
  });

  it("several islands each keep their own lakes", () => {
    const islandLake = "M 310 110 L 320 110 L 320 120 L 310 120 Z";
    const { geometry } = parseOne(
      `<path id="A" d="${NATION_CW} ${LAKE_CW} ${ISLAND_CW} ${islandLake}"/>`
    );
    expect(shape(geometry)).toEqual([
      LAKE_AND_ISLAND,
      [
        [-30, -5],
        [-25, -20],
      ],
    ]);
    expectRfc7946(geometry);
  });

  it("the area is the nation less its lake", () => {
    const solid = parseOne(`<path id="A" d="${NATION_CW}"/>`).areaSqKm;
    const lake = parseOne(`<path id="A" d="${LAKE_CW}"/>`).areaSqKm;
    const holed = parseOne(`<path id="A" d="${NATION_CW} ${LAKE_CCW}"/>`).areaSqKm;
    expect(holed).toBeCloseTo(solid - lake, 1);
  });

  it("honours an explicit fill-rule:nonzero, on the path or inherited from its group", () => {
    const own = parseOne(`<path id="A" style="fill-rule:nonzero" d="${NATION_CW} ${LAKE_CW}"/>`);
    expect(shape(own.geometry)).toEqual([[[-130, -80]]]);

    const inherited = parseOne(
      `<g fill-rule="nonzero"><path id="A" d="${NATION_CW} ${LAKE_CCW}"/></g>`
    );
    expect(shape(inherited.geometry)).toEqual([LAKE_AND_ISLAND]);
  });
});

describe("PNG maps — a traced lake ends up a hole", () => {
  it("potrace's inner subpath becomes the nation's hole, next to its island", async () => {
    const result = await convertPngToSvg(await lakeAndIslandPng(), {
      colorMapping: { "#ff0000": "Lakeland" },
    });
    const feature = parseSvgToGeoJson(result.svg, "political").features[0]!;
    const geometry = feature.geometry as Polygon | MultiPolygon;

    expect(feature.featureId).toBe("Lakeland");
    expect(geometry.type).toBe("MultiPolygon");
    const polygons = polygonsOf(geometry);
    expect(polygons.map((p) => p.length).sort()).toEqual([1, 2]);
    expectRfc7946(geometry);

    // The hole sits inside the mainland, west of the island.
    const mainland = polygons.find((p) => p.length === 2)!;
    const island = polygons.find((p) => p.length === 1)!;
    const [lakeWest, lakeEast] = lngRange(mainland[1]!);
    const [landWest, landEast] = lngRange(mainland[0]!);
    expect(lakeWest).toBeGreaterThan(landWest);
    expect(lakeEast).toBeLessThan(landEast);
    expect(lngRange(island[0]!)[0]).toBeGreaterThan(landEast);
  });
});
