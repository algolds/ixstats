import type { MultiPolygon, Polygon, Position } from "geojson";
import { assembleRings, signedRingArea } from "~/lib/maps/ring-assembly";
import { polygonalAreaSqKm, ringAreaSqKm } from "~/lib/maps/planet";

/** A closed axis-aligned square, counter-clockwise (y up) unless `cw`. */
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

/** Each polygon as its rings' lower-left corners, outer first. */
const corners = (geometry: Polygon | MultiPolygon) =>
  (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).map((polygon) =>
    polygon.map((ring) => [
      Math.min(...ring.map((p) => p[0]!)),
      Math.min(...ring.map((p) => p[1]!)),
    ])
  );

/** Every outer ring counter-clockwise and every hole clockwise (RFC 7946). */
function expectRfc7946(geometry: Polygon | MultiPolygon) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const [outer, ...holes] of polygons) {
    expect(signedRingArea(outer!)).toBeGreaterThan(0);
    for (const hole of holes) expect(signedRingArea(hole)).toBeLessThan(0);
  }
}

const NATION = square(0, 0, 10);
const LAKE = square(3, 3, 4);
const ISLAND = square(20, 0, 5);

describe("assembleRings — a nation with a lake and an island", () => {
  it.each([
    ["outer CCW, lake CW, island CCW", [NATION, square(3, 3, 4, true), ISLAND]],
    ["outer CW, lake CCW, island CW", [square(0, 0, 10, true), LAKE, square(20, 0, 5, true)]],
    ["every ring wound the same way", [NATION, LAKE, ISLAND]],
    ["the lake listed first", [LAKE, ISLAND, NATION]],
  ])("%s: the lake is a hole of the nation, the island its own polygon", (_name, rings) => {
    const geometry = assembleRings(rings);
    expect(geometry.type).toBe("MultiPolygon");
    expect(corners(geometry).sort()).toEqual(
      [
        [
          [0, 0],
          [3, 3],
        ],
        [[20, 0]],
      ].sort()
    );
    expectRfc7946(geometry);
  });

  it("a lone nation with a lake is one Polygon whatever its winding", () => {
    for (const rings of [
      [NATION, LAKE],
      [square(0, 0, 10, true), square(3, 3, 4, true)],
    ]) {
      const geometry = assembleRings(rings);
      expect(geometry.type).toBe("Polygon");
      expect(corners(geometry)).toEqual([
        [
          [0, 0],
          [3, 3],
        ],
      ]);
      expectRfc7946(geometry);
    }
  });

  it("an island in the lake is land again (a polygon of its own)", () => {
    const geometry = assembleRings([NATION, LAKE, square(4, 4, 2)]);
    expect(corners(geometry)).toEqual([
      [
        [0, 0],
        [3, 3],
      ],
      [[4, 4]],
    ]);
    expectRfc7946(geometry);
  });

  it("several islands each keep their own holes", () => {
    const geometry = assembleRings([
      square(0, 0, 10),
      square(20, 0, 10),
      square(2, 2, 2),
      square(22, 2, 2),
      square(26, 6, 2),
      square(40, 0, 3),
    ]);
    expect(corners(geometry)).toEqual([
      [
        [0, 0],
        [2, 2],
      ],
      [
        [20, 0],
        [22, 2],
        [26, 6],
      ],
      [[40, 0]],
    ]);
    expectRfc7946(geometry);
  });

  it("a lake touching the shore at a corner is still a hole", () => {
    const geometry = assembleRings([NATION, square(0, 0, 4)]);
    expect(corners(geometry)).toEqual([
      [
        [0, 0],
        [0, 0],
      ],
    ]);
  });

  it("closes open rings", () => {
    const open = NATION.slice(0, -1);
    const geometry = assembleRings([open]) as Polygon;
    expect(geometry.coordinates[0]).toHaveLength(5);
  });
});

describe("assembleRings — fill-rule nonzero", () => {
  it("a ring wound against its container is a hole", () => {
    const geometry = assembleRings([NATION, square(3, 3, 4, true)], "nonzero");
    expect(corners(geometry)).toEqual([
      [
        [0, 0],
        [3, 3],
      ],
    ]);
  });

  it("a ring wound like its container is filled over, as a browser draws it", () => {
    const geometry = assembleRings([NATION, LAKE], "nonzero");
    expect(geometry).toEqual({ type: "Polygon", coordinates: [NATION] });
  });
});

describe("areas subtract holes", () => {
  it("a nation's area is its outline less its lake, across its islands", () => {
    const geometry = assembleRings([NATION, LAKE, ISLAND]);
    expect(polygonalAreaSqKm(geometry)).toBeCloseTo(
      ringAreaSqKm(NATION) - ringAreaSqKm(LAKE) + ringAreaSqKm(ISLAND),
      6
    );
  });

  it("is 0 for a non-polygonal geometry", () => {
    expect(polygonalAreaSqKm({ type: "Point", coordinates: [0, 0] })).toBe(0);
    expect(polygonalAreaSqKm(null)).toBe(0);
  });
});
