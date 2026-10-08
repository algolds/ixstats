/** @jest-environment node */
import {
  storeFeatureGeometries,
  crossesAntimeridian,
  dropRepeatedPoints,
  findOverlapTrims,
  repairPolygonalGeometry,
  smoothLayerCoverage,
} from "~/lib/maps/realm-geometry-repair";
import { polygonMetrics } from "~/lib/maps/feature-metrics";

const ring = (x: number) => [
  [x, 0],
  [x + 1, 0],
  [x + 1, 1],
  [x, 1],
  [x, 0],
];
const multi = (...xs: number[]) => ({
  type: "MultiPolygon" as const,
  coordinates: xs.map((x) => [ring(x)]),
});

describe("dropRepeatedPoints", () => {
  it("drops consecutive repeats and returns a MultiPolygon", () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    expect(dropRepeatedPoints(polygon)).toEqual(multi(0));
  });

  it("drops rings that collapse, a polygon whose outer ring collapses, and returns null when nothing is left", () => {
    const collapsed = [
      [5, 5],
      [5, 5],
      [6, 5],
      [5, 5],
    ];
    const hole = [
      [0.2, 0.2],
      [0.2, 0.2],
      [0.2, 0.2],
      [0.2, 0.2],
    ];
    expect(
      dropRepeatedPoints({ type: "MultiPolygon", coordinates: [[ring(0), hole], [collapsed]] })
    ).toEqual(multi(0));
    expect(dropRepeatedPoints({ type: "Polygon", coordinates: [collapsed] })).toBeNull();
  });
});

describe("crossesAntimeridian", () => {
  it("is true for a ring jumping across ±180 and false for a wide geometry that does not", () => {
    const crossing = {
      type: "Polygon" as const,
      coordinates: [
        [
          [179, 0],
          [-179, 0],
          [-179, 1],
          [179, 1],
          [179, 0],
        ],
      ],
    };
    expect(crossesAntimeridian(crossing)).toBe(true);
    // Tagmatium on Eurth: parts from -80° to 102°, 183° wide, but no ring crosses.
    expect(crossesAntimeridian(multi(-80, 101))).toBe(false);
  });
});

describe("repairPolygonalGeometry", () => {
  it("with PostGIS makes the de-duplicated geometry valid and keeps only its polygonal parts", async () => {
    const repaired = multi(0, 3);
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ geojson: JSON.stringify(repaired) }]),
    };
    const input = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    await expect(repairPolygonalGeometry(db, input, true)).resolves.toEqual(repaired);
    const [sql, json] = db.$queryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(
      /ST_Multi\(ST_CollectionExtract\(ST_MakeValid\(ST_SetSRID\(ST_GeomFromGeoJSON\(\$1::text\), 4326\)\), 3\)\)/
    );
    expect(JSON.parse(json)).toEqual(multi(0));
  });

  it("returns null when PostGIS leaves no polygonal area", async () => {
    const db = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValue([{ geojson: '{"type":"MultiPolygon","coordinates":[]}' }]),
    };
    await expect(repairPolygonalGeometry(db, multi(0), true)).resolves.toBeNull();
  });

  it("without PostGIS, or for a ring across ±180, only drops repeated points", async () => {
    const db = { $queryRawUnsafe: jest.fn() };
    await expect(repairPolygonalGeometry(db, multi(0), false)).resolves.toEqual(multi(0));
    const crossing = {
      type: "Polygon" as const,
      coordinates: [
        [
          [179, 0],
          [-179, 0],
          [-179, 0],
          [-179, 1],
          [179, 1],
          [179, 0],
        ],
      ],
    };
    await expect(repairPolygonalGeometry(db, crossing, true)).resolves.toEqual({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [179, 0],
            [-179, 0],
            [-179, 1],
            [179, 1],
            [179, 0],
          ],
        ],
      ],
    });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("findOverlapTrims", () => {
  it("asks for the realm layer's overlaps, the smaller key keeping each strip, and parses the trimmed parts", async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: "row-b",
          key: "Salvia",
          countryId: "c-s",
          geojson: JSON.stringify(multi(2)),
          removed_km2: 12.5,
        },
      ]),
    };
    const trims = await findOverlapTrims(db, "eurth-id", { keys: ["Salvia"], areaScale: 2 });
    expect(trims).toEqual([
      { id: "row-b", key: "Salvia", countryId: "c-s", geometry: multi(2), removedKm2: 12.5 },
    ]);
    const [sql, realmId, layerType, keys, scale] = db.$queryRawUnsafe.mock.calls[0];
    expect([realmId, layerType, keys, scale]).toEqual(["eurth-id", "political", ["Salvia"], 2]);
    expect(sql).toMatch(/"worldId" = \$1 AND "layerType" = \$2/);
    expect(sql).toMatch(/b\.key COLLATE "C" < a\.key COLLATE "C"/);
    expect(sql).toMatch(/ST_Difference/);
    // Rows whose rings cross ±180 keep their planar-repaired PostGIS copy out of the comparison.
    expect(sql).toMatch(/ST_DumpSegments/);
  });

  it("drops the repeated points GeoJSON's rounding leaves in a trimmed outline", async () => {
    const rounded = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [2, 0],
            [3, 0],
            [3, 0],
            [3, 1],
            [2, 1],
            [2, 0],
          ],
        ],
      ],
    };
    const db = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValue([
          { id: "r", key: "A", countryId: null, geojson: JSON.stringify(rounded), removed_km2: 1 },
        ]),
    };
    const [trim] = await findOverlapTrims(db, "eurth-id");
    expect(trim!.geometry).toEqual(multi(2));
  });

  it("covers the whole layer when no keys are given", async () => {
    const db = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    await expect(findOverlapTrims(db, "eurth-id")).resolves.toEqual([]);
    expect(db.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(["eurth-id", "political", null, 1]);
  });
});

