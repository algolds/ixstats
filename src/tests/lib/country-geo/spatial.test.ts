import { updateCitySpatialProfile } from "~/lib/country-geo/spatial";

jest.mock("~/lib/maps/geo-analytics", () => ({
  resolveClimateFromColor: jest.fn(() => "temperate"),
}));

function makeDb(waterRows: Array<{ type: string; distance: number | string }>) {
  const update = jest.fn().mockResolvedValue({ id: "c1" });
  const $queryRawUnsafe = jest
    .fn()
    .mockResolvedValueOnce([{ fill: "#abc" }])
    .mockResolvedValueOnce(waterRows);
  const db = {
    city: {
      findUnique: jest.fn().mockResolvedValue({ id: "c1", coordinates: [1, 2] }),
      update,
    },
    $queryRawUnsafe,
  };
  return { db, update };
}

describe("updateCitySpatialProfile water access", () => {
  it("falls back to 9999 km (not NaN) for a water type with no rows", async () => {
    const { db, update } = makeDb([{ type: "rivers", distance: 3.456 }]);
    await updateCitySpatialProfile(db, "c1");
    const waterAccess = update.mock.calls[0][0].data.waterAccess;
    expect(waterAccess).toEqual({
      nearRiver: true,
      nearLake: false,
      riverDistanceKm: 3.46,
      lakeDistanceKm: 9999,
    });
  });

  it("reports 9999 km for both when no water rows exist", async () => {
    const { db, update } = makeDb([]);
    await updateCitySpatialProfile(db, "c1");
    const waterAccess = update.mock.calls[0][0].data.waterAccess;
    expect(waterAccess.riverDistanceKm).toBe(9999);
    expect(waterAccess.lakeDistanceKm).toBe(9999);
    expect(waterAccess.nearRiver).toBe(false);
  });
});
