/**
 * Tests for validateGeometryStructure (pure, no DB) from geo-validation.ts.
 */

import type { Geometry } from "geojson";
import {
  validateGeometryStructure,
  repairGeometryGeoJSON,
  resetPostGISCache,
} from "~/lib/maps/geo-validation";

describe("validateGeometryStructure (pure)", () => {
  test("returns ring_not_closed error when first and last positions differ", () => {
    const unclosed: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    };
    const errors = validateGeometryStructure(unclosed);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.type).toBe("ring_not_closed");
  });

  test("returns too_few_vertices error for a ring with 3 positions", () => {
    const tooSmall: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      ],
    };
    const errors = validateGeometryStructure(tooSmall);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.type).toBe("too_few_vertices");
  });
});

describe("repairGeometryGeoJSON", () => {
  beforeEach(() => {
    resetPostGISCache();
  });
  test("returns repaired geometry from PostGIS if available", async () => {
    const repairedPoly = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const mockDb = {
      $queryRawUnsafe: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes("PostGIS_Version")) {
          return [{ version: "3.0" }];
        }
        if (sql.includes("ST_AsGeoJSON")) {
          return [{ repaired: JSON.stringify(repairedPoly) }];
        }
        return [];
      }),
    } as any;

    const poly = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const repaired = await repairGeometryGeoJSON(mockDb, poly);
    expect(repaired).toEqual(repairedPoly);
  });

  test("falls back to original geometry if PostGIS query fails after check", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let callCount = 0;
    const mockDb = {
      $queryRawUnsafe: jest.fn().mockImplementation(async (sql: string) => {
        callCount++;
        if (sql.includes("PostGIS_Version")) {
          return [{ version: "3.0" }];
        }
        throw new Error("Query failed");
      }),
    } as any;

    const poly = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const repaired = await repairGeometryGeoJSON(mockDb, poly);
    expect(repaired).toBe(poly);
    expect(callCount).toBe(2);
    warnSpy.mockRestore();
  });
});
