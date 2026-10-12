/** @jest-environment node */
// Atlas R0 task 2 fix round: countryZoneFills clips in PostGIS, except for a country that crosses the antimeridian
// (designed bbox estimate) and never turns a failed query into an estimate (the profile is cached for an hour).
import { countryZoneFills, type Extent } from "~/server/api/routers/geo/core/profile-zones";

const COUNTRY = { id: "c1", realmId: "default" };
const FEATURE = {
  featureId: "f1",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 8],
        [10, 8],
        [10, 10],
        [0, 8],
      ],
    ],
  },
  properties: { fill: "#aaaaaa" },
  areaSqKm: 100,
  displayName: null,
};

function fakeDb() {
  return {
    $queryRawUnsafe: jest.fn(async (_sql: string, ..._params: string[]) => [
      { fill: "#00fd97", climateId: null, zoneId: null, area: 300 },
    ]),
    mapLayer: {
      findMany: jest.fn(async (_args: { where: { layerType: string; realmId: string } }) => [
        FEATURE,
      ]),
    },
  };
}

const fills = (db: ReturnType<typeof fakeDb>, bbox: Extent | null) =>
  countryZoneFills(db as never, COUNTRY, "climate", bbox);

describe("countryZoneFills", () => {
  it("clips the realm's layer to the country in PostGIS", async () => {
    const db = fakeDb();
    const result = await fills(db, [7, -33, 45, -1]);

    expect(result).toMatchObject([
      { fill: "#00fd97", climateId: null, zoneId: null, overlapArea: 300 },
    ]);
    expect(db.$queryRawUnsafe.mock.calls[0]?.slice(1)).toEqual(["c1", "climate"]);
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });

  it("clips a country with no stored bounding box and one exactly 180 degrees wide", async () => {
    for (const bbox of [null, [-90, 0, 90, 10] as Extent]) {
      const db = fakeDb();
      await fills(db, bbox);
      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(db.mapLayer.findMany).not.toHaveBeenCalled();
    }
  });

  it("estimates from bounding boxes, without querying PostGIS, when the extent is over 180 degrees wide", async () => {
    const db = fakeDb();
    const result = await fills(db, [-179.9, 7, 179.9, 20]);

    // geom_postgis of a country crossing +-180 is a planar sliver, so the clip would be wrong
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(db.mapLayer.findMany.mock.calls[0]?.[0].where).toEqual({
      layerType: "climate",
      isActive: true,
      realmId: "default",
    });
    expect(result).toEqual([{ fill: "#aaaaaa", climateId: null, zoneId: null, overlapArea: 100 }]);
  });

  it("rejects when the PostGIS query fails instead of falling back to an estimate", async () => {
    const db = fakeDb();
    db.$queryRawUnsafe.mockRejectedValue(new Error("postgis down"));

    await expect(fills(db, [7, -33, 45, -1])).rejects.toThrow("postgis down");
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });
});
