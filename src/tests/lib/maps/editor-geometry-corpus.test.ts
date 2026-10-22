/**
 * The map editor's geometry tools, one row per behaviour a cartographer relies on: the border on a past date is the
 * snapshot in force then, smoothing and naturalising keep a valid closed ring (the same seed gives the same coast), a
 * neighbour's vertex on a shared edge is inserted so borders stay seamless, tracing follows the river between the
 * clicks, generated provinces cover their country, a brush stroke moves territory without creating or losing any, a
 * city SVG from Illustrator names its dots, a province match aligns the cities, a route's difficulty is its climb, a
 * region edit snaps only to the other regions, and an editor shortcut never fires while the user types.
 *
 * Folds border-history-asof, border-shaping, border-snapping, border-trace, province-generator, territory-brush,
 * city-importer/svg-points, city-importer/align-cities, route-terrain and drag-utils. The topology engine's cascade is
 * held by use-border-editor (it lands on the same outlines as the engine).
 */
import type { Polygon, Position } from "geojson";
import { deriveCityAffine } from "~/lib/city-importer/align-cities";
import { parseCitySvg } from "~/lib/city-importer/svg-points";
import { isKeyboardInputTarget } from "~/components/maps/editor/hooks/drag-utils";
import { buildNeighborGeometries } from "~/components/maps/editor/hooks/vertex-edit-geometry";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { mergeBordersAsOf } from "~/lib/maps/border-history-asof";
import {
  alignSharedVertices,
  calculateArea,
  getAllRings,
  naturalizeGeometry,
  smoothGeometry,
  validateGeometry,
} from "~/lib/maps/border-editor";
import { traceAlongLayer, type TraceFeature } from "~/lib/maps/border-trace";
import { normalizeTerrainDifficulty } from "~/lib/maps/geo-math";
import { generateProvinces, totalProvinceArea } from "~/lib/maps/province-generator";
import { applyBrushStroke } from "~/lib/maps/territory-brush";

const ring = (...points: Position[]): Polygon => ({
  type: "Polygon",
  coordinates: [[...points, points[0]!]],
});
const square = (minX: number, minY: number, maxX: number, maxY: number) =>
  ring([minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]);
const closed = (geometry: Polygon) => {
  const outer = getAllRings(geometry)[0]!;
  return JSON.stringify(outer[0]) === JSON.stringify(outer[outer.length - 1]);
};
const line = (...coordinates: Position[]): TraceFeature => ({
  geometry: { type: "LineString", coordinates },
});
const RIVER = line([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]);
const L_SHAPE = ring([0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]);
/** How much of the country the provinces cover, to two decimals. */
const coverage = (country: Polygon, count: number) =>
  Math.round(
    (totalProvinceArea(generateProvinces(country, count, { seed: 1 })) /
      totalProvinceArea([country])) *
      100
  ) / 100;

const history = [
  { countryId: "A", geometry: square(0, 0, 1, 1), changedAt: new Date("2026-01-01") },
  { countryId: "A", geometry: square(0, 0, 3, 3), changedAt: new Date("2026-05-01") },
];
const borderOn = (date: string) =>
  (
    mergeBordersAsOf(
      [{ type: "Feature", geometry: square(0, 0, 2, 2), properties: { countryId: "A" } }],
      history,
      new Date(date)
    )[0]!.geometry as Polygon
  ).coordinates[0]![2];

const SOURCE = square(-1, 0, 0, 1);
const TARGET = square(0, 0, 1, 1);
const brushed = (stroke: [number, number][], radiusKm: number) => {
  const result = applyBrushStroke(stroke, radiusKm, SOURCE, TARGET);
  if (!result) return null;
  const moved =
    calculateArea(TARGET) < calculateArea(result.target) &&
    calculateArea(result.source) < calculateArea(SOURCE);
  const total = calculateArea(result.source) + calculateArea(result.target);
  return {
    moved,
    conserved: Math.abs(total / (calculateArea(SOURCE) + calculateArea(TARGET)) - 1) < 0.01,
  };
};

const ILLUSTRATOR_SVG = `
  <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
    <g id="Cities">
      <circle cx="100" cy="100" r="5" />
      <circle cx="300" cy="100" r="5" />
      <circle cx="500" cy="100" r="5" />
    </g>
    <g id="City_Names">
      <text><tspan x="100" y="105">CH</tspan><tspan x="113" y="105">R</tspan><tspan x="119" y="105">Y</tspan><tspan x="124" y="105">SONUM</tspan></text>
      <text><tspan x="300" y="105">L</tspan><tspan x="305" y="105">U</tspan><tspan x="311" y="105">X NORBA</tspan></text>
      <text><tspan x="500" y="95">SAO</tspan><tspan x="500" y="109">PAULO</tspan></text>
    </g>
  </svg>`;
const cityNames = () =>
  parseCitySvg(ILLUSTRATOR_SVG)
    .points.sort((a, b) => a.svgX - b.svgX)
    .map((p) => p.name);

