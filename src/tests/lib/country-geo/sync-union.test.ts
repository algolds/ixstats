/** @jest-environment node */
/**
 * syncCountryGeometryFromMapLayer takes a nation's outline from the PostGIS function atlas_country_union (the union of
 * its regions, see atlas-r0-migration.test.ts), not from Node: the regions' geometries never leave the database. A
 * region drawn across +-180 keeps its stored GeoJSON (its geom_postgis is a planar sliver) and sits beside the
 * union. A NULL answer (the function caught a failure) keeps the cached outline.
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

/** What atlas_country_union returns, as the driver hands the row back. */
const unionOf = (geometry: object | null, wide: object[] | null = null) => [
  { result: { geometry, wide } },
];

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
  it("asks atlas_country_union once, for the nation in its realm, and writes the outline it returns", async () => {
    const merged = square(0, 0);
    const db = dbWith(unionOf(merged), [
      region(3000, [0.5, 0.5], [0, 0, 1, 1]),
      region(1000, [10.5, 0.5], [10, 0, 11, 1]),
    ]);
    await syncCountryGeometryFromMapLayer(db, "c1");

    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = db.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("atlas_country_union($1, $2)");
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
    const db = dbWith(unionOf(square(0, 0)), [region(10, [0, 0], [0, 0, 1, 1])]);
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
    const db = dbWith(unionOf(square(0, 0), [wide]), [region(2000, [0.5, 0.5], [0, 0, 1, 1])]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    const { geometry } = db.country.update.mock.calls[0][0].data;
    expect(geometry.type).toBe("MultiPolygon");
    expect(geometry.coordinates).toEqual([square(0, 0).coordinates, wide.coordinates]);
  });

  it("a nation drawn only across +-180 keeps its stored geometry", async () => {
    const wide = square(170, 0);
    const db = dbWith(unionOf(null, [wide]), [region(2000, [170.5, 0.5], null)]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.country.update.mock.calls[0][0].data.geometry).toEqual(wide);
  });

  it("leaves the cached geometry alone when no region has a PostGIS geometry yet", async () => {
    const db = dbWith(unionOf(null), [region(2000, [0.5, 0.5], [0, 0, 1, 1])]);
    await syncCountryGeometryFromMapLayer(db, "c1");
    const data = db.country.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("geometry");
    expect(data).toMatchObject({ landArea: 2000 });
  });

  it("a union the database could not compute (NULL) keeps the cached outline and still writes the metrics", async () => {
    const db = dbWith([{ result: null }], [region(2000, [0.5, 0.5], [0, 0, 1, 1])]);
    await syncCountryGeometryFromMapLayer(db, "c1");

    const data = db.country.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("geometry");
    expect(data).toMatchObject({
      centroid: [0.5, 0.5],
      boundingBox: [0, 0, 1, 1],
      landArea: 2000,
      areaSqMi: 2000 * 0.386102,
    });
  });

  it("a database without atlas_country_union degrades the same way, with a warning", async () => {
    const db = dbWith([], [region(2000, [0.5, 0.5], [0, 0, 1, 1])]);
    db.$queryRawUnsafe.mockRejectedValue(
      new Error("function atlas_country_union(text, text) does not exist")
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(syncCountryGeometryFromMapLayer(db, "c1")).resolves.toBeUndefined();

    const data = db.country.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("geometry");
    expect(data).toMatchObject({
      centroid: [0.5, 0.5],
      boundingBox: [0, 0, 1, 1],
      landArea: 2000,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("c1"), expect.any(Error));
    warn.mockRestore();
  });

  it("without the country row there is no realm to read the regions from: no union is asked for", async () => {
    const db = dbWith(unionOf(square(0, 0)), [region(10, [0, 0], [0, 0, 1, 1])]);
    db.country.findUnique.mockResolvedValue(null);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(db.country.update.mock.calls[0][0].data).not.toHaveProperty("geometry");
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
