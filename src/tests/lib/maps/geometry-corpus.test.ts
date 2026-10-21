/** @jest-environment node */
/**
 * A corpus of realistic map shapes, and what the map's geometry helpers must make of them: areas (with lakes, islands
 * and a realm's own planet radius), the antimeridian (cut, measured and outlined without its seam) and the poles.
 * Wyoming and Colorado are the real states (latitude/longitude boxes, so their area on a sphere has a closed form);
 * the others are boxes placed where the hard cases are: a lake, an archipelago, Fiji's antimeridian, Antarctica.
 */
import type { Geometry, MultiLineString, MultiPolygon, Polygon, Position } from "geojson";
import {
  buildMeasureFeatures,
  formatArea,
  measurePerimeterKm,
} from "~/components/maps/core/utils/measure-helpers";
import { calculateApproxArea } from "~/lib/flags/svg/topology-flattener";
import { calculateArea } from "~/lib/maps/border-editor";
import { polygonMetrics } from "~/lib/maps/feature-metrics";
import { fitToSeam, passesSeam } from "~/lib/maps/import/world-seam";
import { EARTH_RADIUS_KM, polygonalAreaSqKm, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { parseProvinceSvg } from "~/lib/maps/province-importer/parse-provinces";
import { assembleRings, signedRingArea } from "~/lib/maps/ring-assembly";
import { seamlessOutline } from "~/lib/maps/seam-outline";
import { computeApproxAreaForFeature } from "~/server/modules/maps/layer-geometry";

type Coord = [number, number];
const R = EARTH_RADIUS_KM;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** A closed latitude/longitude box, counter-clockwise unless `cw`. */
const box = (w: number, s: number, e: number, n: number, cw = false): Position[] => {
  const ring: Position[] = [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
  return cw ? ring.reverse() : ring;
};
/** The area of a latitude/longitude box on a sphere of radius `r`. */
const boxSqKm = (w: number, s: number, e: number, n: number, r = R) =>
  r * r * rad(e - w) * (Math.sin(rad(n)) - Math.sin(rad(s)));
/** The cap poleward of latitude `lat`. */
const capSqKm = (lat: number) => 2 * Math.PI * R * R * (1 - Math.sin(rad(Math.abs(lat))));
/** A ring of vertices every `step` degrees of longitude along latitude `lat`, eastward. */
const parallel = (lat: number, step = 1): Coord[] =>
  Array.from({ length: 360 / step }, (_, i) => [-180 + i * step, lat]);
const SPHERE = 4 * Math.PI * R * R;

const CORPUS: Array<{ name: string; geometry: Polygon | MultiPolygon; sqKm: number }> = [
  {
    name: "Wyoming",
    geometry: { type: "Polygon", coordinates: [box(-111.05, 41, -104.05, 45)] },
    sqKm: boxSqKm(-111.05, 41, -104.05, 45),
  },
  {
    name: "Colorado",
    geometry: { type: "Polygon", coordinates: [box(-109.05, 37, -102.05, 41)] },
    sqKm: boxSqKm(-109.05, 37, -102.05, 41),
  },
  {
    name: "a nation with a lake",
    geometry: { type: "Polygon", coordinates: [box(30, -1, 35, 4), box(32, 0, 33, 1, true)] },
    sqKm: boxSqKm(30, -1, 35, 4) - boxSqKm(32, 0, 33, 1),
  },
  {
    name: "an archipelago: the lake nation and an island",
    geometry: {
      type: "MultiPolygon",
      coordinates: [[box(30, -1, 35, 4), box(32, 0, 33, 1, true)], [box(37, 0, 38, 1)]],
    },
    sqKm: boxSqKm(30, -1, 35, 4) - boxSqKm(32, 0, 33, 1) + boxSqKm(37, 0, 38, 1),
  },
];

const FLAT_HELPERS: Array<[string, (g: Polygon | MultiPolygon) => number]> = [
  ["planet polygonalAreaSqKm", (g) => polygonalAreaSqKm(g)],
  ["border editor calculateArea", (g) => calculateArea(g)],
  ["feature metrics", (g) => polygonMetrics(g)!.areaSqKm],
  ["layer loader computeApproxAreaForFeature", (g) => computeApproxAreaForFeature(g)],
  [
    "flag flattener calculateApproxArea",
    (g) => calculateApproxArea(g.type === "Polygon" ? g.coordinates : g.coordinates.flat()),
  ],
];

describe("areas", () => {
  it.each(CORPUS.flatMap((c) => FLAT_HELPERS.map(([helper, area]) => ({ ...c, helper, area }))))(
    "$helper measures $name within 1.5%, lakes taken out and islands added",
    ({ geometry, sqKm, area }) => {
      expect(Math.abs(area(geometry) / sqKm - 1)).toBeLessThan(0.015);
    }
  );

  it("measures a ring on a sphere exactly, whichever way it winds, closed or not, and on a realm's own radius", () => {
    const wyoming = box(-111.05, 41, -104.05, 45).slice(0, 4) as Coord[];
    const exact = boxSqKm(-111.05, 41, -104.05, 45);
    expect(Math.abs(sphericalRingAreaSqKm(wyoming) / exact - 1)).toBeLessThan(0.001);
    expect(sphericalRingAreaSqKm([...wyoming].reverse())).toBeCloseTo(
      sphericalRingAreaSqKm(wyoming),
      3
    );
    expect(sphericalRingAreaSqKm([...wyoming, wyoming[0]!])).toBeCloseTo(
      sphericalRingAreaSqKm(wyoming),
      3
    );
    expect(sphericalRingAreaSqKm(wyoming, R / 2)).toBeCloseTo(
      sphericalRingAreaSqKm(wyoming) / 4,
      3
    );
    expect(polygonalAreaSqKm(CORPUS[0]!.geometry, R * 2)).toBeCloseTo(
      polygonalAreaSqKm(CORPUS[0]!.geometry) * 4,
      3
    );
    expect(sphericalRingAreaSqKm(wyoming.slice(0, 2))).toBe(0);
    expect(polygonalAreaSqKm({ type: "Point", coordinates: [0, 0] })).toBe(0);
    expect(polygonMetrics(null)).toBeNull();
    // the stored bounding box spans every part
    expect(polygonMetrics(CORPUS[0]!.geometry)!.boundingBox).toEqual([-111.05, 41, -104.05, 45]);
    expect(polygonMetrics(CORPUS[3]!.geometry)!.boundingBox).toEqual([30, -1, 38, 4]);
  });

  it("closes an open ring before measuring it", () => {
    const open: Polygon = {
      type: "Polygon",
      coordinates: [box(-111.05, 41, -104.05, 45).slice(0, -1)],
    };
    expect(computeApproxAreaForFeature(open)).toBe(
      computeApproxAreaForFeature(CORPUS[0]!.geometry)
    );
  });
});

describe("the antimeridian", () => {
  /** Fiji's box, 177°E to 178°W: as the generator writes it (past 180) and as the map stores it (wrapped). */
  const FIJI: Coord[] = [
    [177, -19],
    [182, -19],
    [182, -16],
    [177, -16],
  ];
  const wrapped = FIJI.map(([x, y]): Coord => [x > 180 ? x - 360 : x, y]);

  it("measures Fiji across the seam as the same box away from it, and the measure tool draws it unbroken", () => {
    const away: Coord[] = FIJI.map(([x, y]) => [x - 177, y]);
    expect(sphericalRingAreaSqKm(wrapped)).toBeCloseTo(sphericalRingAreaSqKm(away), 3);
    const fill = buildMeasureFeatures(wrapped, undefined, "area").find(
      (f) => f.properties?.kind === "area"
    );
    const ring = (fill!.geometry as Polygon).coordinates[0]!;
    for (let i = 1; i < ring.length; i++)
      expect(Math.abs(ring[i]![0]! - ring[i - 1]![0]!)).toBeLessThan(180);
  });

  /** Every longitude of a geometry. */
  const lngs = (geometry: Geometry): number[] =>
    JSON.stringify("coordinates" in geometry ? geometry.coordinates : [])
      .match(/\[(-?[\d.e+-]+),/g)!
      .map((m) => Number(m.slice(1, -1)));
  const line = (...coordinates: Coord[]) => ({ type: "LineString" as const, coordinates });
  const polygon = (...rings: Position[][]): Polygon => ({ type: "Polygon", coordinates: rings });

  it.each([
    [
      "a river east past 180",
      line([170, 10], [190, 20], [200, 20]),
      [
        [
          [170, 10],
          [180, 15],
        ],
        [
          [-180, 15],
          [-170, 20],
          [-160, 20],
        ],
      ],
    ],
    [
      "a river west past -180, as far as the generator's -203",
      line([-170, 0], [-190, 10], [-203, 10]),
      [
        [
          [-170, 0],
          [-180, 5],
        ],
        [
          [180, 5],
          [170, 10],
          [157, 10],
        ],
      ],
    ],
  ])("cuts %s at the seam and shifts the far part in", (_name, river, parts) => {
    expect(passesSeam(river)).toBe(true);
    expect((fitToSeam(river) as MultiLineString).coordinates).toEqual(parts);
  });

  it("cuts shapes that cross into parts inside ±180, and leaves the rest alone", () => {
    const inside = line([170, 10], [180, 12], [-180, 12], [-170, 14]);
    expect(fitToSeam(inside)).toBe(inside);
    // across and back: three parts; a far side that is only a point: nothing
    expect(
      (fitToSeam(line([170, 0], [190, 0], [170, 4])) as MultiLineString).coordinates
    ).toHaveLength(3);
    expect(
      fitToSeam({
        type: "MultiLineString",
        coordinates: [
          [
            [185, 0],
            [185, 0],
          ],
        ],
      })
    ).toBeNull();
    // Fiji split into the part either side, its lake with the part it falls in
    const fiji = fitToSeam(
      polygon(box(170, 0, 200, 30), box(175, 10, 176, 12, true))
    ) as MultiPolygon;
    expect(fiji.coordinates.map((rings) => rings.length - 1).sort()).toEqual([0, 1]);
    const [west, east] = fiji.coordinates.map((rings) => rings[0]!.map(([x]) => x!));
    expect([
      Math.min(...west!),
      Math.max(...west!),
      Math.min(...east!),
      Math.max(...east!),
    ]).toEqual([170, 180, -180, -160]);
    // an island wholly past -180 is shifted back in
    expect(new Set(lngs(fitToSeam(polygon(box(-203, 10, -190, 20)))!))).toEqual(
      new Set([157, 170])
    );
  });

  it("cuts a ring of 200,000 positions without running out of stack", () => {
    const n = 200_000;
    const ring: Position[] = Array.from({ length: n }, (_, i) => [
      180 + 10 * Math.cos((i / n) * 2 * Math.PI),
      10 * Math.sin((i / n) * 2 * Math.PI),
    ]);
    ring.push(ring[0]!);
    const fitted = fitToSeam(polygon(ring)) as MultiPolygon;
    expect(fitted.coordinates).toHaveLength(2);
    expect(lngs(fitted).every((x) => Math.abs(x) <= 180)).toBe(true);
  });

  it("outlines a nation on the seam without the seam itself, which the globe would draw across the land", () => {
    const outline = (rings: Position[][]) =>
      seamlessOutline({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { name: "A" }, geometry: polygon(...rings) }],
      }).features[0]!;
    expect(outline([box(0, 0, 10, 10)]).geometry.coordinates).toEqual([box(0, 0, 10, 10)]);
    expect(outline([box(0, 0, 10, 10)]).properties).toEqual({ name: "A" });
    expect(outline([box(170, 0, 180, 10)]).geometry.coordinates).toEqual([
      [
        [170, 0],
        [180, 0],
      ],
      [
        [180, 10],
        [170, 10],
        [170, 0],
      ],
    ]);
    expect(outline([box(-180, 0, -170, 10)]).geometry.coordinates).toEqual([
      [
        [-180, 0],
        [-170, 0],
        [-170, 10],
        [-180, 10],
      ],
    ]);
    // a vertex within a thousandth of a degree of the seam is on it
    expect(
      outline([
        [
          [179.9995, 0],
          [179.9999, 5],
          [175, 5],
          [179.9995, 0],
        ],
      ]).geometry.coordinates
    ).toEqual([
      [
        [179.9999, 5],
        [175, 5],
        [179.9995, 0],
      ],
    ]);
    // every hole and part of a MultiPolygon is outlined, and other geometry left out
    const archipelago = seamlessOutline({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: CORPUS[3]!.geometry },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
      ],
    });
    expect(archipelago.features).toHaveLength(1);
    expect(archipelago.features[0]!.geometry.coordinates).toHaveLength(3);
  });
});

