/** @jest-environment node */
jest.mock("~/lib/maps/geo-validation", () => ({ isPostGISAvailable: jest.fn().mockResolvedValue(true) }));

import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { geometryProblem, writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";

const square = (x: number) => ({
  type: "MultiPolygon" as const,
  coordinates: [[[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]]],
});

function writerDb() {
  const db: any = {
    country: {
      findMany: jest.fn().mockResolvedValue([{ id: "c1" }]),
      update: jest.fn().mockResolvedValue({}),
    },
    mapLayer: {
      upsert: jest.fn(async ({ where }: any) => ({ id: `row-${where.realmId_layerType_featureId.featureId}` })),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ area: 777.5 }]),
    $transaction: jest.fn((cb: any) => cb(db)),
  };
  return db;
}

describe("geometryProblem", () => {
  it("accepts closed lon/lat polygons and refuses everything else", () => {
    expect(geometryProblem(square(0))).toBeNull();
    expect(geometryProblem({ type: "Polygon", coordinates: square(0).coordinates[0] })).toBeNull();
    expect(geometryProblem({ type: "Point", coordinates: [0, 0] })).toMatch(/not a Polygon/);
    expect(geometryProblem({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] })).toMatch(/fewer than four/);
    expect(geometryProblem({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] })).toMatch(/not closed/);
    expect(geometryProblem({ type: "Polygon", coordinates: [[[0, 0], [500, 0], [1, 1], [0, 0]]] })).toMatch(/in range/);
    expect(geometryProblem(null)).toMatch(/no coordinates/);
  });
});

describe("writeRealmMapFeatures", () => {
  it("upserts by (realm, layer, key) with name and link, fills PostGIS and returns the geography area", async () => {
    const db = writerDb();
    const result = await writeRealmMapFeatures(
      db,
      "eurth-id",
      [{ key: "Tavok", geometry: square(0), name: "Tavok", countryId: "c1", areaKm2: 264334, properties: { sourceKey: "Tavok" } }],
      { layerType: "political" }
    );
    expect(result).toEqual({ written: ["Tavok"], rejected: [], areas: { Tavok: 777.5 } });
    const upsert = db.mapLayer.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ realmId_layerType_featureId: { realmId: "eurth-id", layerType: "political", featureId: "Tavok" } });
    expect(upsert.create).toMatchObject({ displayName: "Tavok", countryId: "c1", isActive: true, properties: { sourceKey: "Tavok" } });
    expect(db.$queryRawUnsafe.mock.calls[0][0]).toMatch(/ST_MakeValid\(ST_SetSRID\(ST_GeomFromGeoJSON/);
    expect(db.$queryRawUnsafe.mock.calls[0][0]).toMatch(/ST_Area\(geom_postgis::geography\)/);
    // The country takes the outline, never the land area (that is the caller's precedence decision).
    expect(db.country.update.mock.calls[0][0].data).not.toHaveProperty("landArea");
  });

  it("rejects bad geometry and countries of other realms without writing them", async () => {
    const db = writerDb();
    const result = await writeRealmMapFeatures(db, "eurth-id", [
      { key: "Bad", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 0]]] } as never },
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
    const result = await writeRealmMapFeatures(db, "eurth-id", features, { batchSize: 2, transactionTimeoutMs: 5000 });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
    expect(result.written).toEqual(["F0", "F2", "F8"]);
    expect(result.rejected).toEqual([
      { key: "F4", reason: "deadlock" },
      { key: "F6", reason: "deadlock" },
    ]);
  });

  it("without PostGIS keeps the importer's area and touches no PostGIS column", async () => {
    (isPostGISAvailable as jest.Mock).mockResolvedValueOnce(false);
    const db = writerDb();
    const result = await writeRealmMapFeatures(db, "eurth-id", [{ key: "A", geometry: square(0), areaKm2: 42 }]);
    expect(result.areas).toEqual({ A: 42 });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
