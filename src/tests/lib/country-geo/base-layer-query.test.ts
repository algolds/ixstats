import { getTerrainAtPoint } from "~/lib/country-geo/base-layer-query";
import type { PrismaClient } from "@prisma/client";

function dbReturning(rows: unknown[]) {
  const $queryRawUnsafe = jest.fn().mockResolvedValue(rows);
  return { db: { $queryRawUnsafe } as unknown as PrismaClient, $queryRawUnsafe };
}

const band = (featureId: string, elevationMin: number, elevationMax: number) => ({
  layerType: "altitudes",
  featureId,
  properties: { zoneId: featureId, zoneName: featureId, elevationMin, elevationMax, fill: "#000" },
});

describe("getTerrainAtPoint", () => {
  it("filters by the realm it is given (worldId): realms share coordinates", async () => {
    const { db, $queryRawUnsafe } = dbReturning([]);
    await getTerrainAtPoint(db, 10, 20, "r_eurth");
    const [sql, ...params] = $queryRawUnsafe.mock.calls[0];
    expect(sql).toContain(`"worldId" = $3`);
    expect(params).toEqual([10, 20, "r_eurth"]);
  });

  it("picks the highest overlapping altitude band regardless of row order", async () => {
    const rows = [band("lowland", 0, 500), band("alpine", 2000, 3000), band("hills", 500, 1000)];
    for (const order of [rows, [...rows].reverse()]) {
      const { db } = dbReturning(order);
      const result = await getTerrainAtPoint(db, 0, 0, "r1");
      expect(result.elevationZone).toMatchObject({ zoneId: "alpine", elevationMin: 2000 });
    }
  });

  it("returns the climate zone alongside the elevation zone", async () => {
    const { db } = dbReturning([
      band("hills", 500, 1000),
      {
        layerType: "climate",
        featureId: "c",
        properties: { climateId: "temperate", climateName: "Temperate" },
      },
    ]);
    const result = await getTerrainAtPoint(db, 0, 0, "r1");
    expect(result.climateZone).toMatchObject({ climateId: "temperate" });
  });

  it("returns nulls when the query fails", async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockRejectedValue(new Error("boom")),
    } as unknown as PrismaClient;
    expect(await getTerrainAtPoint(db, 0, 0, "r1")).toEqual({
      elevationZone: null,
      climateZone: null,
    });
  });
});
