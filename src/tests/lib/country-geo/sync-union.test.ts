/** @jest-environment node */
/**
 * syncCountryGeometryFromMapLayer unions a nation's regions in PostGIS (ST_Union over map_layers.geom_postgis),
 * not in Node: the regions' geometries never leave the database. A region drawn across +-180 keeps its stored
 * GeoJSON (its geom_postgis is a planar sliver) and sits beside the union.
 */
import { readFileSync } from "node:fs";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo/sync";

const square = (x: number, y: number) => ({
  type: "Polygon" as const,
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

const region = (areaSqKm: number | null, centroid: number[] | null, box: number[] | null) => ({
  centroid,
  boundingBox: box,
  areaSqKm,
});

function dbWith(unionRows: object[], regions: object[]) {
  return {
    $queryRawUnsafe: jest.fn().mockResolvedValue(unionRows),
    mapLayer: { findMany: jest.fn().mockResolvedValue(regions) },
    country: {
      findUnique: jest.fn().mockResolvedValue({ realmId: "r_eurth" }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe("syncCountryGeometryFromMapLayer (PostGIS union)", () => {
  it("runs one ST_Union over the country's active political regions and writes the result", async () => {
    const merged = square(0, 0);
    const db = dbWith(
      [{ geometry: merged, wide: null }],
      [region(3000, [0.5, 0.5], [0, 0, 1, 1]), region(1000, [10.5, 0.5], [10, 0, 11, 1])]
    );
    await syncCountryGeometryFromMapLayer(db, "c1");

    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = db.$queryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/ST_Union\(/);
    expect(sql).toContain("map_layers");
    expect(sql).toContain(`"layerType" = 'political'`);
    expect(sql).toContain(`"isActive" = true`);
    expect(sql).toContain(`"countryId" = $1`);
    expect(sql).toContain(`"worldId" = $2`);
    expect(params).toEqual(["c1", "r_eurth"]);

    const data = db.country.update.mock.calls[0][0].data;
    expect(data.geometry).toEqual(merged);
    expect(data).toMatchObject({
      centroid: [3, 0.5],
      boundingBox: [0, 0, 11, 1],
      landArea: 4000,
      areaSqMi: 4000 * 0.386102,
    });
  });

  it("does not pull the regions' geometries into Node", async () => {
    const db = dbWith([{ geometry: square(0, 0), wide: null }], [region(10, [0, 0], [0, 0, 1, 1])]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    const select = db.mapLayer.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("geometry");
    expect(select).toMatchObject({ centroid: true, boundingBox: true, areaSqKm: true });
  });

  it("reads the nation's regions from its own realm's map only", async () => {
    const db = dbWith([], []);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.mapLayer.findMany.mock.calls[0][0].where).toEqual({
      layerType: "political",
      countryId: "c1",
      isActive: true,
      realmId: "r_eurth",
    });
  });

  it("puts a region drawn across +-180 beside the union, with the geometry it was stored with", async () => {
    const wide = square(170, 0);
    const db = dbWith(
      [{ geometry: square(0, 0), wide: [wide] }],
      [region(2000, [0.5, 0.5], [0, 0, 1, 1])]
    );
    await syncCountryGeometryFromMapLayer(db, "c1");
    const { geometry } = db.country.update.mock.calls[0][0].data;
    expect(geometry.type).toBe("MultiPolygon");
    expect(geometry.coordinates).toEqual([square(0, 0).coordinates, wide.coordinates]);
  });

  it("a nation drawn only across +-180 keeps its stored geometry", async () => {
    const wide = square(170, 0);
    const db = dbWith([{ geometry: null, wide: [wide] }], [region(2000, [170.5, 0.5], null)]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.country.update.mock.calls[0][0].data.geometry).toEqual(wide);
  });

  it("leaves the cached geometry alone when no region has a PostGIS geometry yet", async () => {
    const db = dbWith([{ geometry: null, wide: null }], [region(2000, [0.5, 0.5], [0, 0, 1, 1])]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    const data = db.country.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("geometry");
    expect(data).toMatchObject({ landArea: 2000 });
  });

  it("with no linked region (an unlink) clears the cached geography without a union", async () => {
    const db = dbWith([], []);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { geometry: null, centroid: null, boundingBox: null, landArea: null, areaSqMi: null },
    });
  });

  it("no longer imports turf", () => {
    const source = readFileSync("src/lib/country-geo/sync.ts", "utf8");
    expect(source).not.toMatch(/@turf/);
  });
});
