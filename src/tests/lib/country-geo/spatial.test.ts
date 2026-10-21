import { lookupCityPoints, updateCitySpatialProfile } from "~/lib/country-geo/spatial";

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
  return { db, update, $queryRawUnsafe };
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
});
describe("lookupCityPoints", () => {
  const points = (n: number): Array<[number, number]> =>
    Array.from({ length: n }, (_, i) => [10 + i, 20 + i]);

  /** Answers the containment query (it names the `unnest` of points and `subdivisions`) and the water query. */
  function batchDb(over: { containment?: object[] | Error; water?: object[] | Error } = {}) {
    const $queryRawUnsafe = jest.fn(
      async (
        sql: string,
        _countryId: string,
        indexes: number[],
        _lngs?: number[],
        _lats?: number[]
      ) => {
        const n = indexes.length;
        if (sql.includes("subdivisions")) {
          if (over.containment instanceof Error) throw over.containment;
          return (
            over.containment ??
            Array.from({ length: n }, (_, i) => ({
              i,
              is_inside: i % 2 === 0,
              subdivisionId: i % 2 === 0 ? `sub${i}` : null,
            }))
          );
        }
        if (over.water instanceof Error) throw over.water;
        return (
          over.water ??
          Array.from({ length: n }, (_, i) => [
            { i, type: "rivers", distance: i + 0.5 },
            { i, type: "lakes", distance: 100 + i },
          ]).flat()
        );
      }
    );
    return { db: { $queryRawUnsafe } as never, $queryRawUnsafe };
  }

  it("answers each point in order with inside, subdivision and water distances", async () => {
    const { db } = batchDb();
    const lookups = await lookupCityPoints(db, "k1", points(2));

    expect(lookups).toEqual([
      { inside: true, subdivisionId: "sub0", water: { riverKm: 0.5, lakeKm: 100 } },
      { inside: false, subdivisionId: null, water: { riverKm: 1.5, lakeKm: 101 } },
    ]);
  });
  it("keeps the water answers when the containment query fails, and the containment ones when water fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const noContainment = await lookupCityPoints(
      batchDb({ containment: new Error("no postgis") }).db,
      "k1",
      points(1)
    );
    expect(noContainment).toEqual([
      { inside: null, subdivisionId: null, water: { riverKm: 0.5, lakeKm: 100 } },
    ]);

    const noWater = await lookupCityPoints(
      batchDb({ water: new Error("boom") }).db,
      "k1",
      points(1)
    );
    expect(noWater).toEqual([{ inside: true, subdivisionId: "sub0", water: null }]);
    error.mockRestore();
  });
});
