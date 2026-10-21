/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("fs/promises", () => ({ readFile: jest.fn().mockRejectedValue(new Error("ENOENT")) }));

import type { Geometry, Polygon, Position } from "geojson";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { loadLayerFromDB } from "~/server/modules/maps/layer-loader";

function circle(cx: number, cy: number, radius: number, n: number): Position[] {
  const ring: Position[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    ring.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  ring.push([...ring[0]!]);
  return ring;
}

const SLIVER: Position[] = [
  [5, 5],
  [6, 6],
  [7, 7],
  [5, 5],
];

const square = (x: number, y: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

const row = (featureId: string, geometry: Geometry) => ({
  featureId,
  geometry,
  properties: { fill: "#336699" },
  displayName: featureId,
  countryId: null,
  areaSqKm: 1,
  centroid: null,
  country: null,
});

/**
 * A database holding `rows` as the realm's layer. The first `$queryRaw` is the pg_proc probe, the second the
 * coverage query, which answers `coverage` (featureId to geometry).
 */
function dbWith(
  rows: unknown[],
  options: { probe?: boolean; coverage?: Record<string, Geometry> } = {}
) {
  const { probe = true, coverage = {} } = options;
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const $queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push({ sql: strings.join("?"), values });
    if (queries.length % 2 === 1) return Promise.resolve([{ exists: probe }]);
    return Promise.resolve(
      Object.entries(coverage).map(([featureId, geometry]) => ({
        featureId,
        geometry: JSON.stringify(geometry),
      }))
    );
  });
  const findMany = jest.fn().mockResolvedValue(rows);
  const db = {
    mapLayer: { findMany },
    countrySovereignty: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw,
  };
  return { db, findMany, queries, $queryRaw };
}

const pointsOf = (g: Geometry) => (g.type === "Polygon" ? g.coordinates[0]!.length : -1);

beforeEach(() => {
  clearLayerCache();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("layer loader simplification", () => {
  it("simplifies each polygon with turf when the function is missing, ring by ring where one is degenerate", async () => {
    const dense = circle(0, 0, 1, 360);
    const { db } = dbWith(
      [
        row("Alpha", { type: "Polygon", coordinates: [dense] }),
        // turf rejects the whole feature for the sliver hole
        row("Beta", { type: "Polygon", coordinates: [circle(20, 20, 1, 360), SLIVER] }),
      ],
      { probe: false }
    );

    const fc = await loadLayerFromDB(db, "political", 0, "default");
    const [alpha, beta] = fc!.features;

    expect(pointsOf(alpha!.geometry)).toBeLessThan(dense.length / 4);
    expect(pointsOf(beta!.geometry)).toBeLessThan(dense.length / 4);
    expect((beta!.geometry as Polygon).coordinates[1]).toEqual(SLIVER);
  });

  it("simplifies the features the coverage does not hold from their stored GeoJSON", async () => {
    const dense = circle(0, 0, 1, 360);
    const { db } = dbWith(
      [
        row("Alpha", { type: "Polygon", coordinates: [dense] }),
        row("Beta", { type: "Polygon", coordinates: [circle(20, 20, 1, 360)] }),
      ],
      { coverage: { Alpha: square(0, 0) } }
    );

    const fc = await loadLayerFromDB(db, "political", 0, "default");
    const [alpha, beta] = fc!.features;

    expect(pointsOf(alpha!.geometry)).toBe(5);
    expect(pointsOf(beta!.geometry)).toBeLessThan(dense.length / 4);
    expect(pointsOf(beta!.geometry)).toBeGreaterThan(5);
  });

  it("keeps a feature crossing the antimeridian: simplified from its GeoJSON, then split at 180", async () => {
    // stored with longitudes jumping 175 -> -175, so its geom_postgis is a planar sliver the coverage leaves out
    const crossing: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [175, -5],
          [-175, -5],
          [-175, 5],
          [175, 5],
          [175, -5],
        ],
      ],
    };
    const { db } = dbWith(
      [
        row("Wide", crossing),
        row("Alpha", { type: "Polygon", coordinates: [circle(0, 0, 1, 360)] }),
      ],
      { coverage: { Alpha: square(0, 0) } }
    );

    const fc = await loadLayerFromDB(db, "political", 0, "default");
    const wideParts = fc!.features.filter((f) => f.properties?._id === "Wide");

    expect(wideParts).toHaveLength(2);
    const lngs = wideParts.map((f) => (f.geometry as Polygon).coordinates[0]!.map((p) => p[0]!));
    expect(Math.max(...lngs.flat())).toBe(180);
    expect(Math.min(...lngs.flat())).toBe(-180);
    for (const part of lngs) expect(part.length).toBeGreaterThanOrEqual(4);
  });
});

describe("layer loader cache", () => {
  it("builds once per map version, and builds again for a new version", async () => {
    const { db, findMany } = dbWith([row("Alpha", square(0, 0))], { probe: false });

    await loadLayerFromDB(db, "political", 1, "default", 3);
    await loadLayerFromDB(db, "political", 1, "default", 3);
    expect(findMany).toHaveBeenCalledTimes(1);

    await loadLayerFromDB(db, "political", 1, "default", 4);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("keeps a version-less read (the editor's source) apart from the versioned ones", async () => {
    const { db, findMany } = dbWith([row("Alpha", square(0, 0))], { probe: false });

    await loadLayerFromDB(db, "political", 1, "default", 3);
    await loadLayerFromDB(db, "political", 1, "default");
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
