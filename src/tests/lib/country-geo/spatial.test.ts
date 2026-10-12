import { COUNTRY_BORDER_SQL } from "~/lib/maps/geo-validation";
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

  it("reports 9999 km for both when no water rows exist", async () => {
    const { db, update } = makeDb([]);
    await updateCitySpatialProfile(db, "c1");
    const waterAccess = update.mock.calls[0][0].data.waterAccess;
    expect(waterAccess.riverDistanceKm).toBe(9999);
    expect(waterAccess.lakeDistanceKm).toBe(9999);
    expect(waterAccess.nearRiver).toBe(false);
  });
});

describe("updateCitySpatialProfile water distance", () => {
  it("finds the nearest river and lake by index-assisted nearest-neighbour, then measures them", async () => {
    const { db, $queryRawUnsafe } = makeDb([{ type: "rivers", distance: 1 }]);
    await updateCitySpatialProfile(db, "c1");

    const sql = $queryRawUnsafe.mock.calls[1]![0] as string;
    // a few index-ordered candidates are measured, not every river and lake of the realm
    expect(sql).toMatch(/ORDER BY ml\.geom_postgis <-> c\.geom_postgis\s+LIMIT 5/);
    expect(sql).not.toContain("GROUP BY");
  });

  it("uses water distances it is given instead of querying for them", async () => {
    const { db, update, $queryRawUnsafe } = makeDb([]);
    await updateCitySpatialProfile(db, "c1", { riverKm: 12.345, lakeKm: 4 });

    expect($queryRawUnsafe).toHaveBeenCalledTimes(1); // the climate query only
    expect(update.mock.calls[0][0].data.waterAccess).toEqual({
      nearRiver: false,
      nearLake: true,
      riverDistanceKm: 12.35,
      lakeDistanceKm: 4,
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

  it.each([3, 30])("runs one containment query and one water query for %i points", async (n) => {
    const { db, $queryRawUnsafe } = batchDb();
    const lookups = await lookupCityPoints(db, "k1", points(n));

    expect($queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(lookups).toHaveLength(n);
  });

  it("sends every point in arrays the queries unnest, with the country id first", async () => {
    const { db, $queryRawUnsafe } = batchDb();
    await lookupCityPoints(db, "k1", [
      [10, 20],
      [11, 21],
    ]);

    for (const [sql, countryId, indexes, lngs, lats] of $queryRawUnsafe.mock.calls) {
      expect(sql).toContain("unnest($2::int[], $3::float8[], $4::float8[])");
      expect([countryId, indexes, lngs, lats]).toEqual(["k1", [0, 1], [10, 11], [20, 21]]);
    }
  });

  it("looks points up against the country's border and approved subdivisions, without ST_MakeValid on the stored outlines", async () => {
    const { db, $queryRawUnsafe } = batchDb();
    await lookupCityPoints(db, "k1", points(2));

    const sql = $queryRawUnsafe.mock.calls
      .map((c) => c[0] as string)
      .find((q) => q.includes("subdivisions"))!;
    expect(sql).toContain(COUNTRY_BORDER_SQL);
    expect(sql).toContain(`s.status = 'approved'`);
    expect(sql).toContain("ST_Covers(s.geom_postgis, pts.pt)");
  });

  it("answers each point in order with inside, subdivision and water distances", async () => {
    const { db } = batchDb();
    const lookups = await lookupCityPoints(db, "k1", points(2));

    expect(lookups).toEqual([
      { inside: true, subdivisionId: "sub0", water: { riverKm: 0.5, lakeKm: 100 } },
      { inside: false, subdivisionId: null, water: { riverKm: 1.5, lakeKm: 101 } },
    ]);
  });

  it("reports 9999 km for a water type the realm has none of", async () => {
    const { db } = batchDb({ water: [{ i: 0, type: "rivers", distance: "2.5" }] });
    const [lookup] = await lookupCityPoints(db, "k1", points(1));

    expect(lookup!.water).toEqual({ riverKm: 2.5, lakeKm: 9999 });
  });

  it("leaves a point's border unknown (null) when there is no border to check against", async () => {
    const { db } = batchDb({ containment: [{ i: 0, is_inside: null, subdivisionId: null }] });
    const [lookup] = await lookupCityPoints(db, "k1", points(1));

    expect(lookup!.inside).toBeNull();
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

  it("asks nothing for an empty batch", async () => {
    const { db, $queryRawUnsafe } = batchDb();
    expect(await lookupCityPoints(db, "k1", [])).toEqual([]);
    expect($queryRawUnsafe).not.toHaveBeenCalled();
  });
});