describe("storeFeatureGeometries", () => {
  it("stores the trimmed outline, its PostGIS copy, area, centroid and box, and the linked country's outline", async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ area: 99 }]),
      country: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const trims = [
      { id: "row-b", key: "Salvia", countryId: "c-s", geometry: multi(2), removedKm2: 1 },
      { id: "row-c", key: "Zeta", countryId: null, geometry: multi(4), removedKm2: 1 },
    ];
    await expect(storeFeatureGeometries(db, "eurth-id", trims, { areaScale: 3 })).resolves.toEqual({
      Salvia: 99,
      Zeta: 99,
    });
    const [sql, id, json, centroid, box, scale, realmId] = db.$queryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/UPDATE map_layers/);
    expect(sql).toMatch(/WHERE id = \$1 AND "worldId" = \$6/);
    expect([id, JSON.parse(json), JSON.parse(centroid), JSON.parse(box), scale, realmId]).toEqual([
      "row-b",
      multi(2),
      polygonMetrics(multi(2))!.centroid,
      [2, 0, 3, 1],
      3,
      "eurth-id",
    ]);
    expect(db.country.updateMany).toHaveBeenCalledTimes(1);
    expect(db.country.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "c-s", realmId: "eurth-id" },
      data: { geometry: multi(2), boundingBox: [2, 0, 3, 1] },
    });
  });

  it("leaves countries alone when asked to", async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ area: 5 }]),
      country: { updateMany: jest.fn() },
    };
    const trims = [{ id: "r", key: "A", countryId: "c", geometry: multi(0), removedKm2: 1 }];
    await storeFeatureGeometries(db, "eurth-id", trims, { syncCountryGeometry: false });
    expect(db.country.updateMany).not.toHaveBeenCalled();
  });
});

describe("smoothLayerCoverage", () => {
  /** Two 4° squares side by side (x 0-4 and 4-8), as the coverage query would return them. */
  const rows = [
    {
      id: "row-a",
      key: "A",
      countryId: "c-a",
      geojson: JSON.stringify(multiSquare(0)),
      before: 12,
    },
    { id: "row-b", key: "B", countryId: null, geojson: JSON.stringify(multiSquare(4)), before: 8 },
  ];
  function multiSquare(x: number) {
    return {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [x, 0],
            [x + 4, 0],
            [x + 4, 4],
            [x, 4],
            [x, 0],
          ],
        ],
      ],
    };
  }
  /** Coverage rows first; the per-feature repair returns what it was given. */
  const coverageDb = () => ({
    $queryRawUnsafe: jest.fn(async (sql: string, ...args: Array<string | number>) =>
      sql.includes("ST_CoverageSimplify") ? rows : [{ geojson: String(args[0]) }]
    ),
  });

  it("asks for the layer as one noded, simplified coverage, rows across ±180 left out", async () => {
    const db = coverageDb();
    await smoothLayerCoverage(db as never, "eurth-id", {
      layerType: "political",
      tolerance: 0.045,
      smooth: 0,
    });
    const [sql, realmId, layerType, tolerance] = db.$queryRawUnsafe.mock.calls[0]!;
    expect([realmId, layerType, tolerance]).toEqual(["eurth-id", "political", 0.045]);
    expect(sql).toMatch(/ST_Polygonize/);
    expect(sql).toMatch(/ST_AsGeoJSON\(ST_Multi\(s\.g\)\)/);
    expect(sql).toMatch(/ST_CoverageSimplify\(g, \$3\) OVER \(\)/);
    expect(sql).toMatch(/ORDER BY fid, l\.key COLLATE "C"/);
    expect(sql).toMatch(/ST_DumpSegments/);
  });

  it("without smoothing returns the simplified outlines, made valid, with vertex counts", async () => {
    const db = coverageDb();
    const updates = await smoothLayerCoverage(db as never, "eurth-id", {
      layerType: "political",
      tolerance: 0.045,
      smooth: 0,
    });
    expect(updates).toEqual([
      {
        id: "row-a",
        key: "A",
        countryId: "c-a",
        geometry: multiSquare(0),
        verticesBefore: 12,
        verticesAfter: 5,
      },
      {
        id: "row-b",
        key: "B",
        countryId: null,
        geometry: multiSquare(4),
        verticesBefore: 8,
        verticesAfter: 5,
      },
    ]);
    expect(db.$queryRawUnsafe.mock.calls[1]![0]).toMatch(/ST_MakeValid/);
  });

  it("smooths both sides of a shared edge alike: the neighbours still meet, the outer corners are cut", async () => {
    const updates = await smoothLayerCoverage(coverageDb() as never, "eurth-id", {
      layerType: "political",
      tolerance: 0.5,
      smooth: 2,
    });
    const ringA = updates[0]!.geometry.coordinates[0]![0]!;
    const ringB = updates[1]!.geometry.coordinates[0]![0]!;
    expect(ringA).not.toContainEqual([0, 0]);
    expect(ringB).not.toContainEqual([8, 4]);
    const onEdge = (ring: number[][]) =>
      ring
        .filter((p) => p[0] === 4)
        .map((p) => p[1])
        .sort();
    expect(onEdge(ringA)).toEqual(expect.arrayContaining(onEdge(ringB)));
    expect(onEdge(ringB)).toEqual(expect.arrayContaining([0, 4]));
  });
});
