/** @jest-environment node */
/**
 * AT-9: GeographicResource rows come from the country's mapped geography (PostGIS rivers, lakes,
 * coast and climate), not placeholders, and nothing is invented where the map has no data.
 */
import { describe, it, expect, jest } from "@jest/globals";
import {
  deriveGeographicResources,
  refreshGeographicResources,
  type ResourceSourceData,
} from "~/lib/maps/geographic-resources";
import { resolveClimateFromColor, getAgricultureFactor } from "~/lib/maps/geo-analytics";

const base: ResourceSourceData = {
  countryName: "Aurelia",
  areaSqKm: 100_000,
  coastlineKm: 0,
  coastPoint: null,
  rivers: [],
  lakes: [],
  climateAreas: [],
};

describe("deriveGeographicResources", () => {
  it("writes nothing for a country whose map shows no water, coast or zoned land", () => {
    expect(deriveGeographicResources(base)).toEqual([]);
  });

  it("lists the longest rivers and largest lakes as freshwater, on a fixed scale", () => {
    const res = deriveGeographicResources({
      ...base,
      rivers: [
        { name: "Vel", lengthKm: 500, point: [1, 1] },
        { name: null, lengthKm: 1500, point: [2, 2] },
        { name: "Brook", lengthKm: 4, point: [3, 3] },
        { name: "Third", lengthKm: 50, point: [4, 4] },
        { name: "Fourth", lengthKm: 20, point: [5, 5] },
      ],
      lakes: [{ name: "Mere", areaSqKm: 250, point: [6, 6] }],
    });
    expect(res).toEqual([
      { resourceType: "freshwater", name: "Aurelia river", coordinates: [2, 2], quantity: 1 },
      { resourceType: "freshwater", name: "Vel", coordinates: [1, 1], quantity: 0.5 },
      { resourceType: "freshwater", name: "Third", coordinates: [4, 4], quantity: 0.05 },
      { resourceType: "freshwater", name: "Mere", coordinates: [6, 6], quantity: 0.25 },
    ]);
  });

  it("adds a fishery only when there is a coast and a point on it", () => {
    expect(deriveGeographicResources({ ...base, coastlineKm: 500, coastPoint: [7, 8] })).toEqual([
      {
        resourceType: "fishery",
        name: "Aurelia coastal waters",
        coordinates: [7, 8],
        quantity: 0.25,
      },
    ]);
    expect(deriveGeographicResources({ ...base, coastlineKm: 500, coastPoint: null })).toEqual([]);
  });

  it("weights farmland by each climate zone's agriculture factor", () => {
    // Humid subtropical (Cf) and desert (Bw) fills from geo-analytics' climate colour table.
    const fA = getAgricultureFactor(resolveClimateFromColor("#336600")!);
    const fB = getAgricultureFactor(resolveClimateFromColor("#ffff33")!);
    expect(fA).toBeGreaterThan(fB);

    const res = deriveGeographicResources({
      ...base,
      climateAreas: [
        { fill: "#ffff33", areaSqKm: 40_000, point: [20, 20] },
        { fill: "#336600", areaSqKm: 60_000, point: [10, 10] },
        { fill: "not-a-colour", areaSqKm: 1_000_000, point: [0, 0] },
      ],
    });
    const arable = 60_000 * fA + 40_000 * fB;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    expect(res).toEqual([
      {
        resourceType: "agricultural",
        name: "Aurelia farmland",
        coordinates: [10, 10],
        quantity: round2(Math.min(1, arable / 100_000)),
        quality: round2(arable / 100_000),
        climateZone: resolveClimateFromColor("#336600"),
      },
    ]);
  });

  it("never produces minerals, oil, gas or forests (no geology data)", () => {
    const res = deriveGeographicResources({
      ...base,
      coastlineKm: 3000,
      coastPoint: [1, 1],
      rivers: [{ name: "Vel", lengthKm: 100, point: [1, 1] }],
    });
    expect(new Set(res.map((r) => r.resourceType))).toEqual(new Set(["freshwater", "fishery"]));
  });
});

describe("refreshGeographicResources", () => {
  function makeDb(geometry: object | null) {
    const rowsFor = (sql: string) => {
      if (sql.includes("'rivers'")) return [{ name: "Vel", size: 300, lng: 1.23456, lat: 2 }];
      if (sql.includes("'lakes'")) return [];
      if (sql.includes("'climate'")) return [];
      return [{ lng: 5, lat: 6, areaSqKm: 50_000 }];
    };
    return {
      country: {
        findUnique: jest.fn(async () =>
          geometry ? { name: "Aurelia", coastlineKm: 400, landArea: 1, geometry } : null
        ),
      },
      $queryRawUnsafe: jest.fn(async (sql: string, _countryId: string) => rowsFor(sql)),
      geographicResource: {
        deleteMany: jest.fn((args: object) => ({ op: "deleteMany", args })),
        createMany: jest.fn((args: object) => ({ op: "createMany", args })),
      },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
  }

  it("replaces the country's resources with the derived ones", async () => {
    const db = makeDb({ type: "Polygon", coordinates: [] });
    const written = await refreshGeographicResources(db as never, "c1");

    expect(written).toBe(2);
    expect(db.geographicResource.deleteMany).toHaveBeenCalledWith({ where: { countryId: "c1" } });
    expect(db.geographicResource.createMany).toHaveBeenCalledWith({
      data: [
        {
          countryId: "c1",
          resourceType: "freshwater",
          name: "Vel",
          coordinates: [1.2346, 2],
          quantity: 0.3,
          climateZone: null,
        },
        {
          countryId: "c1",
          resourceType: "fishery",
          name: "Aurelia coastal waters",
          coordinates: [5, 6],
          quantity: 0.2,
          climateZone: null,
        },
      ],
    });
    // Every PostGIS query is scoped to the country by parameter.
    for (const call of db.$queryRawUnsafe.mock.calls) expect(call[1]).toBe("c1");
  });

  it("clears the rows of a country without geometry", async () => {
    const db = makeDb(null);
    expect(await refreshGeographicResources(db as never, "c1")).toBe(0);
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(db.geographicResource.createMany).toHaveBeenCalledWith({ data: [] });
  });
});
