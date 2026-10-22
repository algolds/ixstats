/** @jest-environment node */
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));
import { geometryProblem, writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import {
  dropRepeatedPoints,
  repairPolygonalGeometry,
  smoothLayerCoverage,
} from "~/lib/maps/realm-geometry-repair";
import type { MultiPolygon } from "geojson";
import {
  planLayerRepair,
  repairRealmLayer,
  type LayerFeatureState,
} from "~/lib/maps/realm-layer-repair";
import { realmLayerConfigSchema } from "~/lib/maps/import/realm-layer-config";

const square = (x: number) => ({
  type: "MultiPolygon" as const,
  coordinates: [
    [
      [
        [x, 0],
        [x + 1, 0],
        [x + 1, 1],
        [x, 1],
        [x, 0],
      ],
    ],
  ],
});

function writerDb() {
  const db: any = {
    country: {
      findMany: jest.fn().mockResolvedValue([{ id: "c1" }]),
      update: jest.fn().mockResolvedValue({}),
    },
    mapLayer: {
      upsert: jest.fn(async ({ where }: any) => ({
        id: `row-${where.realmId_layerType_featureId.featureId}`,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    // The repair returns the geometry it was given; no overlaps by default; every area query measures 777.5.
    $queryRawUnsafe: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes("AS geojson") && !sql.includes("ST_Difference"))
        return [{ geojson: params[0] }];
      if (sql.includes("ST_Difference")) return [];
      return [{ area: 777.5 }];
    }),
    $transaction: jest.fn((cb: any) => cb(db)),
  };
  return db;
}

describe("geometryProblem", () => {
  it("accepts closed lon/lat polygons and refuses everything else", () => {
    expect(geometryProblem(square(0))).toBeNull();
    expect(geometryProblem({ type: "Polygon", coordinates: square(0).coordinates[0] })).toBeNull();
    expect(geometryProblem({ type: "Point", coordinates: [0, 0] })).toMatch(/not a Polygon/);
    expect(
      geometryProblem({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 0],
          ],
        ],
      })
    ).toMatch(/fewer than four/);
    expect(
      geometryProblem({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      })
    ).toMatch(/not closed/);
    expect(
      geometryProblem({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [500, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      })
    ).toMatch(/in range/);
    expect(geometryProblem(null)).toMatch(/no coordinates/);
  });
});

describe("writeRealmMapFeatures", () => {
  it("rejects bad geometry and countries of other realms without writing them", async () => {
    const db = writerDb();
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      {
        key: "Bad",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0, 0],
            ],
          ],
        } as never,
      },
      { key: "Elsewhere", geometry: square(0), countryId: "c-ixnay" },
    ]);
    expect(result.written).toEqual([]);
    expect(result.rejected.map((r) => r.key)).toEqual(["Bad", "Elsewhere"]);
    expect(db.mapLayer.upsert).not.toHaveBeenCalled();
  });

  it("writes in batches, each in a transaction with an explicit timeout, and a failed batch spares the others", async () => {
    const db = writerDb();
    let batch = 0;
    db.$transaction.mockImplementation((cb: any, opts: any) => {
      expect(opts).toMatchObject({ timeout: 5000 });
      batch++;
      if (batch === 2) return Promise.reject(new Error("deadlock"));
      return cb(db);
    });
    const features = [0, 2, 4, 6, 8].map((x) => ({ key: `F${x}`, geometry: square(x) }));
    const result = await writeRealmMapFeatures(db, "eurth-id", features, {
      batchSize: 2,
      transactionTimeoutMs: 5000,
    });
    // Three batches, then the overlap pass over what was written.
    expect(db.$transaction).toHaveBeenCalledTimes(4);
    expect(result.written).toEqual(["F0", "F2", "F8"]);
    expect(result.rejected).toEqual([
      { key: "F4", reason: "deadlock" },
      { key: "F6", reason: "deadlock" },
    ]);
  });

  it("stores the repaired geometry (valid, no repeated points, MultiPolygon) on the feature and its country", async () => {
    const db = writerDb();
    const repaired = square(5);
    db.$queryRawUnsafe.mockImplementationOnce(async () => [{ geojson: JSON.stringify(repaired) }]);
    const twisted = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      { key: "Aurora", geometry: twisted as never, countryId: "c1" },
    ]);
    expect(result.written).toEqual(["Aurora"]);
    const [repairSql, sent] = db.$queryRawUnsafe.mock.calls[0];
    expect(repairSql).toMatch(/ST_CollectionExtract\(ST_MakeValid/);
    expect(JSON.parse(sent).coordinates[0][0]).toEqual([
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ]);
    expect(db.mapLayer.upsert.mock.calls[0][0].create.geometry).toEqual(repaired);
    expect(db.country.update.mock.calls[0][0].data.geometry).toEqual(repaired);
  });
  it("after a political write, gives each overlap strip with the written features to one side and reports it", async () => {
    const db = writerDb();
    db.country.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const base = db.$queryRawUnsafe.getMockImplementation();
    db.$queryRawUnsafe.mockImplementation(async (sql: string, ...params: any[]) => {
      if (sql.includes("ST_Difference"))
        return [
          {
            id: "row-B",
            key: "B",
            countryId: null,
            geojson: JSON.stringify(square(1)),
            removed_km2: 3,
          },
        ];
      if (sql.includes("WHERE id = $1 AND")) return [{ area: 12 }];
      return base(sql, ...params);
    });
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      { key: "A", geometry: square(0) },
      { key: "B", geometry: square(0.5) },
    ]);
    const find = db.$queryRawUnsafe.mock.calls.find(([sql]: [string]) =>
      sql.includes("ST_Difference")
    );
    expect(find.slice(1)).toEqual(["eurth-id", "political", ["A", "B"], 1]);
    expect(result.areas).toEqual({ A: 777.5, B: 12 });
    expect(result.trimmed).toEqual({ B: 3 });
  });
});

