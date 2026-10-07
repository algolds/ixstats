/** @jest-environment node */
/**
 * Every approximate-area helper subtracts a polygon's holes (a nation's lake is not its land), and the province
 * importer tells outer rings from holes by containment.
 */
import type { MultiPolygon, Polygon, Position } from "geojson";
import { calculateArea } from "~/lib/maps/border-editor";
import { polygonMetrics } from "~/lib/maps/feature-metrics";
import { calculateApproxArea } from "~/lib/flags/svg/topology-flattener";
import { computeApproxAreaForFeature } from "~/server/api/routers/geo/core/geometry";
import { parseProvinceSvg } from "~/lib/maps/province-importer/parse-provinces";
import { signedRingArea } from "~/lib/maps/ring-assembly";

function square(x: number, y: number, size: number, cw = false): Position[] {
  const ring: Position[] = [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
  return cw ? ring.reverse() : ring;
}

const solid: Polygon = { type: "Polygon", coordinates: [square(10, 10, 4)] };
const lake: Polygon = { type: "Polygon", coordinates: [square(11, 11, 2)] };
const holed: Polygon = {
  type: "Polygon",
  coordinates: [square(10, 10, 4), square(11, 11, 2, true)],
};
const island: Polygon = { type: "Polygon", coordinates: [square(20, 10, 1)] };
const nation: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [holed.coordinates, island.coordinates],
};

/** Within 0.5%: the helpers scale by slightly different latitudes (a geometry's centroid moves with its holes). */
const expectNear = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(expected * 0.005);

describe.each([
  ["border-editor calculateArea", (g: Polygon | MultiPolygon) => calculateArea(g)],
  ["polygonMetrics", (g: Polygon | MultiPolygon) => polygonMetrics(g)!.areaSqKm],
  [
    "geo core computeApproxAreaForFeature",
    (g: Polygon | MultiPolygon) => computeApproxAreaForFeature(g),
  ],
  [
    "calculateApproxArea over the flattened rings",
    (g: Polygon | MultiPolygon) =>
      calculateApproxArea(g.type === "Polygon" ? g.coordinates : g.coordinates.flat()),
  ],
])("%s", (_name, area) => {
  it("subtracts a lake from its polygon", () => {
    expect(area(holed)).toBeLessThan(area(solid));
    expectNear(area(holed), area(solid) - area(lake));
  });

  it("adds islands and subtracts each polygon's own holes", () => {
    expectNear(area(nation), area(holed) + area(island));
  });
});

describe("computeApproxAreaForFeature", () => {
  it("closes open rings before measuring", () => {
    const open: Polygon = { type: "Polygon", coordinates: [square(10, 10, 4).slice(0, -1)] };
    expect(computeApproxAreaForFeature(open)).toBe(computeApproxAreaForFeature(solid));
  });
});

const provinceSvg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g id="provinces">${body}</g></svg>`;
// 8-vertex outlines (the importer drops shapes under 8 points as markers).
const OUTLINE = "M 10 10 L 60 10 L 110 10 L 110 60 L 110 110 L 60 110 L 10 110 L 10 60 Z";
const LAKE_SAME_WAY = "M 40 40 L 60 40 L 80 40 L 80 60 L 80 80 L 60 80 L 40 80 L 40 60 Z";

describe("parseProvinceSvg — holes by containment", () => {
  it("a province path's lake is a hole even when wound like its outline", () => {
    const { provinces } = parseProvinceSvg(
      provinceSvg(`<path id="Lakeshire" fill="#ff0000" d="${OUTLINE} ${LAKE_SAME_WAY}"/>`)
    );
    expect(provinces).toHaveLength(1);
    const geometry = provinces[0]!.geometry as Polygon;
    expect(geometry.type).toBe("Polygon");
    expect(geometry.coordinates).toHaveLength(2);
    expect(Math.sign(signedRingArea(geometry.coordinates[0]!))).toBe(
      -Math.sign(signedRingArea(geometry.coordinates[1]!))
    );
  });

  it("one shape of a merged group never punches a hole in another", () => {
    const { provinces } = parseProvinceSvg(
      provinceSvg(
        `<g id="Twin_Isles"><path fill="#00ff00" d="${OUTLINE}"/><path fill="#00ff00" d="${LAKE_SAME_WAY}"/></g>`
      )
    );
    expect(provinces).toHaveLength(1);
    const geometry = provinces[0]!.geometry as MultiPolygon;
    expect(geometry.type).toBe("MultiPolygon");
    expect(geometry.coordinates.map((polygon) => polygon.length)).toEqual([1, 1]);
  });
});
