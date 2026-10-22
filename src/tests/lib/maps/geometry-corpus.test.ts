/** @jest-environment node */
/**
 * A corpus of realistic map shapes, and what the map's geometry helpers must make of them: areas (with lakes, islands
 * and a realm's own planet radius), the antimeridian (cut, measured and outlined without its seam) and the poles;
 * rings assembled into nations; geometry checked and repaired before it is stored; borders simplified, smoothed and
 * packed for the wire without breaking; and realm map art cut into Web Mercator raster tiles.
 * Wyoming is the real state (a latitude/longitude box, so its area on a sphere has a closed form); the others are
 * boxes placed where the hard cases are: a lake, an archipelago, Fiji's antimeridian, Antarctica.
 * Folds: src/tests/lib/maps/geojson-compress.test.ts, src/tests/lib/maps/geojson-pack.test.ts,
 * src/tests/lib/maps/topology-smooth.test.ts, src/tests/lib/maps/raster-tiles.test.ts,
 * src/tests/lib/geo-validation.test.ts
 */
import type { PrismaClient } from "@prisma/client";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import {
  buildMeasureFeatures,
  formatArea,
  measurePerimeterKm,
} from "~/components/maps/core/utils/measure-helpers";
import { calculateApproxArea } from "~/lib/flags/svg/topology-flattener";
import { calculateArea } from "~/lib/maps/border-editor";
import { polygonMetrics } from "~/lib/maps/feature-metrics";
import {
  repairGeometryGeoJSON,
  resetPostGISCache,
  validateGeometryStructure,
} from "~/lib/maps/geo-validation";
import { compressFeatureCollection } from "~/lib/maps/geojson-compress";
import { packFeatureCollection, unpackLayers } from "~/lib/maps/geojson-pack";
import { fitToSeam, passesSeam } from "~/lib/maps/import/world-seam";
import { EARTH_RADIUS_KM, polygonalAreaSqKm, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { parseProvinceSvg } from "~/lib/maps/province-importer/parse-provinces";
import {
  isRasterTileCoord,
  mercatorLatitude,
  rasterLegendPath,
  rasterTilePath,
  remapRows,
  tileSourceRows,
} from "~/lib/maps/raster-tiles";
import { assembleRings, signedRingArea } from "~/lib/maps/ring-assembly";
import { seamlessOutline } from "~/lib/maps/seam-outline";
import { smoothTopology } from "~/lib/maps/topology-smooth";
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
    expect(polygonMetrics(CORPUS[2]!.geometry)!.boundingBox).toEqual([30, -1, 38, 4]);
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
        { type: "Feature", properties: {}, geometry: CORPUS[2]!.geometry },
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

describe("geometry checked and repaired before it is stored", () => {
  const ring = (...points: Coord[]): Polygon => ({ type: "Polygon", coordinates: [points] });

  it.each([
    ["an open ring", ring([0, 0], [1, 0], [1, 1], [0, 1]), "ring_not_closed"],
    ["a ring of three positions", ring([0, 0], [1, 0], [0, 1]), "too_few_vertices"],
  ])("refuses %s", (_name, geometry, type) => {
    expect(validateGeometryStructure(geometry).map((e) => e.type)).toEqual([type]);
  });

  /** A border drawn as a bowtie, and the two triangles PostGIS's ST_MakeValid makes of it. */
  const BOWTIE = ring([0, 0], [2, 2], [2, 0], [0, 2], [0, 0]);
  const REPAIRED: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [1, 1],
          [0, 2],
          [0, 0],
        ],
      ],
      [
        [
          [1, 1],
          [2, 2],
          [2, 0],
          [1, 1],
        ],
      ],
    ],
  };
  /** A database with PostGIS whose repair query answers with `repair`, and its query mock. */
  const postgis = (repair: () => Promise<unknown>) => {
    const query = jest.fn(async (sql: string) =>
      sql.includes("PostGIS_Version") ? [{ version: "3.4" }] : repair()
    );
    return { db: { $queryRawUnsafe: query } as unknown as PrismaClient, query };
  };

  beforeEach(() => {
    resetPostGISCache();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("stores PostGIS's repair of a self-intersecting border", async () => {
    const { db } = postgis(async () => [{ repaired: JSON.stringify(REPAIRED) }]);
    expect(await repairGeometryGeoJSON(db, BOWTIE)).toEqual(REPAIRED);
  });

  it("stores the border as drawn when the repair query fails, rather than failing the write", async () => {
    const { db, query } = postgis(async () => {
      throw new Error("Query failed");
    });
    expect(await repairGeometryGeoJSON(db, BOWTIE)).toBe(BOWTIE);
    // PostGIS was there: the repair was tried and its failure absorbed
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("borders on the wire", () => {
  /** A closed ring of `n` points on a circle: dense enough that any tolerance above 0.001 removes some. */
  const circle = (n: number): Position[] => [
    ...Array.from({ length: n }, (_, i): Position => [
      Math.cos((2 * Math.PI * i) / n),
      Math.sin((2 * Math.PI * i) / n),
    ]),
    [1, 0],
  ];

  it("simplifies a nation whose lake is degenerate rather than keeping it whole (regression)", () => {
    // three collinear points: a hole with no area, which turf's cleanCoords rejects
    const sliver: Position[] = [
      [0.5, 0.5],
      [0.6, 0.6],
      [0.7, 0.7],
      [0.5, 0.5],
    ];
    const outer = circle(360);
    const nation: Feature = {
      type: "Feature",
      properties: { name: "x" },
      geometry: { type: "Polygon", coordinates: [outer, sliver] },
    };
    const out = compressFeatureCollection(
      { type: "FeatureCollection", features: [nation] },
      { simplifyTolerance: 0.05, coordinatePrecision: 4 }
    );
    const [simplified, hole] = (out.features[0]!.geometry as Polygon).coordinates;
    expect(simplified!.length).toBeLessThan(outer.length / 4);
    expect(hole).toEqual(sliver);
  });

  it("packs every geometry type and back at its precision, without drifting along a long line", () => {
    const layer: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { _id: "fiji" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [-179.9871, 12.5],
                  [-179.5, 12.75],
                  [-179.5, 13.0001],
                  [-179.9871, 12.5],
                ],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { _id: "river" },
          geometry: {
            type: "LineString",
            coordinates: [
              [10.12, -5.5],
              [10.13, -5.49],
            ],
          },
        },
        {
          type: "Feature",
          properties: { _id: "capital" },
          geometry: { type: "Point", coordinates: [1.23456, 2.34567] },
        },
        { type: "Feature", properties: { _id: "unplaced" }, geometry: null as never },
      ],
    };
    expect(unpackLayers({ political: packFeatureCollection(layer, 4) }).political).toEqual(layer);
    const long: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: Array.from({ length: 50 }, (_, i) => [i * 0.00449, 0]),
          },
        },
      ],
    };
    const unpacked = unpackLayers({ rivers: packFeatureCollection(long, 2) }).rivers!;
    const coordinates = (unpacked.features[0]!.geometry as { coordinates: Position[] }).coordinates;
    expect(coordinates[49]![0]).toBeCloseTo(0.22, 10);
  });

  it("smooths a shared border once, so neighbours still meet exactly at their junctions", () => {
    const topoServer = require("topojson-server") as {
      topology: (objects: Record<string, FeatureCollection>) => {
        arcs: number[][][];
        objects: Record<string, unknown>;
      };
    };
    const topoClient = require("topojson-client") as {
      feature: (topology: unknown, object: unknown) => { features: Array<Feature<Polygon>> };
    };
    const square = (x: number): Feature<Polygon> => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [box(x, 0, x + 4, 4)] },
    });
    const topology = topoServer.topology({
      regions: { type: "FeatureCollection", features: [square(0), square(4)] },
    });
    const smoothed = smoothTopology(topology, { iterations: 2 });
    const [a, b] = topoClient.feature(smoothed, smoothed.objects.regions).features;
    const ringA = a!.geometry.coordinates[0]!;
    const ringB = b!.geometry.coordinates[0]!;
    const shared = ringA.filter((p) => ringB.some((q) => q[0] === p[0] && q[1] === p[1]));
    // The shared edge x = 4 is a straight arc between two junctions: unchanged, both ends kept.
    expect(shared).toEqual(expect.arrayContaining([[4, 0]]));
    expect(shared).toEqual(expect.arrayContaining([[4, 4]]));
    // Outer corners are cut.
    expect(ringA).not.toContainEqual([0, 0]);
    expect(ringB).not.toContainEqual([8, 4]);
  });
});

