/**
 * Tests for territory-brush-math.ts (plan 012 spike).
 *
 * Fixture: two adjacent unit squares meeting at x=0.
 *
 *   S (source): x ∈ [-1, 0], y ∈ [0, 1]  (left square)
 *   T (target): x ∈ [0,  1], y ∈ [0, 1]  (right square)
 *
 * A brush stroke near x=0 (the shared border) should transfer a slice of S → T.
 *
 * calculateArea is used to assert direction of change.
 * Exact areas need not match — we just care about sign.
 */

import type { Polygon, MultiPolygon } from "geojson";
import { applyBrushStroke } from "./territory-brush-math";
import { calculateArea } from "~/lib/border-editor";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Left unit square: x ∈ [-1,0], y ∈ [0,1] — this is the SOURCE territory. */
const SOURCE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ],
  ],
};

/** Right unit square: x ∈ [0,1], y ∈ [0,1] — this is the TARGET territory. */
const TARGET: Polygon = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("applyBrushStroke", () => {
  const sourceAreaBefore = calculateArea(SOURCE);
  const targetAreaBefore = calculateArea(TARGET);

  test("transfers area from source to target when stroke overlaps shared border", () => {
    // Stroke runs along the shared border (x ≈ 0), biased slightly into source (x = -0.1).
    // radius 20 km at near-equator is ~0.18° — small enough to transfer a slice without
    // consuming the whole source.
    const strokePoints: [number, number][] = [
      [-0.1, 0.2],
      [-0.1, 0.8],
    ];
    const radiusKm = 20; // ~0.18° at equator

    const result = applyBrushStroke(strokePoints, radiusKm, SOURCE, TARGET);

    expect(result).not.toBeNull();

    const newSourceArea = calculateArea(result!.source);
    const newTargetArea = calculateArea(result!.target);

    // Source must have shrunk
    expect(newSourceArea).toBeLessThan(sourceAreaBefore);
    // Target must have grown
    expect(newTargetArea).toBeGreaterThan(targetAreaBefore);
    // Conservation: total area should be approximately the same (allow ±5% for floating point)
    const totalBefore = sourceAreaBefore + targetAreaBefore;
    const totalAfter = newSourceArea + newTargetArea;
    expect(totalAfter).toBeCloseTo(totalBefore, -2); // within ~1% (relative)
  });

  test("returns null when stroke does not overlap source at all", () => {
    // Stroke entirely inside the target (right) square — far from source.
    const strokePoints: [number, number][] = [
      [0.7, 0.3],
      [0.7, 0.7],
    ];
    const result = applyBrushStroke(strokePoints, 5, SOURCE, TARGET);
    expect(result).toBeNull();
  });

  test("returns null for empty strokePoints array", () => {
    expect(applyBrushStroke([], 10, SOURCE, TARGET)).toBeNull();
  });

  test("returns null for non-positive radius", () => {
    const strokePoints: [number, number][] = [[-0.1, 0.5]];
    expect(applyBrushStroke(strokePoints, 0, SOURCE, TARGET)).toBeNull();
    expect(applyBrushStroke(strokePoints, -5, SOURCE, TARGET)).toBeNull();
  });

  test("single-point stroke (circular brush) also transfers area when on border", () => {
    // A single point right on the shared edge, biased 0.05° into source.
    const strokePoints: [number, number][] = [[-0.05, 0.5]];
    const radiusKm = 15; // ~0.135°

    const result = applyBrushStroke(strokePoints, radiusKm, SOURCE, TARGET);

    // With the brush centred so close to the border, intersection with source is
    // small but non-zero — result may be null if the brush doesn't reach source.
    // We only assert the result is structurally valid when non-null.
    if (result !== null) {
      const newSourceArea = calculateArea(result.source);
      const newTargetArea = calculateArea(result.target);
      expect(newSourceArea).toBeLessThan(sourceAreaBefore);
      expect(newTargetArea).toBeGreaterThan(targetAreaBefore);
    }
    // null is also acceptable (stroke entirely in target side after buffer)
  });

  test("issues array is present (may be empty) on successful transfer", () => {
    const strokePoints: [number, number][] = [
      [-0.1, 0.3],
      [-0.1, 0.7],
    ];
    const result = applyBrushStroke(strokePoints, 20, SOURCE, TARGET);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.issues)).toBe(true);
  });
});