describe("the poles", () => {
  it("measures a ring around a pole as the cap it encloses, the smaller side of any ring", () => {
    for (const lat of [80, -80, -60]) {
      const area = sphericalRingAreaSqKm(parallel(lat));
      expect(Math.abs(area / capSqKm(lat) - 1)).toBeLessThan(0.01);
      expect(sphericalRingAreaSqKm(parallel(lat).reverse())).toBeCloseTo(area, 3);
    }
    expect(sphericalRingAreaSqKm(parallel(-1))).toBeLessThanOrEqual(SPHERE / 2);
    // a band ±40° round all but 10° of longitude is more than half the sphere: the rest is measured
    const north = Array.from({ length: 351 }, (_, i): Coord => [i, 40]);
    const band = [...north, ...north.map(([lng]): Coord => [lng, -40]).reverse()];
    const bandSqKm = (350 / 360) * SPHERE * Math.sin(rad(40));
    expect(Math.abs(sphericalRingAreaSqKm(band) / (SPHERE - bandSqKm) - 1)).toBeLessThan(0.01);
  });

  it("fills Antarctica through the pole it encloses, labelled with the realm-scaled area and its perimeter", () => {
    const fill = (ring: Coord[]) =>
      (
        buildMeasureFeatures(ring, undefined, "area").find((f) => f.properties?.kind === "area")!
          .geometry as Polygon
      ).coordinates[0]!;
    expect(fill(parallel(-80, 30)).some((p) => p[1] === -90)).toBe(true);
    expect(fill(parallel(80, 30)).some((p) => p[1] === 90)).toBe(true);
    const octant: Coord[] = [
      [0, 0],
      [90, 0],
      [0, 90],
    ];
    const features = buildMeasureFeatures(octant, R / 2, "area");
    expect(
      features.filter((f) => f.properties?.kind === "label").map((f) => f.properties?.text)
    ).toEqual([formatArea(sphericalRingAreaSqKm(octant, R / 2))]);
    expect(measurePerimeterKm(octant)).toBeCloseTo((3 * Math.PI * R) / 2, 3);
    expect(
      buildMeasureFeatures(octant.slice(0, 2), undefined, "area").some(
        (f) => f.properties?.kind === "area"
      )
    ).toBe(false);
  });
});

