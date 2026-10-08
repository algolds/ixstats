/** @jest-environment node */
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));

import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { geometryProblem, writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";

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
  it("upserts by (realm, layer, key) with name and link, fills PostGIS and returns the geography area", async () => {
    const db = writerDb();
    const result = await writeRealmMapFeatures(
      db,
      "eurth-id",
      [
        {
          key: "Tavok",
          geometry: square(0),
          name: "Tavok",
          countryId: "c1",
          areaKm2: 264334,
          properties: { sourceKey: "Tavok" },
        },
      ],
      { layerType: "political" }
    );
    expect(result).toEqual({
      written: ["Tavok"],
      rejected: [],
      areas: { Tavok: 777.5 },
      trimmed: {},
      smoothed: 0,
    });
    const upsert = db.mapLayer.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({
      realmId_layerType_featureId: {
        realmId: "eurth-id",
        layerType: "political",
        featureId: "Tavok",
      },
    });
    expect(upsert.create).toMatchObject({
      displayName: "Tavok",
      countryId: "c1",
      isActive: true,
      properties: { sourceKey: "Tavok" },
    });
    const write = db.$queryRawUnsafe.mock.calls.find(([sql]: [string]) =>
      sql.includes("SET geom_postgis")
    )[0];
    expect(write).toMatch(/ST_MakeValid\(ST_SetSRID\(ST_GeomFromGeoJSON/);
    expect(write).toMatch(/ST_Area\(geom_postgis::geography\)/);
    // The country takes the outline, never the land area (that is the caller's precedence decision).
    expect(db.country.update.mock.calls[0][0].data).not.toHaveProperty("landArea");
  });

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
      { key: "Elsewhere", geometry: square(0), countryId: "c-ixworld" },
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

  it("rejects a feature the repair leaves without area", async () => {
    const db = writerDb();
    db.$queryRawUnsafe.mockImplementationOnce(async () => [{ geojson: null }]);
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      { key: "Sliver", geometry: square(0) },
    ]);
    expect(result.rejected).toEqual([
      { key: "Sliver", reason: "no polygonal area is left after repair" },
    ]);
    expect(db.mapLayer.upsert).not.toHaveBeenCalled();
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

  it("with `coverage`, smooths the whole layer as one coverage after the write and stores what changed", async () => {
    const db = writerDb();
    db.country.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const base = db.$queryRawUnsafe.getMockImplementation();
    db.$queryRawUnsafe.mockImplementation(async (sql: string, ...params: any[]) => {
      if (sql.includes("ST_CoverageSimplify"))
        return [
          { id: "row-Z", key: "Z", countryId: null, geojson: JSON.stringify(square(0)), before: 9 },
        ];
      if (sql.includes("WHERE id = $1 AND")) return [{ area: 42 }];
      return base(sql, ...params);
    });
    const result = await writeRealmMapFeatures(
      db,
      "eurth-id",
      [{ key: "Z", geometry: square(0) }],
      {
        layerType: "climate",
        coverage: { tolerance: 0.045, smooth: 0 },
      }
    );
    const coverage = db.$queryRawUnsafe.mock.calls.find(([sql]: [string]) =>
      sql.includes("ST_CoverageSimplify")
    );
    expect(coverage.slice(1)).toEqual(["eurth-id", "climate", 0.045]);
    expect(result.smoothed).toBe(1);
    expect(result.areas).toEqual({ Z: 42 });
  });

  it("with `coverage`, stamps the layer's smoothed features last, after overlap removal, so a repair can tell them", async () => {
    const db = writerDb();
    db.country.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const base = db.$queryRawUnsafe.getMockImplementation();
    db.$queryRawUnsafe.mockImplementation(async (sql: string, ...params: any[]) => {
      if (sql.includes("ST_CoverageSimplify"))
        return [
          { id: "row-A", key: "A", countryId: null, geojson: JSON.stringify(square(0)), before: 9 },
        ];
      return base(sql, ...params);
    });
    await writeRealmMapFeatures(db, "eurth-id", [{ key: "A", geometry: square(0) }], {
      coverage: { tolerance: 0.045, smooth: 2 },
    });
    const sqls = db.$queryRawUnsafe.mock.calls.map(([sql]: [string]) => sql);
    const stamp = sqls.findIndex((sql: string) => sql.includes("'coverage'"));
    expect(stamp).toBeGreaterThan(sqls.findIndex((sql: string) => sql.includes("ST_Difference")));
    expect(sqls[stamp]).toContain("md5(geometry::text)");
    expect(db.$queryRawUnsafe.mock.calls[stamp].slice(1)).toEqual([
      "eurth-id",
      "political",
      0.045,
      2,
    ]);
  });

  it("does not stamp a layer when no smoothing ran", async () => {
    const db = writerDb();
    await writeRealmMapFeatures(db, "eurth-id", [{ key: "A", geometry: square(0) }]);
    expect(
      db.$queryRawUnsafe.mock.calls.some(([sql]: [string]) => sql.includes("'coverage'"))
    ).toBe(false);
  });

  it("leaves the layer's coverage alone without `coverage`", async () => {
    const db = writerDb();
    await writeRealmMapFeatures(db, "eurth-id", [{ key: "A", geometry: square(0) }]);
    expect(
      db.$queryRawUnsafe.mock.calls.some(([sql]: [string]) => sql.includes("ST_CoverageSimplify"))
    ).toBe(false);
  });

  it("leaves overlaps alone on other layer types", async () => {
    const db = writerDb();
    await writeRealmMapFeatures(db, "eurth-id", [{ key: "Lake", geometry: square(0) }], {
      layerType: "lakes",
    });
    expect(
      db.$queryRawUnsafe.mock.calls.some(([sql]: [string]) => sql.includes("ST_Difference"))
    ).toBe(false);
  });

  it("without PostGIS keeps the importer's area and touches no PostGIS column", async () => {
    (isPostGISAvailable as jest.Mock).mockResolvedValueOnce(false);
    const db = writerDb();
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      { key: "A", geometry: square(0), areaKm2: 42 },
    ]);
    expect(result.areas).toEqual({ A: 42 });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