describe("repairing a realm's geometry", () => {
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
      {
        id: "row-b",
        key: "B",
        countryId: null,
        geojson: JSON.stringify(multiSquare(4)),
        before: 8,
      },
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
});

describe("repairing a realm's layer", () => {
  const square = (x: number, size = 1): MultiPolygon => ({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [x, 0],
          [x + size, 0],
          [x + size, size],
          [x, size],
          [x, 0],
        ],
      ],
    ],
  });
  const COVERAGE = { tolerance: 0.045, smooth: 2 };
  function feature(key: string, over: Partial<LayerFeatureState> = {}): LayerFeatureState {
    return {
      id: `row-${key}`,
      key,
      countryId: null,
      name: key,
      properties: {},
      geometry: square(0),
      hash: `h-${key}`,
      crosses: false,
      valid: true,
      reason: "Valid Geometry",
      repeated: 0,
      vertices: 5,
      storedType: "ST_MultiPolygon",
      ...over,
    };
  }
  const stamped = (key: string, over: Partial<LayerFeatureState> = {}) =>
    feature(key, { properties: { coverage: { ...COVERAGE, hash: `h-${key}` } }, ...over });
  describe("planLayerRepair", () => {
    it("will not smooth when a smoothed feature's unsmoothed outline is unknown (it would be rounded twice)", () => {
      const plan = planLayerRepair([stamped("A"), feature("B")], { trims: [], coverage: COVERAGE });
      expect(plan.smoothing).toMatchObject({ status: "blocked", blocked: ["A"] });
      expect(plan.changed).toBe(false);
    });
    it("repairs invalid outlines, repeated points and overlaps; rows across ±180 are left out of every count", () => {
      const plan = planLayerRepair(
        [
          feature("A", { valid: false, reason: "Self-intersection" }),
          feature("B", { repeated: 2 }),
          feature("C", { storedType: "ST_Polygon" }),
          feature("Z", { crosses: true, valid: false }),
        ],
        { trims: [{ key: "B", removedKm2: 3 }], coverage: null }
      );
      expect(plan.needsRepair).toEqual(["A", "B", "C"]);
      expect(plan.changed).toBe(true);
      expect(plan.crossing).toEqual(["Z"]);
    });
  });
  describe("repairRealmLayer", () => {
    function repairDb(rows: Array<Record<string, unknown>>) {
      const db: any = {
        country: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        mapLayer: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn(async ({ where }: any) => ({
            id: `row-${where.realmId_layerType_featureId.featureId}`,
          })),
          update: jest.fn(),
        },
        mapImport: { create: jest.fn().mockResolvedValue({ id: "imp1" }) },
        $queryRawUnsafe: jest.fn(async (sql: string, ...params: any[]) => {
          if (sql.includes("ST_IsValidReason")) return rows;
          if (
            sql.includes("AS geojson") &&
            !sql.includes("ST_Difference") &&
            !sql.includes("ST_CoverageSimplify")
          )
            return [{ geojson: params[0] }];
          return [];
        }),
        $transaction: jest.fn((cb: any) => cb(db)),
      };
      return db;
    }

    const row = (key: string, properties: object) => ({
      id: `row-${key}`,
      key,
      countryId: null,
      name: key,
      properties,
      geojson: JSON.stringify(square(0)),
      hash: `h-${key}`,
      crosses: false,
      valid: true,
      reason: "Valid Geometry",
      repeated: 0,
      vertices: 5,
      storedType: "ST_MultiPolygon",
    });
    it("applying writes every polygon from its unsmoothed outline, its old record dropped, with a rollback snapshot", async () => {
      const db = repairDb([row("A", { sourceHash: "s-A", fill: "#123456" })]);
      const report = await repairRealmLayer(db, "eurth-id", {
        layerType: "political",
        coverage: COVERAGE,
        apply: true,
        createdBy: "test",
        sourceRaw: new Map([["A", { geometry: square(10), sourceHash: "s-A" }]]),
      });
      expect(report.written?.written).toEqual(["A"]);
      expect(report.mapImportId).toBe("imp1");
      const upsert = db.mapLayer.upsert.mock.calls[0][0];
      expect(upsert.update.properties).toEqual({ sourceHash: "s-A", fill: "#123456" });
      expect(upsert.update.geometry).toEqual(square(10));
      expect(db.mapImport.create.mock.calls[0][0].data).toMatchObject({
        realmId: "eurth-id",
        layerTypes: ["political"],
        mode: "merge",
        createdBy: "test",
      });
    });
  });
});

describe("realm layer config", () => {
  it("names art by key, never by file path", () => {
    expect(() => realmLayerConfigSchema.parse({ land: "Maps/blank.png" })).toThrow(/Art names/);
  });
});
