/**
 * Tests for validateGeometryStructure (pure, no DB) from geo-validation.ts.
 */

import type { Geometry } from "geojson";
import { validateGeometryStructure } from "../geo-validation";

describe("validateGeometryStructure (pure)", () => {
  test("returns no errors for a valid closed square Polygon", () => {
    const square: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    expect(validateGeometryStructure(square)).toEqual([]);
  });

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
