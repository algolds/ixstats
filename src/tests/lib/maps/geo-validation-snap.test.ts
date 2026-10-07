/** @jest-environment node */
/**
 * snapPointToCountryBorder pulls a point just outside the border onto it and then a step inside, toward the
 * nearest subdivision's centroid. The centroid query reads the PostGIS column: casting the GeoJSON (jsonb) column
 * to geometry fails in PostgreSQL, which used to make every snap fall back to the raw point.
 */
import type { PrismaClient } from "@prisma/client";
import { resetPostGISCache, snapPointToCountryBorder } from "~/lib/maps/geo-validation";

function borderDb() {
  const $queryRawUnsafe = jest.fn(async (sql: string) => {
    if (/PostGIS_Version/.test(sql)) return [{}];
    if (/distance_meters/.test(sql)) return [{ is_inside: false, distance_meters: 500 }];
    if (/ST_ClosestPoint/.test(sql)) {
      return [{ closest_point: JSON.stringify({ type: "Point", coordinates: [10, 5] }) }];
    }
    if (/FROM subdivisions/.test(sql)) {
      if (/::geometry/.test(sql)) throw new Error("cannot cast type jsonb to geometry");
      return [{ c_lng: 5, c_lat: 5 }];
    }
    return [{ is_inside: true }];
  });
  return { db: { $queryRawUnsafe } as unknown as PrismaClient, $queryRawUnsafe };
}

beforeEach(() => resetPostGISCache());

describe("snapPointToCountryBorder", () => {
  it("nudges the border point inside, toward the nearest subdivision centroid", async () => {
    const { db, $queryRawUnsafe } = borderDb();
    const [lng, lat] = await snapPointToCountryBorder(db, "c1", 10.004, 5);

    expect(lng).toBeCloseTo(9.9999, 6);
    expect(lat).toBeCloseTo(5, 6);
    const centroidSql = $queryRawUnsafe.mock.calls.find(([sql]) => /FROM subdivisions/.test(sql))!;
    expect(centroidSql[0]).toContain("ST_Centroid(geom_postgis)");
  });
});