/** x' = 2x + 100, y' = -2y + 50, matched by province name. */
const affine = (names: string[]) => {
  const svg = [
    { name: "Alpha", svgX: 10, svgY: 20 },
    { name: "Beta", svgX: 30, svgY: 40 },
    { name: "Gamma", svgX: 50, svgY: 10 },
  ].filter((p) => names.includes(p.name));
  const db = [
    { name: "Alpha", centroid: [120, 10] as [number, number] },
    { name: "Beta", centroid: [160, -30] as [number, number] },
    { name: "Gamma", centroid: [200, 30] as [number, number] },
  ];
  const { matrix } = deriveCityAffine(svg, db);
  return matrix && [matrix.a, matrix.d, matrix.tx, matrix.ty].map((v) => Math.round(v * 1e6) / 1e6);
};

const REGIONS: EditorFeature[] = [
  {
    id: "sub-1",
    name: "Editing",
    type: "subdivision",
    geometry: square(0, 0, 10, 10),
    properties: {},
  },
  {
    id: "sub-2",
    name: "Neighbour",
    type: "subdivision",
    geometry: square(10, 0, 20, 10),
    properties: {},
  },
  { id: "city-1", name: "City", type: "city", coordinates: [5, 5], properties: {} },
];
const editable = () => {
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  return div;
};

it.each([
  ["the border in February is January's snapshot", () => borderOn("2026-02-01"), [1, 1]],
  ["the border in March ignores May's later snapshot", () => borderOn("2026-03-15"), [1, 1]],
  [
    "smoothing keeps the ring closed",
    () => closed(smoothGeometry(square(0, 0, 1, 1), 2) as Polygon),
    true,
  ],
  [
    "naturalising with one seed gives one coast, closed and valid",
    () => {
      const a = naturalizeGeometry(square(0, 0, 1, 1), 0.01, 42) as Polygon;
      const b = naturalizeGeometry(square(0, 0, 1, 1), 0.01, 42) as Polygon;
      return [JSON.stringify(a) === JSON.stringify(b), closed(a), validateGeometry(a).valid];
    },
    [true, true, true],
  ],
  [
    "a neighbour's vertex on the shared edge is inserted into this border",
    () => {
      const result = alignSharedVertices(
        square(0, 0, 2, 2),
        ring([2, 0], [4, 0], [4, 2], [2, 1]),
        1e-7
      );
      return [result.modifiedA, getAllRings(result.geomA)[0]![2]];
    },
    [true, [2, 1]],
  ],
  [
    "tracing follows the river between the clicks",
    () => traceAlongLayer([0.5, 0], [3.5, 0], [RIVER], 0.1).map((p) => p[0]),
    [1, 2, 3],
  ],
  [
    "tracing between two different rivers gives nothing",
    () =>
      traceAlongLayer(
        [0.5, 0.01],
        [10.5, 0.01],
        [line([0, 0], [1, 0], [2, 0]), line([10, 0], [11, 0], [12, 0])],
        0.1
      ),
    [],
  ],
  [
    "provinces cover a concave country",
    () => coverage(L_SHAPE, 5) >= 0.95 && coverage(L_SHAPE, 5) <= 1.01,
    true,
  ],
  [
    "a brush stroke over the border moves territory and conserves the total",
    () =>
      brushed(
        [
          [-0.1, 0.2],
          [-0.1, 0.8],
        ],
        20
      ),
    { moved: true, conserved: true },
  ],
  [
    "a brush stroke that misses the source changes nothing",
    () =>
      brushed(
        [
          [0.7, 0.3],
          [0.7, 0.7],
        ],
        5
      ),
    null,
  ],
  [
    "an Illustrator SVG names its dots, kerning fragments joined and a line break one space",
    cityNames,
    ["CHRYSONUM", "LUX NORBA", "SAO PAULO"],
  ],
  [
    "three matched provinces recover the map's transform",
    () => affine(["Alpha", "Beta", "Gamma"]),
    [2, -2, 100, 50],
  ],
  ["two matched provinces are too few to align", () => affine(["Alpha", "Beta"]), null],
  [
    "a route's difficulty is its climb: 5,000 m of ascent is 1",
    () => normalizeTerrainDifficulty([0, 2500, 5000]),
    1,
  ],
  [
    "a region edit snaps to the other regions only",
    () => buildNeighborGeometries(REGIONS, "sub-1").map((n) => n.id),
    ["sub-2"],
  ],
  [
    "an editor shortcut never fires while the user types, and does on the map",
    () =>
      [
        document.createElement("input"),
        document.createElement("textarea"),
        editable(),
        document.createElement("canvas"),
      ].map(isKeyboardInputTarget),
    [true, true, true, false],
  ],
] as const)("%s", (_behaviour, actual, expected) => {
  expect(actual()).toEqual(expected);
});