describe("rings to nations", () => {
  const NATION = box(0, 0, 10, 10);
  const LAKE = box(3, 3, 7, 7);
  const ISLAND = box(20, 0, 25, 5);
  /** Each polygon as its rings' lower-left corners, outer first. */
  const corners = (geometry: Polygon | MultiPolygon) =>
    (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).map((p) =>
      p.map((ring) => [Math.min(...ring.map((q) => q[0]!)), Math.min(...ring.map((q) => q[1]!))])
    );
  /** Outer rings counter-clockwise and holes clockwise (RFC 7946). */
  const rfc7946 = (geometry: Polygon | MultiPolygon) =>
    (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).every(
      ([outer, ...holes]) => signedRingArea(outer!) > 0 && holes.every((h) => signedRingArea(h) < 0)
    );

  it.each([
    [
      "outer CCW, lake CW, island CCW",
      [NATION, box(3, 3, 7, 7, true), ISLAND],
      [
        [
          [0, 0],
          [3, 3],
        ],
        [[20, 0]],
      ],
    ],
    [
      "every ring wound the same way, the lake first",
      [LAKE, ISLAND, NATION],
      [
        [
          [0, 0],
          [3, 3],
        ],
        [[20, 0]],
      ],
    ],
    [
      "an island in the lake",
      [NATION, LAKE, box(4, 4, 6, 6)],
      [
        [
          [0, 0],
          [3, 3],
        ],
        [[4, 4]],
      ],
    ],
    [
      "a lake touching the shore at a corner",
      [NATION, box(0, 0, 4, 4)],
      [
        [
          [0, 0],
          [0, 0],
        ],
      ],
    ],
    [
      "two islands with their own lakes",
      [
        box(0, 0, 10, 10),
        box(20, 0, 30, 10),
        box(2, 2, 4, 4),
        box(22, 2, 24, 4),
        box(26, 6, 28, 8),
      ],
      [
        [
          [0, 0],
          [2, 2],
        ],
        [
          [20, 0],
          [22, 2],
          [26, 6],
        ],
      ],
    ],
  ])(
    "assembles %s: lakes are holes, islands polygons, wound as RFC 7946 asks",
    (_name, rings, expected) => {
      const geometry = assembleRings(rings);
      expect(corners(geometry).sort()).toEqual([...expected].sort());
      expect(rfc7946(geometry)).toBe(true);
    }
  );

  it("follows the nonzero fill rule when asked, as a browser draws an SVG, and closes open rings", () => {
    expect(corners(assembleRings([NATION, box(3, 3, 7, 7, true)], "nonzero"))).toEqual([
      [
        [0, 0],
        [3, 3],
      ],
    ]);
    expect(assembleRings([NATION, LAKE], "nonzero")).toEqual({
      type: "Polygon",
      coordinates: [NATION],
    });
    expect((assembleRings([NATION.slice(0, -1)]) as Polygon).coordinates[0]).toHaveLength(5);
  });

  it("imports a province's lake as a hole by containment, never one shape of a merged group as another's hole", () => {
    const svg = (body: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g id="provinces">${body}</g></svg>`;
    // 8-vertex outlines: the importer drops shapes under 8 points as markers
    const outline = "M 10 10 L 60 10 L 110 10 L 110 60 L 110 110 L 60 110 L 10 110 L 10 60 Z";
    const lakeSameWay = "M 40 40 L 60 40 L 80 40 L 80 60 L 80 80 L 60 80 L 40 80 L 40 60 Z";
    const [lakeshire] = parseProvinceSvg(
      svg(`<path id="Lakeshire" fill="#ff0000" d="${outline} ${lakeSameWay}"/>`)
    ).provinces;
    const rings = (lakeshire!.geometry as Polygon).coordinates;
    expect(rings).toHaveLength(2);
    expect(Math.sign(signedRingArea(rings[0]!))).toBe(-Math.sign(signedRingArea(rings[1]!)));
    const [twins] = parseProvinceSvg(
      svg(
        `<g id="Twin_Isles"><path fill="#00ff00" d="${outline}"/><path fill="#00ff00" d="${lakeSameWay}"/></g>`
      )
    ).provinces;
    expect((twins!.geometry as MultiPolygon).coordinates.map((p) => p.length)).toEqual([1, 1]);
  });
});