describe("realm map art as Web Mercator raster tiles", () => {
  it("shows each tile row the image row Web Mercator puts it at: high latitudes repeat image rows, never skip one", () => {
    // z1: the tile rows meet at the equator; z2: row 1 starts at 66.513°N
    expect(mercatorLatitude(256, 512)).toBeCloseTo(0, 9);
    expect(mercatorLatitude(256, 1024)).toBeCloseTo(66.51326, 4);
    // an image of the zoom's equatorial resolution: 256·2^z wide, half as tall
    const height = 4096;
    for (let ty = 0; ty < 32; ty++) {
      const rows = tileSourceRows(5, ty, height);
      for (let r = 1; r < 256; r++) expect(rows[r]! - rows[r - 1]!).toBeLessThanOrEqual(1.0001);
    }
    // At 70°N a Mercator row covers about a third of an image row
    const y70 = (256 * 32 * (1 - Math.log(Math.tan(Math.PI / 4 + rad(70) / 2)) / Math.PI)) / 2;
    const ty = Math.floor(y70 / 256);
    const r = Math.floor(y70 - ty * 256);
    const rows = tileSourceRows(5, ty, height);
    expect(rows[r + 1]! - rows[r]!).toBeCloseTo(Math.cos(rad(70)), 2);
  });

  it("weights colour by opacity, so a transparent sea's colour never bleeds into the coast", () => {
    const src = { width: 1, height: 2, data: Uint8Array.from([28, 28, 28, 0, 200, 0, 0, 128]) };
    expect([...remapRows(src, Float64Array.from([0.5]))]).toEqual([200, 0, 0, 64]);
    expect([...remapRows(src, Float64Array.from([0]))]).toEqual([0, 0, 0, 0]);
  });

  it("serves only tile coordinates inside the layer's pyramid", () => {
    expect(isRasterTileCoord(0, 0, 0)).toBe(true);
    expect(isRasterTileCoord(5, 31, 31)).toBe(true);
    expect(isRasterTileCoord(5, 32, 0)).toBe(false);
    expect(isRasterTileCoord(9, 0, 0)).toBe(false);
    expect(isRasterTileCoord(-1, 0, 0)).toBe(false);
    expect(isRasterTileCoord(1.5, 0, 0)).toBe(false);
  });

  it("names the realm (encoded) and the layer's version in every URL, so a rebuilt image is never served stale", () => {
    const layer = { id: "geography", version: "abc12345" };
    expect(rasterTilePath("r 1/..", layer)).toBe(
      "/api/map-rasters/r%201%2F../geography/abc12345/{z}/{x}/{y}"
    );
    expect(rasterLegendPath("r1", layer)).toBe("/api/map-rasters/r1/geography/abc12345/legend");
  });
});
